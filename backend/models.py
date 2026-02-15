"""프로젝트 데이터 모델 및 스키마"""
from dataclasses import dataclass, asdict, field, is_dataclass
from datetime import datetime
from typing import List, Optional, Dict, Any
import json


def to_dict_safe(obj: Any) -> Any:
    """
    안전한 객체를 딕셔너리로 변환하는 유틸 함수
    - dataclass 인스턴스면 asdict()
    - dict면 그대로 반환
    - pydantic이면 model_dump() 또는 dict()
    - 그 외는 __dict__ 또는 str fallback
    """
    if obj is None:
        return None
    
    # dataclass 인스턴스 확인
    if is_dataclass(obj):
        try:
            return asdict(obj)
        except (TypeError, ValueError) as e:
            # asdict 실패 시 __dict__ 사용
            if hasattr(obj, '__dict__'):
                return dict(obj.__dict__)
            return {"value": str(obj)}
    
    # dict 타입
    if isinstance(obj, dict):
        return obj
    
    # pydantic v2
    if hasattr(obj, "model_dump"):
        try:
            return obj.model_dump()
        except Exception:
            pass
    
    # pydantic v1
    if hasattr(obj, "dict"):
        try:
            return obj.dict()
        except Exception:
            pass
    
    # __dict__ 속성이 있는 경우
    if hasattr(obj, "__dict__"):
        return dict(obj.__dict__)
    
    # 최후의 수단: 문자열로 변환
    return {"value": str(obj)}


@dataclass
class Character:
    """캐릭터 정의"""
    id: str
    name: str
    desc_ko: str = ""
    desc_en: str = ""
    role: str = ""


@dataclass
class Scene:
    """씬 정의"""
    id: str
    title: str = ""
    narration_ko: str = ""
    narration_en: str = ""
    image_prompt_en: str = ""
    image_path: Optional[str] = None
    audio_path: Optional[str] = None
    durationSec: Optional[float] = None
    startTime: Optional[float] = None
    endTime: Optional[float] = None
    sequence: int = 0
    imageStyle: str = ""
    imageUrl: Optional[str] = None
    transition: str = "none"
    effects: Dict[str, Any] = field(default_factory=dict)
    characterId: Optional[str] = None




@dataclass
class Thumbnail:
    """썸네일 설정"""
    text: str = ""
    mode: str = "with_text"  # with_text | without_text
    path: Optional[str] = None


@dataclass
class VideoSettings:
    """비디오 렌더링 설정"""
    fps: int = 30
    width: int = 1280
    height: int = 720


@dataclass
class TTSSettings:
    """TTS 설정"""
    voice: str = "alloy"
    format: str = "mp3"


@dataclass
class BGMSettings:
    """BGM 설정"""
    enabled: bool = False
    path: Optional[str] = None
    volume: float = 0.15


@dataclass
class Settings:
    """전체 설정"""
    video: VideoSettings = field(default_factory=VideoSettings)
    tts: TTSSettings = field(default_factory=TTSSettings)
    bgm: BGMSettings = field(default_factory=BGMSettings)
    subtitles: Dict[str, Any] = field(default_factory=lambda: {"enabled": False})


@dataclass
class Status:
    """파이프라인 상태"""
    script: str = "pending"  # done | pending | error
    images: str = "pending"
    tts: str = "pending"
    render: str = "pending"
    archived: bool = False  # 프로젝트 보관 상태
    isPinned: bool = False  # 즐겨찾기 상태
    lastOpenedAt: Optional[str] = None  # 마지막 열람 시간


@dataclass
class LastRun:
    """마지막 실행 정보"""
    timingsMs: Dict[str, int] = field(default_factory=dict)
    error: Optional[str] = None


