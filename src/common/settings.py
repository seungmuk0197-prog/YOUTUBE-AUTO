"""설정 로더 - 환경변수 + YAML 통합"""
import os
import yaml
from pathlib import Path
from typing import Any, Optional
from dotenv import load_dotenv


class Settings:
    """설정 관리 클래스"""
    
    _instance = None
    _config = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Settings, cls).__new__(cls)
            cls._instance._load_config()
        return cls._instance
    
    def _load_config(self):
        """YAML + 환경변수 로드"""
        # .env 파일 로드 (프로젝트 루트)
        env_path = Path(__file__).parent.parent.parent / ".env"
        load_dotenv(env_path, override=True)
        
        # YAML 로드
        config_path = Path(__file__).parent.parent.parent / "config" / "settings.yaml"
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                self._config = yaml.safe_load(f) or {}
        
        # 환경변수로 오버라이드
        self._config['OPENAI_API_KEY'] = os.getenv('OPENAI_API_KEY', '')
        self._config['FFMPEG_PATH'] = os.getenv('FFMPEG_PATH', 'ffmpeg')
        self._config['YOUTUBE_CLIENT_SECRETS_PATH'] = os.getenv('YOUTUBE_CLIENT_SECRETS_PATH', '')
        self._config['YOUTUBE_TOKEN_PATH'] = os.getenv('YOUTUBE_TOKEN_PATH', '')
        self._config['YOUTUBE_CHANNEL_ID'] = os.getenv('YOUTUBE_CHANNEL_ID', '')
        self._config['ELEVENLABS_API_KEY'] = os.getenv('ELEVENLABS_API_KEY', '')
        self._config['COMFYUI_URL'] = os.getenv('COMFYUI_URL', '')
        self._config['STABLE_DIFFUSION_URL'] = os.getenv('STABLE_DIFFUSION_URL', '')
        self._config['TRANSLATE_ENDPOINT'] = os.getenv('TRANSLATE_ENDPOINT', 'http://127.0.0.1:5000/translate')
    
    def get(self, key: str, default: Any = None) -> Any:
        """설정값 조회"""
        keys = key.split('.')
        value = self._config
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k, default)
            else:
                return default
        return value if value is not None else default
    
    def __getattr__(self, name: str) -> Any:
        """settings.OPENAI_API_KEY 형식으로 접근"""
        value = self.get(name)
        if value is None:
            raise AttributeError(f"Setting '{name}' not found")
        return value


# 싱글톤 인스턴스
settings = Settings()


# 자주 사용하는 경로
def get_project_root() -> Path:
    """프로젝트 루트 경로"""
    return Path(__file__).parent.parent.parent


def get_src_root() -> Path:
    """src 루트 경로"""
    return get_project_root() / "src"


def get_outputs_root() -> Path:
    """outputs 루트 경로"""
    return get_project_root() / "outputs"


def get_config_root() -> Path:
    """config 루트 경로"""
    return get_project_root() / "config"


def get_logs_root() -> Path:
    """logs 루트 경로"""
    return get_project_root() / "logs"
