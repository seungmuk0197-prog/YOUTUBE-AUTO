"""프로젝트 파일 관리 및 I/O"""
# UTF-8 인코딩 강제 설정 (Windows cp949 오류 방지)
import sys
import io
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
import os
os.environ['PYTHONIOENCODING'] = 'utf-8'

import json
import shutil
import re
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List
from .models import Project, Scene, Character
import uuid
from src.common.logger import logger


def create_title_slug(title: str) -> str:
    """제목을 폴더명용 slug로 변환"""
    if not title or not title.strip():
        return "untitled"
    
    # 한글/영문/숫자/공백/하이픈만 허용, 나머지 제거
    slug = re.sub(r'[^\w\s가-힣\-]', '', title)
    # 공백을 언더스코어로 변경
    slug = re.sub(r'\s+', '_', slug)
    # 연속된 언더스코어를 하나로
    slug = re.sub(r'_+', '_', slug)
    # 앞뒤 언더스코어 제거
    slug = slug.strip('_')
    
    # 길이 제한 (30~40자)
    if len(slug) > 40:
        slug = slug[:40]
    
    # 빈 값이면 기본값
    if not slug:
        slug = "untitled"
    
    return slug


class ProjectManager:
    """프로젝트 데이터 관리자"""
    
    def __init__(self, projects_root: str = "projects"):
        self.projects_root = Path(projects_root)
        self.projects_root.mkdir(parents=True, exist_ok=True)

    def _is_legacy_dir(self, folder_name: str) -> bool:
        return folder_name.endswith("_legacy") or "_legacy_" in folder_name

    def _project_id_from_folder_name(self, folder_name: str) -> Optional[str]:
        if self._is_legacy_dir(folder_name):
            return None
        m = re.match(r'^(p_\d{8}_\d{6}_[0-9a-fA-F]{4})(?:__.*)?$', folder_name)
        if m:
            return m.group(1)
        return None

    def _folder_has_project_json(self, folder: Path, project_id: Optional[str] = None) -> bool:
        json_path = folder / "project.json"
        if not json_path.exists():
            return False
        if not project_id:
            return True
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data.get('id') == project_id
        except Exception:
            return False

    def canonical_project_dir(self, project_id: str) -> Path:
        """Canonical directory rule:
        1) use project_id__slug folder if exists
        2) otherwise use project_id folder
        """
        slug_dirs: List[Path] = []
        for folder in self.projects_root.iterdir():
            if not folder.is_dir() or self._is_legacy_dir(folder.name):
                continue
            if folder.name.startswith(f"{project_id}__"):
                slug_dirs.append(folder)

        if slug_dirs:
            # Prefer slug folder whose project.json id matches the project_id.
            valid_slug_dirs = [d for d in slug_dirs if self._folder_has_project_json(d, project_id)]
            if valid_slug_dirs:
                return sorted(valid_slug_dirs, key=lambda p: p.stat().st_mtime, reverse=True)[0]
            return sorted(slug_dirs, key=lambda p: p.stat().st_mtime, reverse=True)[0]

        return self.projects_root / project_id

    def canonicalProjectDir(self, project_id: str) -> Path:
        """CamelCase alias for compatibility with migration tasks/docs."""
        return self.canonical_project_dir(project_id)

    def get_project_dir(self, project_id: str) -> Path:
        """Public accessor for project directory used by all load/save paths."""
        return self.canonical_project_dir(project_id)

    def getProjectDir(self, project_id: str) -> Path:
        """CamelCase alias for compatibility with migration tasks/docs."""
        return self.get_project_dir(project_id)
    
    def _find_project_folder(self, project_id: str) -> Optional[Path]:
        """project_id로 실제 폴더 찾기 (folderName 또는 project_id 기반)"""
        folder = self.get_project_dir(project_id)
        if folder.exists():
            return folder
        return None
    
    def _get_project_path(self, project_id: str) -> Path:
        """프로젝트 디렉토리 경로 (folderName 또는 project_id 기반)"""
        return self.get_project_dir(project_id)
    
    def _get_project_json_path(self, project_id: str) -> Path:
        """project.json 파일 경로"""
        return self._get_project_path(project_id) / "project.json"
    
    def _get_title_txt_path(self, project_id: str) -> Path:
        """TITLE.txt 파일 경로"""
        return self._get_project_path(project_id) / "TITLE.txt"
    
    def _write_title_txt(self, project_id: str, title: str, updated_at: str):
        """TITLE.txt 파일 생성/갱신 (UTF-8 인코딩)"""
        title_txt_path = self._get_title_txt_path(project_id)
        try:
            # UTF-8로 명시적으로 저장 (이모지/한글 지원)
            # title과 updated_at을 UTF-8로 인코딩하여 안전하게 저장
            title_utf8 = title.encode('utf-8', errors='replace').decode('utf-8')
            updated_at_utf8 = updated_at.encode('utf-8', errors='replace').decode('utf-8')
            
            with open(title_txt_path, 'w', encoding='utf-8', errors='replace') as f:
                f.write(f"{title_utf8}\n")
                f.write(f"{updated_at_utf8}\n")
        except UnicodeEncodeError as e:
            logger.error(f"UnicodeEncodeError writing TITLE.txt for {project_id}: {e}")
            # 이모지 제거 후 재시도
            try:
                import re
                emoji_pattern = re.compile("["
                    "\U0001F600-\U0001F64F"  # emoticons
                    "\U0001F300-\U0001F5FF"  # symbols & pictographs
                    "\U0001F680-\U0001F6FF"  # transport & map
                    "\U0001F700-\U0001F77F"
                    "\U0001F780-\U0001F7FF"
                    "\U0001F800-\U0001F8FF"
                    "\U0001F900-\U0001F9FF"
                    "\U0001FA00-\U0001FA6F"
                    "\U0001FA70-\U0001FAFF"
                    "\u2600-\u26FF"          # misc symbols
                    "\u2700-\u27BF"          # dingbats
                    "]+", flags=re.UNICODE)
                title_no_emoji = emoji_pattern.sub('', title)
                with open(title_txt_path, 'w', encoding='utf-8') as f:
                    f.write(f"{title_no_emoji}\n")
                    f.write(f"{updated_at}\n")
                logger.info(f"TITLE.txt written without emoji for {project_id}")
            except Exception as e2:
                logger.error(f"Failed to write TITLE.txt (fallback) for {project_id}: {e2}")
        except Exception as e:
            logger.warning(f"Failed to write TITLE.txt for {project_id}: {e}")
    
    def _ensure_project_dirs(self, project_dir: Path):
        """프로젝트 디렉토리 생성"""
        (project_dir / "assets" / "images").mkdir(parents=True, exist_ok=True)
        (project_dir / "assets" / "audio").mkdir(parents=True, exist_ok=True)
        (project_dir / "assets" / "bgm").mkdir(parents=True, exist_ok=True)
        (project_dir / "assets" / "thumbnails").mkdir(parents=True, exist_ok=True)
        (project_dir / "renders").mkdir(parents=True, exist_ok=True)
        (project_dir / "logs").mkdir(parents=True, exist_ok=True)
        (project_dir / "exports").mkdir(parents=True, exist_ok=True)
    
    def create_project(self, topic: str = "", provider: str = "imagen4", aspect_ratio: str = "16:9") -> 'Project':
        """새 프로젝트 생성"""
        project_id = f"p_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:4]}"
        # use timezone-aware ISO format for better JS parsing
        now = datetime.now().astimezone().isoformat()
        
        # titleSlug 생성 (생성 시점 제목으로 1회만 결정)
        title_slug = create_title_slug(topic)
        folder_name = f"{project_id}__{title_slug}"
        
        project = Project(
            id=project_id,
            createdAt=now,
            updatedAt=now,
            topic=topic,
            provider=provider,
            aspectRatio=aspect_ratio,
            characters=[
                Character(id="narrator", name="내레이터(멘토)", desc_ko="", desc_en=""),
                Character(id="main", name="주인공", desc_ko="", desc_en=""),
            ],
            scenes=[],
        )
        
        # 폴더 생성
        project_dir = self.projects_root / folder_name
        self._ensure_project_dirs(project_dir)
        
        # project.json에 folderName 저장
        project_dict = project.to_dict()
        project_dict['folderName'] = folder_name
        project_dict['title'] = topic or '새로운 프로젝트'
        
        json_path = project_dir / "project.json"
        try:
            # UTF-8로 명시적으로 저장 (이모지/한글 지원)
            with open(json_path, 'w', encoding='utf-8', errors='replace') as f:
                json.dump(project_dict, f, indent=2, ensure_ascii=False)
        except (UnicodeEncodeError, UnicodeDecodeError) as e:
            logger.error(f"Unicode error writing project.json for {project_id}: {e}")
            # 이모지 제거 후 재시도
            import re
            emoji_pattern = re.compile("["
                "\U0001F600-\U0001F64F"  # emoticons
                "\U0001F300-\U0001F5FF"  # symbols & pictographs
                "\U0001F680-\U0001F6FF"  # transport & map
                "\U0001F700-\U0001F77F"
                "\U0001F780-\U0001F7FF"
                "\U0001F800-\U0001F8FF"
                "\U0001F900-\U0001F9FF"
                "\U0001FA00-\U0001FA6F"
                "\U0001FA70-\U0001FAFF"
                "\u2600-\u26FF"          # misc symbols
                "\u2700-\u27BF"          # dingbats
                "]+", flags=re.UNICODE)
            # 딕셔너리의 모든 문자열 값에서 이모지 제거
            def remove_emoji_from_dict(d):
                if isinstance(d, dict):
                    return {k: remove_emoji_from_dict(v) for k, v in d.items()}
                elif isinstance(d, list):
                    return [remove_emoji_from_dict(item) for item in d]
                elif isinstance(d, str):
                    return emoji_pattern.sub('', d)
                return d
            project_dict_no_emoji = remove_emoji_from_dict(project_dict)
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(project_dict_no_emoji, f, indent=2, ensure_ascii=False)
            logger.info(f"project.json written without emoji for {project_id}")
        
        # TITLE.txt 생성
        self._write_title_txt(project_id, project_dict['title'], now)
        
        return project
    
    def _save_project_json(self, project_id: str, project: Project):
        """project.json 저장"""
        json_path = self._get_project_json_path(project_id)
        data = project.to_dict()
        
        # folderName 유지 (기존 값이 있으면 유지, 없으면 project_id 사용)
        if 'folderName' not in data:
            # 기존 project.json에서 folderName 읽기 시도
            try:
                if json_path.exists():
                    with open(json_path, 'r', encoding='utf-8') as f:
                        existing_data = json.load(f)
                        if 'folderName' in existing_data:
                            data['folderName'] = existing_data['folderName']
            except:
                pass
            
            # 여전히 없으면 project_id 사용 (기존 프로젝트 호환성)
            if 'folderName' not in data:
                data['folderName'] = project_id
        
        try:
            with open(json_path, 'w', encoding='utf-8', errors='replace') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except (UnicodeEncodeError, UnicodeDecodeError) as e:
            logger.error(f"Unicode error in _save_project_json for {project_id}: {e}")
            # 이모지 제거 후 재시도
            import re
            emoji_pattern = re.compile("["
                "\U0001F600-\U0001F64F"
                "\U0001F300-\U0001F5FF"
                "\U0001F680-\U0001F6FF"
                "\U0001F700-\U0001F77F"
                "\U0001F780-\U0001F7FF"
                "\U0001F800-\U0001F8FF"
                "\U0001F900-\U0001F9FF"
                "\U0001FA00-\U0001FA6F"
                "\U0001FA70-\U0001FAFF"
                "\u2600-\u26FF"
                "\u2700-\u27BF"
                "]+", flags=re.UNICODE)
            def remove_emoji_from_dict(d):
                if isinstance(d, dict):
                    return {k: remove_emoji_from_dict(v) for k, v in d.items()}
                elif isinstance(d, list):
                    return [remove_emoji_from_dict(item) for item in d]
                elif isinstance(d, str):
                    return emoji_pattern.sub('', d)
                return d
            data_no_emoji = remove_emoji_from_dict(data)
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data_no_emoji, f, indent=2, ensure_ascii=False)
            logger.info(f"project.json saved without emoji for {project_id}")
    
    def get_project(self, project_id: str) -> Optional[Project]:
        """프로젝트 로드"""
        json_path = self._get_project_json_path(project_id)
        if not json_path.exists():
            return None
        
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return Project.from_dict(data)
    
    def save_project(self, project: Project) -> bool:
        """프로젝트 전체 저장"""
        try:
            self._ensure_project_dirs(self.get_project_dir(project.id))
            self._save_project_json(project.id, project)
            return True
        except Exception as e:
            print(f"Error saving project: {e}")
            return False
    
    def update_project_partial(self, project_id: str, updates: Dict[str, Any]) -> Optional[Project]:
        """프로젝트 부분 업데이트"""
        project = self.get_project(project_id)
        if not project:
            return None
        
        # status 하위 필드 (isPinned 등) 처리
        if 'isPinned' in updates:
            if hasattr(project, 'status') and project.status is not None:
                project.status.isPinned = bool(updates['isPinned'])
            updates = {k: v for k, v in updates.items() if k != 'isPinned'}
        # 간단한 업데이트 (복잡한 경우 추가 로직 필요)
        for key, value in updates.items():
            if hasattr(project, key):
                # 중첩된 객체 업데이트 (예: status.archived)
                if '.' in key:
                    parts = key.split('.')
                    obj = project
                    for part in parts[:-1]:
                        if not hasattr(obj, part):
                            break
                        obj = getattr(obj, part)
                    if hasattr(obj, parts[-1]):
                        setattr(obj, parts[-1], value)
                else:
                    setattr(project, key, value)
        
        project.updatedAt = datetime.now().astimezone().isoformat()
        self.save_project(project)
        return project
    
    def delete_project(self, project_id: str) -> bool:
        """프로젝트 삭제"""
        try:
            project_path = self._get_project_path(project_id)
            if project_path.exists():
                shutil.rmtree(project_path)
                return True
            return False
        except Exception as e:
            print(f"Error deleting project: {e}")
            return False
    
    def list_projects(self) -> list:
        """모든 프로젝트 목록"""
        projects = []
        for project_id in self.list_project_ids():
            project = self.get_project(project_id)
            if project:
                projects.append(project)
        return sorted(projects, key=lambda p: p.updatedAt, reverse=True)

    def list_project_ids(self) -> List[str]:
        """Collect unique project ids from non-legacy project.json files."""
        ids = set()
        for project_dir in self.projects_root.iterdir():
            if not project_dir.is_dir() or self._is_legacy_dir(project_dir.name):
                continue
            json_path = project_dir / "project.json"
            if not json_path.exists():
                continue
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                project_id = data.get('id') or self._project_id_from_folder_name(project_dir.name)
                if project_id:
                    ids.add(project_id)
            except Exception:
                continue
        return sorted(ids)

    def _choose_primary_folder(self, project_id: str, folders: List[Path]) -> Path:
        with_json = [f for f in folders if self._folder_has_project_json(f)]
        if with_json:
            # Prefer canonical folder among project.json holders.
            canonical = self.canonical_project_dir(project_id)
            if canonical in with_json:
                return canonical
            with_json.sort(key=lambda p: p.stat().st_mtime, reverse=True)
            return with_json[0]
        return self.canonical_project_dir(project_id)

    def _merge_folder_tree(self, source: Path, target: Path) -> Dict[str, int]:
        copied = 0
        replaced = 0
        skipped = 0
        for src in source.rglob('*'):
            if src.is_dir():
                continue
            rel = src.relative_to(source)
            # Keep primary project.json as source of truth.
            if rel.as_posix() == 'project.json':
                skipped += 1
                continue
            dst = target / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            if not dst.exists():
                shutil.copy2(src, dst)
                copied += 1
                continue
            if src.stat().st_mtime > dst.stat().st_mtime:
                shutil.copy2(src, dst)
                replaced += 1
            else:
                skipped += 1
        return {'copied': copied, 'replaced': replaced, 'skipped': skipped}

    def _next_legacy_path(self, folder: Path) -> Path:
        candidate = folder.with_name(f"{folder.name}_legacy")
        if not candidate.exists():
            return candidate
        stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        idx = 1
        while True:
            candidate = folder.with_name(f"{folder.name}_legacy_{stamp}_{idx}")
            if not candidate.exists():
                return candidate
            idx += 1

    def migrate_duplicate_projects(self) -> Dict[str, Any]:
        """Merge duplicated {project_id, project_id__slug} folders without data loss.
        - Select primary folder by project.json presence.
        - Merge files from secondary folders into primary.
        - On conflict keep newer modified file.
        - Rename secondary folder to *_legacy (no deletion).
        """
        by_project: Dict[str, List[Path]] = {}
        for folder in self.projects_root.iterdir():
            if not folder.is_dir() or self._is_legacy_dir(folder.name):
                continue
            project_id = self._project_id_from_folder_name(folder.name)
            if not project_id:
                json_path = folder / "project.json"
                if not json_path.exists():
                    continue
                try:
                    with open(json_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    project_id = data.get('id')
                except Exception:
                    project_id = None
            if not project_id:
                continue
            by_project.setdefault(project_id, []).append(folder)

        result = {
            'projectsScanned': len(by_project),
            'duplicatesFound': 0,
            'foldersRenamed': 0,
            'filesCopied': 0,
            'filesReplaced': 0,
            'filesSkipped': 0,
            'details': [],
        }

        for project_id, folders in by_project.items():
            if len(folders) < 2:
                continue
            result['duplicatesFound'] += 1
            primary = self._choose_primary_folder(project_id, folders)
            secondary_folders = [f for f in folders if f != primary]
            detail = {'projectId': project_id, 'primary': primary.name, 'merged': [], 'renamed': []}

            for secondary in secondary_folders:
                merged = self._merge_folder_tree(secondary, primary)
                legacy_path = self._next_legacy_path(secondary)
                secondary.rename(legacy_path)
                result['foldersRenamed'] += 1
                result['filesCopied'] += merged['copied']
                result['filesReplaced'] += merged['replaced']
                result['filesSkipped'] += merged['skipped']
                detail['merged'].append({'from': secondary.name, **merged})
                detail['renamed'].append({'from': secondary.name, 'to': legacy_path.name})

            result['details'].append(detail)

        return result
    
    def get_project_asset_path(self, project_id: str, asset_type: str, filename: str) -> Path:
        """프로젝트 자산 경로"""
        # asset_type: images, audio, bgm, thumbnails
        return self._get_project_path(project_id) / "assets" / asset_type / filename
    
    def get_project_render_path(self, project_id: str, filename: str) -> Path:
        """렌더 결과 경로"""
        return self._get_project_path(project_id) / "renders" / filename
    
    def get_project_export_path(self, project_id: str, filename: str) -> Path:
        """export 파일 경로"""
        return self._get_project_path(project_id) / "exports" / filename