@dataclass
class Project:
    """프로젝트 (project.json의 루트)"""
    id: str
    createdAt: str
    updatedAt: str
    topic: str = ""
    provider: str = "imagen4"  # imagen4 | imagefx | whisk | midjourney | nanobanana | nanobanana_pro
    aspectRatio: str = "16:9"
    blueprint: Dict[str, Any] = field(default_factory=dict)
    script: str = ""
    characters: List[Character] = field(default_factory=list)
    scenes: List[Scene] = field(default_factory=list)
    thumbnail: Thumbnail = field(default_factory=Thumbnail)
    settings: Settings = field(default_factory=Settings)
    status: Status = field(default_factory=Status)
    lastRun: LastRun = field(default_factory=LastRun)
    
    def to_dict(self) -> Dict[str, Any]:
        """프로젝트를 딕셔너리로 변환"""
        # include a friendly `name` field for frontend compatibility
        # include snake_case aliases and a `text` alias for scenes for frontend compatibility
        scenes_list = []
        for s in self.scenes:
            sd = to_dict_safe(s)
            # provide legacy `text` key expected by frontend
            if isinstance(sd, dict):
                sd['text'] = sd.get('narration_ko') or sd.get('narration_en') or ''
                sd['imagePrompt'] = sd.get('image_prompt_en') or ''
                sd['prompt'] = sd.get('image_prompt_en') or ''
            scenes_list.append(sd)

        # 모든 중첩 객체를 안전하게 변환
        status_dict = to_dict_safe(self.status)
        # Status가 dict가 아닌 경우 기본값으로 변환
        if not isinstance(status_dict, dict):
            status_dict = {
                'script': getattr(self.status, 'script', 'pending') if hasattr(self.status, 'script') else 'pending',
                'images': getattr(self.status, 'images', 'pending') if hasattr(self.status, 'images') else 'pending',
                'tts': getattr(self.status, 'tts', 'pending') if hasattr(self.status, 'tts') else 'pending',
                'render': getattr(self.status, 'render', 'pending') if hasattr(self.status, 'render') else 'pending',
                'archived': getattr(self.status, 'archived', False) if hasattr(self.status, 'archived') else False,
                'isPinned': getattr(self.status, 'isPinned', False) if hasattr(self.status, 'isPinned') else False,
                'lastOpenedAt': getattr(self.status, 'lastOpenedAt', None) if hasattr(self.status, 'lastOpenedAt') else None,
            }

        # characters 처리 (description 매핑)
        chars = []
        for c in self.characters:
            cd = to_dict_safe(c)
            if isinstance(cd, dict):
                val = cd.get('desc_en') or cd.get('description') or ''
                cd['description'] = val
                cd['desc_en'] = val
            chars.append(cd)

        return {
            'id': self.id,
            'createdAt': self.createdAt,
            'created_at': self.createdAt,
            'updatedAt': self.updatedAt,
            'updated_at': self.updatedAt,
            'topic': self.topic,
            'name': getattr(self, 'name', self.topic) or self.topic,
            'provider': self.provider,
            'aspectRatio': self.aspectRatio,
            'blueprint': self.blueprint,
            'script': self.script,
            'characters': chars,
            'scenes': scenes_list,
            'thumbnail': to_dict_safe(self.thumbnail),
            'settings': to_dict_safe(self.settings),
            'status': status_dict,
            'lastRun': to_dict_safe(self.lastRun),
        }
    
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Project':
        """딕셔너리에서 프로젝트 생성"""
        characters = []
        for c in data.get('characters', []):
            c_copy = dict(c)
            if 'description' in c_copy:
                if not c_copy.get('desc_en'):
                    c_copy['desc_en'] = c_copy.get('description')
                del c_copy['description']
            characters.append(Character(**c_copy))
            
        scenes = []
        for s in data.get('scenes', []):
            # accept legacy `text` key and map to `narration_ko`
            s_copy = dict(s)
            if 'text' in s_copy:
                if not s_copy.get('narration_ko'):
                    s_copy['narration_ko'] = s_copy.get('text')
                # remove legacy key to avoid unexpected kwargs
                del s_copy['text']
            
            # map frontend camelCase to backend snake_case
            if 'duration' in s_copy:
                if not s_copy.get('durationSec'):
                    s_copy['durationSec'] = s_copy.get('duration')
                del s_copy['duration']
            
            if 'imagePrompt' in s_copy:
                if not s_copy.get('image_prompt_en'):
                    s_copy['image_prompt_en'] = s_copy.get('imagePrompt')
                del s_copy['imagePrompt']

            # Remove 'prompt' alias if present (frontend compat)
            if 'prompt' in s_copy:
                if not s_copy.get('image_prompt_en'):
                    s_copy['image_prompt_en'] = s_copy.get('prompt')
                del s_copy['prompt']

            # Filter out unknown fields to avoid TypeError on Scene(**s_copy)
            valid_fields = {f.name for f in Scene.__dataclass_fields__.values()}
            s_filtered = {k: v for k, v in s_copy.items() if k in valid_fields}
            scenes.append(Scene(**s_filtered))
        thumbnail_data = data.get('thumbnail', {})
        thumbnail = Thumbnail(**thumbnail_data) if thumbnail_data else Thumbnail()
        
        settings_data = data.get('settings', {})
        video = VideoSettings(**settings_data.get('video', {})) if 'video' in settings_data else VideoSettings()
        tts = TTSSettings(**settings_data.get('tts', {})) if 'tts' in settings_data else TTSSettings()
        bgm = BGMSettings(**settings_data.get('bgm', {})) if 'bgm' in settings_data else BGMSettings()
        subtitles = settings_data.get('subtitles', {'enabled': False})
        settings = Settings(video=video, tts=tts, bgm=bgm, subtitles=subtitles)
        
        status_data = data.get('status', {})
        # Status가 dict인 경우 dataclass 인스턴스로 변환
        if isinstance(status_data, dict):
            status = Status(**status_data)
        elif isinstance(status_data, Status):
            status = status_data
        else:
            status = Status()
        
        lastrun_data = data.get('lastRun', {})
        lastrun = LastRun(**lastrun_data) if lastrun_data else LastRun()
        
        # accept legacy `name` field by mapping to `topic` when present
        topic_val = data.get('topic', data.get('name', ''))

        return Project(
            id=data['id'],
            createdAt=data['createdAt'],
            updatedAt=data['updatedAt'],
            topic=topic_val,
            provider=data.get('provider', 'imagen4'),
            aspectRatio=data.get('aspectRatio', '16:9'),
            blueprint=data.get('blueprint', {}),
            script=data.get('script', ''),
            characters=characters,
            scenes=scenes,
            thumbnail=thumbnail,
            settings=settings,
            status=status,
            lastRun=lastrun,
        )
