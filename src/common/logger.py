"""로그 관리"""
import logging
import sys
from pathlib import Path
from datetime import datetime


def setup_logger(name: str = "youtube-auto", log_file: bool = True) -> logging.Logger:
    """로거 설정"""
    logger = logging.getLogger(name)
    
    # 이미 핸들러가 있으면 반환
    if logger.handlers:
        return logger
    
    logger.setLevel(logging.DEBUG)
    
    # 포맷터
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # 콘솔 핸들러
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # 파일 핸들러
    if log_file:
        from .settings import get_logs_root
        log_dir = get_logs_root()
        log_dir.mkdir(parents=True, exist_ok=True)
        log_path = log_dir / f"{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        
        file_handler = logging.FileHandler(log_path, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger


# 기본 로거
logger = setup_logger()
