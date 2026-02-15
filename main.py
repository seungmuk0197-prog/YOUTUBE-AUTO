#!/usr/bin/env python3
"""
YouTube 자동 영상 생성 파이프라인
대본 -> TTS -> 자막 -> FFmpeg 렌더링 -> MP4 생성
"""
import argparse
import sys
from pathlib import Path

# ✅ [추가] .env 로드 (루트의 .env를 자동으로 읽기)
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

# 프로젝트 루트를 sys.path에 추가
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# ✅ [추가] .env 파일 로드 (project_root/.env)
if load_dotenv is not None:
    env_path = project_root / ".env"
    # override=False: OS 환경변수/이미 설정된 값이 있으면 그걸 우선
    load_dotenv(dotenv_path=env_path, override=False)

from src.common.logger import logger
from src.common.settings import get_outputs_root, get_config_root
from src.video.tts import generate_tts, get_audio_duration
from src.video.srt import generate_srt
from src.video.render import create_placeholder_image, render_video, render_video_simple

# ✅ [추가] .env 로드 상태를 로그로만 확인 (키 값은 출력 금지)
import os
logger.info(f"ENV loaded (.env): {bool((project_root / '.env').exists())}")
logger.info(f"OPENAI_API_KEY set: {bool(os.getenv('OPENAI_API_KEY'))}")
logger.info(f"OPENAI_API_KEYS set: {bool(os.getenv('OPENAI_API_KEYS'))}")
logger.info(f"LLM_PROVIDER: {os.getenv('LLM_PROVIDER') or '(not set)'}")


def load_script(script_path: str) -> str:
    """대본 파일 로드"""
    try:
        with open(script_path, 'r', encoding='utf-8') as f:
            text = f.read().strip()
        if not text:
            raise ValueError("대본이 비어있습니다.")
        logger.info(f"대본 로드 완료: {len(text)}자")
        return text
    except Exception as e:
        logger.error(f"대본 로드 실패: {str(e)}")
        raise


def run_pipeline(
    script_path: str,
    voice: str = "ko-KR-SunHiNeural",
    enable_subtitles: bool = True,
    skip_render: bool = False
) -> bool:
    """
    메인 파이프라인 실행

    Args:
        script_path: 대본 파일 경로
        voice: TTS 음성 선택
        enable_subtitles: 자막 생성 여부
        skip_render: 렌더링 스킵(테스트용)

    Returns:
        성공 여부
    """
    try:
        logger.info("=" * 60)
        logger.info("YouTube 자동 영상 생성 파이프라인 시작")
        logger.info("=" * 60)

        # 1) 대본 로드
        logger.info("\n[1/5] 대본 로드 중...")
        script_text = load_script(script_path)

        # 2) 출력 폴더 설정
        outputs_root = get_outputs_root()
        audio_path = outputs_root / "audio" / "narration.mp3"
        srt_path = outputs_root / "subtitles" / "subtitles.srt"
        image_path = outputs_root / "images" / "cover.png"
        video_path = outputs_root / "videos" / "final.mp4"

        outputs_root.mkdir(parents=True, exist_ok=True)
        audio_path.parent.mkdir(parents=True, exist_ok=True)
        srt_path.parent.mkdir(parents=True, exist_ok=True)
        image_path.parent.mkdir(parents=True, exist_ok=True)
        video_path.parent.mkdir(parents=True, exist_ok=True)

        # 3) TTS 생성
        logger.info("\n[2/5] TTS 생성 중...")
        if not generate_tts(script_text, str(audio_path), voice=voice):
            logger.error("TTS 생성 실패!")
            return False

        # 4) 오디오 길이 측정
        logger.info("\n[3/5] 오디오 길이 측정 중...")
        audio_duration = get_audio_duration(str(audio_path))
        if audio_duration is None:
            logger.error("오디오 길이 측정 실패!")
            return False

        # 5) SRT 자막 생성
        if enable_subtitles:
            logger.info("\n[4/5] SRT 자막 생성 중...")
            if not generate_srt(script_text, audio_duration, str(srt_path)):
                logger.error("SRT 생성 실패!")
                return False

        # 6) 커버 이미지 생성
        logger.info("\n[5/5] 커버 이미지 생성 중...")
        if not image_path.exists():
            if not create_placeholder_image(str(image_path)):
                logger.error("이미지 생성 실패!")
                return False
        else:
            logger.info(f"기존 이미지 사용: {image_path}")

        # 7) 렌더링 (선택사항)
        if not skip_render:
            logger.info("\n[렌더링] FFmpeg 비디오 렌더링 중...")

            # 이미지 파일 존재 확인
            if not image_path.exists():
                logger.error(f"❌ 이미지 파일 없음: {image_path}")
                return False
            logger.info(f"✓ 이미지 파일 확인: {image_path} ({image_path.stat().st_size} bytes)")

            # 오디오 파일 존재 확인
            if not audio_path.exists():
                logger.error(f"❌ 오디오 파일 없음: {audio_path}")
                return False
            logger.info(f"✓ 오디오 파일 확인: {audio_path} ({audio_path.stat().st_size} bytes)")

            # 자막이 있으면 자막 포함 렌더링
            if enable_subtitles and srt_path.exists():
                logger.info(f"✓ 자막 파일 확인: {srt_path}")
                success = render_video(
                    str(image_path),
                    str(audio_path),
                    str(srt_path),
                    str(video_path)
                )
            else:
                # 자막 없는 간단한 렌더링
                logger.info("자막 파일 없음 - 자막 없이 렌더링")
                success = render_video_simple(
                    str(image_path),
                    str(audio_path),
                    str(video_path)
                )

            if not success:
                logger.error("❌ 비디오 렌더링 실패!")
                return False

            # 렌더링 결과 확인
            if not video_path.exists():
                logger.error(f"❌ 렌더링 결과 파일 없음: {video_path}")
                return False
            logger.info(f"✓ 렌더링 완료: {video_path} ({video_path.stat().st_size} bytes)")

        # 완료
        logger.info("\n" + "=" * 60)
        logger.info("파이프라인 완료!")
        logger.info("=" * 60)
        logger.info(f"[AUDIO] {audio_path}")
        logger.info(f"[SUBTITLE] {srt_path}")
        logger.info(f"[IMAGE] {image_path}")
        if not skip_render:
            logger.info(f"[VIDEO] {video_path}")
        logger.info("=" * 60)

        return True

    except Exception as e:
        logger.error(f"파이프라인 실패: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """메인 엔트리포인트"""
    parser = argparse.ArgumentParser(
        description="YouTube 자동 영상 생성 파이프라인"
    )

    parser.add_argument(
        "--script",
        type=str,
        default=str(get_config_root() / "input_script.txt"),
        help="대본 파일 경로 (기본: config/input_script.txt)"
    )

    parser.add_argument(
        "--voice",
        type=str,
        default="ko-KR-SunHiNeural",
        help="TTS 음성 선택 (기본: ko-KR-SunHiNeural)"
    )

    parser.add_argument(
        "--no-subtitles",
        action="store_true",
        help="자막 생성 건너뛰기"
    )

    parser.add_argument(
        "--skip-render",
        action="store_true",
        help="최종 렌더링 건너뛰기 (TTS/자막만 생성)"
    )

    args = parser.parse_args()

    # 파이프라인 실행
    success = run_pipeline(
        args.script,
        voice=args.voice,
        enable_subtitles=not args.no_subtitles,
        skip_render=args.skip_render
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
