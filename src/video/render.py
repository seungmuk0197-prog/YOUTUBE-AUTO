"""FFmpeg 비디오 렌더링 모듈"""
import subprocess
import shutil
from pathlib import Path
from typing import Optional
from PIL import Image
from ..common.logger import logger
from ..common.settings import settings


def check_ffmpeg() -> bool:
    """FFmpeg 설치 여부 확인"""
    try:
        ffmpeg_path = settings.get('FFMPEG_PATH', 'ffmpeg')
        result = subprocess.run(
            [ffmpeg_path, "-version"],
            capture_output=True,
            timeout=5
        )
        if result.returncode == 0:
            logger.info("FFmpeg 감지됨")
            return True
    except FileNotFoundError:
        logger.error("FFmpeg를 찾을 수 없습니다.")
        logger.info("설치 방법: https://ffmpeg.org/download.html")
        return False
    except Exception as e:
        logger.error(f"FFmpeg 확인 실패: {str(e)}")
        return False
    
    return False


def create_placeholder_image(output_path: str, width: int = 1280, height: int = 720) -> bool:
    """
    플레이스홀더 이미지 생성 (텍스트 없음, 단색 배경)
    
    Args:
        output_path: 이미지 저장 경로
        width: 이미지 너비
        height: 이미지 높이
    
    Returns:
        성공 여부
    """
    try:
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        # 단색 배경(어두운 파란색) 이미지 생성
        img = Image.new('RGB', (width, height), color=(25, 50, 100))
        img.save(output_path)
        
        logger.info(f"플레이스홀더 이미지 생성: {output_path}")
        return True
        
    except Exception as e:
        logger.error(f"이미지 생성 실패: {str(e)}")
        return False


def render_video(
    image_path: str,
    audio_path: str,
    srt_path: str,
    output_path: str,
    width: int = 1280,
    height: int = 720,
    fps: int = 24
) -> bool:
    """
    FFmpeg를 사용하여 비디오 렌더링
    
    입력: 정지 이미지 + 오디오 + SRT 자막
    출력: MP4 비디오
    
    Args:
        image_path: 이미지 파일 경로
        audio_path: 오디오 파일 경로
        srt_path: SRT 자막 파일 경로
        output_path: 출력 MP4 경로
        width: 비디오 너비
        height: 비디오 높이
        fps: 프레임레이트
    
    Returns:
        성공 여부
    """
    try:
        # FFmpeg 확인
        if not check_ffmpeg():
            logger.error("❌ FFmpeg를 찾을 수 없습니다. 설치 후 다시 시도하세요.")
            return False
        
        # 입력 파일 검증
        image_file = Path(image_path)
        audio_file = Path(audio_path)
        srt_file = Path(srt_path)
        
        if not image_file.exists():
            logger.error(f"❌ 이미지 파일 없음: {image_path}")
            return False
        
        if not audio_file.exists():
            logger.error(f"❌ 오디오 파일 없음: {audio_path}")
            return False
        
        if not srt_file.exists():
            logger.error(f"❌ 자막 파일 없음: {srt_path}")
            return False
        
        logger.info(f"✓ 이미지 입력: {image_path} ({image_file.stat().st_size} bytes)")
        logger.info(f"✓ 오디오 입력: {audio_path} ({audio_file.stat().st_size} bytes)")
        logger.info(f"✓ 자막 입력: {srt_path} ({srt_file.stat().st_size} bytes)")
        logger.info("FFmpeg 렌더링 시작...")
        
        # 출력 경로 생성
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        # 기존 파일 제거
        if output_file.exists():
            output_file.unlink()
        
        # FFmpeg 커맨드 구성
        ffmpeg_path = settings.get('FFMPEG_PATH', 'ffmpeg')
        
        # 경로를 포워드 슬래시로 변환 (FFmpeg 호환성)
        image_path_unix = str(image_path).replace('\\', '/')
        audio_path_unix = str(audio_path).replace('\\', '/')
        output_path_unix = str(output_path).replace('\\', '/')
        
        # [수정] 자막 파일 복사 (한글 경로 문제 해결용)
        temp_srt_path = output_file.parent.parent / "subtitles" / "subs_tmp.srt"
        try:
            temp_srt_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(srt_path, temp_srt_path)
            logger.info(f"임시 자막 파일 생성: {temp_srt_path}")
        except Exception as e:
            logger.warning(f"자막 임시 복사 실패, 원본 사용: {e}")
            temp_srt_path = Path(srt_path)

        # 자막 경로 이스케이프 (Windows 드라이브 콜론 처리: C: -> C\:)
        srt_path_unix = str(temp_srt_path).replace('\\', '/')
        srt_path_unix = srt_path_unix.replace(':', '\\:')

        # 자막 필터 추가 (⚠️ Windows에서는 작은따옴표가 문제를 일으킬 수 있어 제거)
        cmd = [
            ffmpeg_path,
            "-loop", "1",
            "-i", image_path_unix,
            "-i", audio_path_unix,
            "-c:v", "libx264",
            "-c:a", "aac",
            "-shortest",
            "-pix_fmt", "yuv420p",
            "-vf", f"subtitles={srt_path_unix}",
            output_path_unix
        ]

        
        logger.info(f"FFmpeg 명령: {' '.join(cmd)}")
        
        # FFmpeg 실행
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=300  # 5분 타임아웃
        )
        
        if result.returncode == 0:
            # 출력 파일 크기 확인
            if output_file.exists():
                output_size = output_file.stat().st_size
                logger.info(f"✓ 비디오 렌더링 완료: {output_path} ({output_size} bytes)")
                return True
            else:
                logger.error(f"❌ 렌더링 결과 파일 없음: {output_path}")
                return False
        else:
            logger.error(f"❌ FFmpeg 렌더링 실패 (exit code: {result.returncode})")
            if result.stderr:
                tail = "\n".join(result.stderr.splitlines()[-40:])
                logger.error("stderr (last 40 lines):\n" + tail)
            if result.stdout:
                tail_out = "\n".join(result.stdout.splitlines()[-40:])
                logger.error("stdout (last 40 lines):\n" + tail_out)
            return False

    except subprocess.TimeoutExpired:
        logger.error("❌ FFmpeg 렌더링 타임아웃 (5분 초과)")
        return False
    except Exception as e:
        logger.error(f"❌ 비디오 렌더링 실패: {str(e)}")
        return False


