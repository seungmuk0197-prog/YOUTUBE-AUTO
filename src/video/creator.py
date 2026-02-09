"""영상 생성 모듈

대본을 기반으로 TTS 음성과 영상을 생성한다.
"""
import os
import time
from pathlib import Path
from typing import Tuple

from PIL import Image
from moviepy import ImageClip, AudioFileClip
from moviepy.video.compositing.CompositeVideoClip import CompositeVideoClip
from openai import OpenAI

from src.common.logger import get_logger
from src.common.utils import slugify, ensure_dir
from src.video.subtitles import generate_srt, parse_srt_entries


logger = get_logger("video.creator")


class VideoCreator:
    def __init__(self, config: dict):
        self.config = config or {}
        tts_cfg = self.config.get("tts", {})
        api_key = os.environ.get("OPENAI_API_KEY") or tts_cfg.get("api_key")
        # allow initializing without API key so video rendering can be tested independently
        self.client = OpenAI(api_key=api_key) if api_key else None
        self.tts_model = tts_cfg.get("model", "gpt-4o-mini-tts")
        self.tts_voice = tts_cfg.get("voice", "alloy")
        self.tts_format = tts_cfg.get("format", "mp3")

    def generate_audio(self, script: dict) -> str:
        """대본에서 TTS 음성 파일을 생성한다.

        Returns: path to created audio file
        """
        if not self.client:
            raise ValueError("OPENAI_API_KEY 환경변수가 설정되어 있지 않습니다. TTS를 사용하려면 API 키를 설정하세요.")

        title = script.get("title") or script.get("hook") or "untitled"
        slug = slugify(title)
        ts = int(time.time())

        out_dir = Path(self.config.get("output", {}).get("videos_dir", "outputvideos"))
        ensure_dir(str(out_dir))

        audio_fname = f"{ts}_{slug}.{self.tts_format}"
        audio_path = out_dir / audio_fname

        # assemble text from script
        parts = []
        if script.get("hook"):
            parts.append(script.get("hook"))
        for s in script.get("sections", []) or []:
            if isinstance(s, dict):
                parts.append(s.get("narration", ""))
            else:
                parts.append(str(s))
        if script.get("outro"):
            parts.append(script.get("outro"))
        text = "\n\n".join([p for p in parts if p])

        logger.info("TTS 시작: model=%s voice=%s", self.tts_model, self.tts_voice)

        try:
            # call OpenAI TTS endpoint (format is handled server-side)
            resp = self.client.audio.speech.create(
                model=self.tts_model,
                voice=self.tts_voice,
                input=text,
            )

            # write response content to file; support common response shapes
            data = None
            if isinstance(resp, (bytes, bytearray)):
                data = resp
            elif hasattr(resp, "read"):
                data = resp.read()
            elif hasattr(resp, "audio"):
                data = resp.audio
            elif hasattr(resp, "content"):
                data = resp.content

            if data is None:
                raise RuntimeError("알 수 없는 TTS 응답 형식입니다.")

            with open(audio_path, "wb") as f:
                f.write(data)

            logger.info("TTS 파일 생성: %s", audio_path)
            return str(audio_path)
        except Exception as e:
            logger.exception("TTS 생성 실패")
            raise

    def generate_video(self, script: dict, audio_path: str) -> str:
        """음성과 단색 배경을 합쳐 mp4를 생성한다.

        Returns: path to created video file
        """
        if not audio_path or not Path(audio_path).exists():
            raise ValueError(f"오디오 파일을 찾을 수 없습니다: {audio_path}")

        title = script.get("title") or script.get("hook") or "untitled"
        slug = slugify(title)
        ts = int(time.time())

        video_cfg = self.config.get("video", {})
        width = int(video_cfg.get("width", 1280))
        height = int(video_cfg.get("height", 720))
        fps = int(video_cfg.get("fps", 30))
        bg = video_cfg.get("background_color", [10, 10, 10])
        codec = video_cfg.get("codec", "libx264")
        audio_codec = video_cfg.get("audio_codec", "aac")
        subtitles_on = bool(video_cfg.get("subtitles", False))

        out_dir = Path(self.config.get("output", {}).get("videos_dir", "outputvideos"))
        ensure_dir(str(out_dir))

        audio_clip = AudioFileClip(str(audio_path))

        video_fname = f"{ts}_{slug}.mp4"
        video_path = out_dir / video_fname

        # create solid color image
        tmp_img = out_dir / f"{ts}_{slug}.png"
        color = tuple(bg) if isinstance(bg, (list, tuple)) and len(bg) >= 3 else (10, 10, 10)
        img = Image.new("RGB", (width, height), color)
        img.save(tmp_img)

        try:
            img_clip = ImageClip(str(tmp_img), duration=audio_clip.duration)
            img_clip = img_clip.with_audio(audio_clip)

            final_clip = img_clip

            # subtitles: generate SRT and try to overlay
            if subtitles_on:
                try:
                    srt_path = out_dir / f"{ts}_{slug}.srt"
                    generate_srt(script, audio_clip.duration, str(srt_path))
                    entries = parse_srt_entries(str(srt_path))
                    # create TextClips for each subtitle entry
                    from moviepy.video.tools.subtitles import SubtitlesClip
                    from moviepy.video.io.VideoFileClip import TextClip

                    def make_txt(txt):
                        font = video_cfg.get("subtitle_font") or "Arial"
                        fontsize = int(video_cfg.get("subtitle_font_size", 48))
                        try:
                            return TextClip(txt, fontsize=fontsize, font=font, color='white', method='label')
                        except Exception:
                            return TextClip(txt, fontsize=fontsize, color='white', method='label')

                    subs = [( (e['start'].replace(',', '.'), e['end'].replace(',', '.')), e['content']) for e in entries]
                    # SubtitlesClip expects ((start, end), text) pairs; create generator
                    generator = lambda txt: make_txt(txt)
                    subtitles = SubtitlesClip(subs, generator)
                    final_clip = CompositeVideoClip([img_clip, subtitles.set_position(('center','bottom'))])
                except Exception as e:
                    logger.exception("자막 오버레이 실패, SRT는 생성되었을 수 있습니다")

            logger.info("비디오 렌더링 시작: %s", video_path)
            final_clip.write_videofile(
                str(video_path),
                fps=fps,
                codec=codec,
                audio_codec=audio_codec,
                threads=4,
                preset="medium",
                logger=None,
            )

            audio_clip.close()
            final_clip.close()
            logger.info("비디오 생성 완료: %s", video_path)
            return str(video_path)
        finally:
            try:
                if tmp_img.exists():
                    tmp_img.unlink()
            except Exception:
                pass
