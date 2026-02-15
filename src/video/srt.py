"""SRT 자막 생성 모듈"""
import re
from typing import List
from pathlib import Path
from ..common.logger import logger


def format_timestamp(seconds: float) -> str:
    """초를 SRT 타임스탬프 형식으로 변환 (HH:MM:SS,mmm)"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def split_sentences_ko(text: str, max_length: int = 100) -> List[str]:
    """
    한글 텍스트를 문장 단위로 분할
    
    구분 기호: 마침표, 물음표, 느낌표, 줄바꿈
    
    Args:
        text: 원본 텍스트
        max_length: 최대 문장 길이 (초과 시 분할)
    
    Returns:
        문장 리스트
    """
    # 줄바꿈을 임시 마커로 변환
    text = text.replace('\n', '。')  # 임시 분리자
    
    # 마침표, 물음표, 느낌표 뒤에 분리자 추가
    text = re.sub(r'([.!?。])', r'\1<SEP>', text)
    
    # 분리
    sentences = text.split('<SEP>')
    
    result = []
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        
        # 문장이 너무 길면 공백 기준으로 분할
        if len(sentence) > max_length:
            words = sentence.split()
            current = ""
            for word in words:
                if len(current) + len(word) + 1 <= max_length:
                    current += (" " if current else "") + word
                else:
                    if current:
                        result.append(current)
                    current = word
            if current:
                result.append(current)
        else:
            result.append(sentence)
    
    return result


def make_srt(sentences: List[str], total_seconds: float) -> str:
    """
    문장 리스트를 SRT 형식으로 생성 (균등 분배)
    
    Args:
        sentences: 문장 리스트
        total_seconds: 전체 오디오 길이 (초)
    
    Returns:
        SRT 형식 문자열
    """
    if not sentences:
        return ""
    
    srt_lines = []
    num_sentences = len(sentences)
    
    # 각 문장 길이 (균등 분배)
    sentence_duration = total_seconds / num_sentences
    
    for idx, sentence in enumerate(sentences):
        start_time = idx * sentence_duration
        end_time = (idx + 1) * sentence_duration
        
        # 마지막 문장은 정확히 끝시간으로
        if idx == num_sentences - 1:
            end_time = total_seconds
        
        srt_lines.append(f"{idx + 1}")
        srt_lines.append(f"{format_timestamp(start_time)} --> {format_timestamp(end_time)}")
        srt_lines.append(sentence)
        srt_lines.append("")  # 빈 줄
    
    return "\n".join(srt_lines)


def write_srt(srt_path: str, srt_content: str) -> bool:
    """
    SRT 파일 저장
    
    Args:
        srt_path: 저장 경로
        srt_content: SRT 내용
    
    Returns:
        성공 여부
    """
    try:
        output_file = Path(srt_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(srt_path, 'w', encoding='utf-8') as f:
            f.write(srt_content)
        
        logger.info(f"SRT 파일 저장 완료: {srt_path}")
        return True
        
    except Exception as e:
        logger.error(f"SRT 파일 저장 실패: {str(e)}")
        return False


def generate_srt(
    text: str,
    audio_duration: float,
    output_path: str,
    max_sentence_length: int = 100
) -> bool:
    """
    텍스트에서 SRT 자막 생성
    
    Args:
        text: 원본 텍스트
        audio_duration: 오디오 길이 (초)
        output_path: SRT 저장 경로
        max_sentence_length: 최대 문장 길이
    
    Returns:
        성공 여부
    """
    try:
        logger.info(f"SRT 생성 시작: {audio_duration:.2f}초")
        
        # 문장 분할
        sentences = split_sentences_ko(text, max_sentence_length)
        logger.info(f"문장 수: {len(sentences)}")
        
        # SRT 생성
        srt_content = make_srt(sentences, audio_duration)
        
        # 저장
        success = write_srt(output_path, srt_content)
        return success
        
    except Exception as e:
        logger.error(f"SRT 생성 실패: {str(e)}")
        return False
