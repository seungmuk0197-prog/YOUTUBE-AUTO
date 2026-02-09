"""메인 파이프라인

대본 → 영상 생성 → 썸네일 → 업로드 → 리포트 순서로 실행한다.
"""

from src.common.logger import get_logger
from src.common.utils import now_ms, now_ts, ensure_dir

logger = get_logger("pipeline")


class Pipeline:
    def __init__(self, config: dict):
        self.config = config

    def run(self, topic: str) -> dict:
        """전체 파이프라인을 순차 실행한다."""
        logger.info("파이프라인 시작: %s", topic)
        start_all = now_ms()
        # pipeline flags
        pipeline_cfg = self.config.get("pipeline", {})
        enable_video = pipeline_cfg.get("enable_video", True)
        enable_thumbnail = pipeline_cfg.get("enable_thumbnail", False)
        enable_upload = pipeline_cfg.get("enable_upload", False)
        enable_report = pipeline_cfg.get("enable_report", False)

        # 1. 대본 생성
        logger.info("[1/5] 대본 생성")
        script = self._step_script(topic)

        result = {
            "script": script,
            "audio_path": None,
            "video_path": None,
            "thumbnail_path": None,
            "upload_result": None,
            "report_path": None,
            "timings_ms": {},
            "error": None,
        }

        # 2. 영상 생성
        if enable_video:
            logger.info("[2/5] 영상 생성")
            t0 = now_ms()
            try:
                audio_path, video_path = self._step_video(script)
                result["audio_path"] = audio_path
                result["video_path"] = video_path
            except Exception as e:
                logger.exception("영상 생성 실패")
                result["error"] = {"step": "video", "message": str(e)}
                result["timings_ms"]["video"] = now_ms() - t0
                total = now_ms() - start_all
                result["timings_ms"]["total"] = total
                return result
            result["timings_ms"]["video"] = now_ms() - t0
        else:
            logger.info("[2/5] 영상 생성: SKIPPED")
            result["timings_ms"]["video"] = 0

        # 3. 썸네일 생성
        if enable_thumbnail:
            logger.info("[3/5] 썸네일 생성")
            t0 = now_ms()
            try:
                thumbnail_path = self._step_thumbnail(script)
                result["thumbnail_path"] = thumbnail_path
            except Exception as e:
                logger.exception("썸네일 생성 실패")
                result["error"] = {"step": "thumbnail", "message": str(e)}
                result["timings_ms"]["thumbnail"] = now_ms() - t0
                total = now_ms() - start_all
                result["timings_ms"]["total"] = total
                return result
            result["timings_ms"]["thumbnail"] = now_ms() - t0
        else:
            logger.info("[3/5] 썸네일 생성: SKIPPED")
            result["timings_ms"]["thumbnail"] = 0

        # 4. 업로드
        if enable_upload:
            logger.info("[4/5] 유튜브 업로드")
            t0 = now_ms()
            try:
                video_id = self._step_upload(result.get("video_path"), result.get("thumbnail_path"), script)
                result["upload_result"] = video_id
            except Exception as e:
                logger.exception("업로드 실패")
                result["error"] = {"step": "upload", "message": str(e)}
                result["timings_ms"]["upload"] = now_ms() - t0
                total = now_ms() - start_all
                result["timings_ms"]["total"] = total
                return result
            result["timings_ms"]["upload"] = now_ms() - t0
        else:
            logger.info("[4/5] 유튜브 업로드: SKIPPED")
            result["timings_ms"]["upload"] = 0

        # 5. 리포트
        if enable_report:
            logger.info("[5/5] 리포트 생성")
            t0 = now_ms()
            try:
                report = self._step_report(result.get("upload_result"), script)
                result["report_path"] = report
            except Exception as e:
                logger.exception("리포트 생성 실패")
                result["error"] = {"step": "report", "message": str(e)}
                result["timings_ms"]["report"] = now_ms() - t0
                total = now_ms() - start_all
                result["timings_ms"]["total"] = total
                return result
            result["timings_ms"]["report"] = now_ms() - t0
        else:
            logger.info("[5/5] 리포트 생성: SKIPPED")
            result["timings_ms"]["report"] = 0

        total = now_ms() - start_all
        result["timings_ms"]["total"] = total
        logger.info("파이프라인 완료 (total %d ms)", total)
        return result

    def _step_script(self, topic: str) -> dict:
        from src.script.generator import ScriptGenerator
        gen = ScriptGenerator(self.config)
        script = gen.generate(topic)
        return gen.refine(script)

    def _step_video(self, script: dict) -> str:
        from src.video.creator import VideoCreator
        creator = VideoCreator(self.config)
        audio_path = creator.generate_audio(script)
        video_path = creator.generate_video(script, audio_path)
        return audio_path, video_path

    def _step_thumbnail(self, script: dict) -> str:
        from src.thumbnail.generator import ThumbnailGenerator
        gen = ThumbnailGenerator(self.config)
        return gen.generate(script.get("title", ""), script.get("keywords", []))

    def _step_upload(self, video_path: str, thumbnail_path: str, script: dict) -> str:
        from src.upload.uploader import YouTubeUploader
        uploader = YouTubeUploader(self.config)
        uploader.authenticate()
        metadata = {
            "title": script.get("title", ""),
            "description": script.get("description", ""),
            "tags": script.get("keywords", []),
        }
        return uploader.upload(video_path, thumbnail_path, metadata)

    def _step_report(self, video_id: str, script: dict) -> dict:
        from src.report.reporter import Reporter
        reporter = Reporter(self.config)
        return reporter.generate_upload_report(video_id, {"title": script.get("title", "")})