def render_video_simple(
    image_path: str,
    audio_path: str,
    output_path: str,
    width: int = 1280,
    height: int = 720,
    fps: int = 24
) -> bool:
    """
    자막 없이 간단하게 비디오 렌더링 (테스트용)
    
    Args:
        image_path: 이미지 파일 경로
        audio_path: 오디오 파일 경로
        output_path: 출력 MP4 경로
        width: 비디오 너비
        height: 비디오 높이
        fps: 프레임레이트
    
    Returns:
        성공 여부
    """
    try:
        # 입력 파일 검증
        image_file = Path(image_path)
        audio_file = Path(audio_path)
        
        if not image_file.exists():
            logger.error(f"❌ 이미지 파일 없음: {image_path}")
            return False
        
        if not audio_file.exists():
            logger.error(f"❌ 오디오 파일 없음: {audio_path}")
            return False
        
        logger.info(f"✓ 이미지 입력: {image_path} ({image_file.stat().st_size} bytes)")
        logger.info(f"✓ 오디오 입력: {audio_path} ({audio_file.stat().st_size} bytes)")
        
        # FFmpeg 확인
        if not check_ffmpeg():
            logger.error("❌ FFmpeg를 찾을 수 없습니다. 설치 후 다시 시도하세요.")
            return False
        
        logger.info("FFmpeg 간단 렌더링 시작...")
        
        # 출력 경로 생성
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        # 기존 파일 제거
        if output_file.exists():
            output_file.unlink()
        
        # FFmpeg 커맨드
        ffmpeg_path = settings.get('FFMPEG_PATH', 'ffmpeg')
        
        # 경로를 포워드 슬래시로 변환
        image_path_unix = str(image_path).replace('\\', '/')
        audio_path_unix = str(audio_path).replace('\\', '/')
        output_path_unix = str(output_path).replace('\\', '/')
        
        cmd = [
            ffmpeg_path,
            "-y",
            "-loop", "1",
            "-i", image_path_unix,
            "-i", audio_path_unix,
            "-c:v", "libx264",
            "-c:a", "aac",
            "-shortest",
            "-pix_fmt", "yuv420p",
            output_path_unix
        ]
        
        logger.info(f"FFmpeg 명령: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=300
        )
        
        if result.returncode == 0:
            # 출력 파일 크기 확인
            if output_file.exists():
                output_size = output_file.stat().st_size
                logger.info(f"✓ 비디오 렌더링 완료: {output_path} ({output_size} bytes)")
                return True
            else:
                logger.error(f"❌ 렌더링 결과 파일 없음: {output_path}")
                return False
        else:
            logger.error(f"❌ FFmpeg 렌더링 실패 (exit code: {result.returncode})")
            if result.stderr:
                logger.error(f"stderr: {result.stderr[:500]}")
            if result.stdout:
                logger.error(f"stdout: {result.stdout[:500]}")
            return False
            
    except subprocess.TimeoutExpired:
        logger.error("❌ FFmpeg 렌더링 타임아웃 (5분 초과)")
        return False
    except Exception as e:
        logger.error(f"❌ 간단 렌더링 실패: {str(e)}")
        return False
