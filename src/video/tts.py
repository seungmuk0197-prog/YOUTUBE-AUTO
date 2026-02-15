"""TTS(Text-to-Speech) 생성 모듈"""
import asyncio
import subprocess
from pathlib import Path
from typing import Optional
from ..common.logger import logger


async def generate_tts_async(
    text: str,
    output_path: str,
    voice: str = "ko-KR-SunHiNeural",
    rate: float = 1.0
) -> bool:
    """
    Edge TTS를 사용하여 음성 생성 (비동기)
    
    Args:
        text: 생성할 텍스트
        output_path: 저장 경로 (mp3/wav)
        voice: 음성 선택 (기본: 한국어 여성)
        rate: 재생 속도 (0.5~2.0)
    
    Returns:
        성공 여부
    """
    try:
        import edge_tts
    except ImportError:
        logger.error("edge-tts 패키지가 설치되지 않았습니다. pip install edge-tts를 실행하세요.")
        return False
    
    try:
        logger.info(f"TTS 생성 시작: {len(text)}자")
        
        # 출력 경로 확인
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        # rate는 문자열이어야 함 (예: "+10%", "-10%", "+0%")
        rate_str = f"+{int((rate - 1.0) * 100)}%" if rate >= 1.0 else f"{int((rate - 1.0) * 100)}%"
        
        # Edge TTS 실행
        communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate_str)
        await communicate.save(output_path)
        
        logger.info(f"TTS 생성 완료: {output_path}")
        return True
        
    except Exception as e:
        logger.error(f"TTS 생성 실패: {str(e)}")
        return False


def generate_tts(
    text: str,
    output_path: str,
    voice: str = "ko-KR-SunHiNeural",
    rate: float = 1.0
) -> bool:
    """
    Edge TTS를 사용하여 음성 생성 (동기 래퍼)
    
    Args:
        text: 생성할 텍스트
        output_path: 저장 경로 (mp3/wav)
        voice: 음성 선택 (기본: 한국어 여성)
        rate: 재생 속도 (0.5~2.0)
    
    Returns:
        성공 여부
    """
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            generate_tts_async(text, output_path, voice, rate)
        )
        return result
    except Exception as e:
        logger.error(f"TTS 동기 래퍼 실패: {str(e)}")
        return False


def get_audio_duration(audio_path: str) -> Optional[float]:
    """
    오디오 파일 길이 측정 (mutagen 사용)
    
    Args:
        audio_path: 오디오 파일 경로 (mp3/wav)
    
    Returns:
        초 단위 길이, 실패 시 None
    """
    try:
        from mutagen.mp3 import MP3
        from mutagen.wave import WAVE
        
        audio_file = Path(audio_path)
        
        if audio_file.suffix.lower() == '.mp3':
            audio = MP3(audio_path)
            duration = audio.info.length
            logger.info(f"오디오 길이: {duration:.2f}초")
            return duration
        elif audio_file.suffix.lower() == '.wav':
            audio = WAVE(audio_path)
            duration = audio.info.length
            logger.info(f"오디오 길이: {duration:.2f}초")
            return duration
        else:
            logger.warning(f"지원되지 않는 포맷: {audio_file.suffix}")
            return None
            
    except FileNotFoundError:
        logger.error(f"오디오 파일을 찾을 수 없습니다: {audio_path}")
        return None
    except Exception as e:
        logger.error(f"오디오 길이 측정 실패: {str(e)}")
        return None
