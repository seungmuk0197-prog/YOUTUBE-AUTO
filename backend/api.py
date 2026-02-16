"""Flask API 서버 - 프로젝트 편집 백엔드"""
# UTF-8 인코딩 강제 설정 (Windows cp949 오류 방지)
import sys
import io
# if sys.platform == 'win32':
#     sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
#     sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
import os
os.environ['PYTHONIOENCODING'] = 'utf-8'

from flask import Flask, jsonify, request, send_file, abort
from flask_cors import CORS
from pathlib import Path
from datetime import datetime
from typing import Dict, Any
import json
from uuid import uuid4
from PIL import Image, ImageDraw, ImageFont
import openai
import requests

from dotenv import load_dotenv
import hashlib

# 프로젝트 루트 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# .env 로드
load_dotenv(project_root / ".env")

from backend.project_manager import ProjectManager
from backend.models import Project, Scene
from src.common.logger import logger
from src.video.tts import generate_tts, get_audio_duration
from src.video.render import render_video_simple
from src.video.srt import format_timestamp, split_sentences_ko, write_srt
import mimetypes

app = Flask(__name__)

# CORS 모든 origin 허용
CORS(app, 
     origins='*',
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
     supports_credentials=False)

# 프로젝트 매니저 초기화
pm = ProjectManager(projects_root=str(project_root / "projects"))
try:
    migration_result = pm.migrate_duplicate_projects()
    logger.info(
        "[MIGRATION] duplicate project dirs: scanned=%s duplicates=%s renamed=%s copied=%s replaced=%s skipped=%s",
        migration_result.get('projectsScanned'),
        migration_result.get('duplicatesFound'),
        migration_result.get('foldersRenamed'),
        migration_result.get('filesCopied'),
        migration_result.get('filesReplaced'),
        migration_result.get('filesSkipped'),
    )
except Exception as migration_error:
    logger.error(f"[MIGRATION] duplicate project dir migration failed: {migration_error}")

# --------------------------------------------
# IMAGE STYLES (Synced with Frontend)
# --------------------------------------------
IMAGE_STYLES = [
    { "id": 'basic', "name": '기본 설정', "desc": '자연스럽고 기본 스타일' },
    { "id": '50s-movie', "name": '50년대 영화', "desc": '테크니컬러, 편안한 조명' },
    { "id": 'joseon-drama', "name": '조선시대 사극', "desc": '전통적 건축/의복, 자연광 활용' },
    { "id": 'north-drama', "name": '북국 드라마', "desc": '영화 스케일, 장엄한 디자인과 구도' },
    { "id": 'mystery', "name": '미스테리 스릴러', "desc": '저조도, 명암비, 짙은 그림자' },
    { "id": 'noir', "name": '느와르/서스펜스', "desc": '어두운 조명, 음산한 분위기' },
    { "id": 'silent-film', "name": '20년대 무성영화', "desc": '흑백, 콘트라스트, 빈티지 필름' },
    { "id": 'romcom', "name": '90년대 롬코디', "desc": 'VHS 화질, 단색 및 원색 톤' },
    { "id": 'modern', "name": '현대 드라마', "desc": '비비드한 색감, 부드러운 조명' },
    { "id": 'melo', "name": '멜로 드라마', "desc": '부드러운 콘트라스트, 따스하고 화사한 스타일' },
    { "id": 'documentary', "name": '다큐멘터리', "desc": '사실적인 묘사와 실제 사진, 현장감' },
    { "id": 'cyberpunk', "name": '사이버펑크 네온', "desc": '네온 색상, 미래적인 분위기' },
    { "id": 'webtoon', "name": '디지털 웹툰', "desc": '셀쉐이딩 라인과 화려한 디자인' },
    { "id": 'sketch', "name": '흑백 스케치북', "desc": '연필 드로잉이 살아있는 스케치' },
    { "id": 'oriental-painting', "name": '동양 수묵화', "desc": '여백의 미가 살아있는 먹물 그림' },
    { "id": 'neon-city', "name": '네온시티팝', "desc": '80년대 레트로 퓨처, 화려한 야경' },
    { "id": 'illustration', "name": '그냥 삽화', "desc": '성경 삽화풍, 고대 인물론 실사풍' },
    { "id": 'cute-character', "name": '귀여운 동물 캐릭터', "desc": '3D 애니메이션 스타일' }
]

def get_style_prompt(style_id):
    """스타일 ID로 프롬프트 찾기"""
    for style in IMAGE_STYLES:
        if style['id'] == style_id:
            return style['desc']
    return None

def clamp_prompt_server(p, fallback=""):
    """프롬프트를 안전한 길이로 클램프 (DALL-E 3 제한 방지)"""
    import re
    MAX = 900
    p = (p or "").replace("\n", " ").replace("\r", " ").strip()
    # 연속 공백 제거
    p = re.sub(r'\s+', ' ', p)
    # 반복 수식어 제거 (첫 등장만 유지)
    for phrase in ["professional photography", "high quality", "vibrant colors",
                    "well-lit", "sharp focus", "detailed", "clean composition",
                    "modern aesthetic", "engaging visual", "16:9 aspect ratio"]:
        parts = re.split(re.escape(phrase), p, flags=re.IGNORECASE)
        if len(parts) > 2:
            p = parts[0] + phrase + "".join(parts[2:])
    p = re.sub(r'\s+', ' ', p).strip()
    p = re.sub(r',\s*,+', ',', p).strip(',').strip()
    if not p:
        p = ("simple scene: " + (fallback or ""))[:80]
    return p[:MAX]


def format_characters_prompt(characters):
    """캐릭터 리스트를 프롬프트 블록으로 변환"""
    if not characters or not isinstance(characters, list):
        return ""
    
    prompt_lines = ["\n[Characters]"]
    for char in characters:
        name = char.get('name', 'Unknown')
        role = char.get('role', '')
        desc = char.get('description', '')
        prompt_lines.append(f"- {name} ({role}): {desc}")
    
    return "\n".join(prompt_lines)

# --------------------------------------------
# Secure file serving helpers
# --------------------------------------------
def _validate_and_resolve_path(project_id: str, relative_path: str):
    """Validate a user-supplied relative path and resolve to an absolute Path inside the project.

    Raises ValueError for invalid input, FileNotFoundError if missing.
    """
    if not relative_path:
        raise ValueError('path is required')

    # reject absolute or drive paths
    if relative_path.startswith('/') or relative_path.startswith('\\'):
        raise ValueError('absolute paths are not allowed')
    if ':' in relative_path:
        # reject windows drive letters like C:\
        raise ValueError('invalid path')

    # normalize and prevent traversal
    rel = Path(relative_path)
    if rel.is_absolute():
        raise ValueError('absolute paths are not allowed')

    project_root_path = pm.get_project_dir(project_id)
    if not project_root_path.exists():
        raise FileNotFoundError('project not found')

    full = (project_root_path / rel).resolve()
    root = project_root_path.resolve()

    # ensure resolved path is within project root
    if os.path.commonpath([str(full), str(root)]) != str(root):
        raise ValueError('path points outside project')

    # optional whitelist for top-level folders
    norm = str(rel.as_posix()).lstrip('./')
    allowed_prefixes = [
        'assets/audio/', 'assets/images/', 'assets/subtitles/', 'assets/bgm/', 'assets/thumbnails/',
        'renders/', 'exports/'
    ]
    if not any(norm.startswith(p) for p in allowed_prefixes):
        raise ValueError('path not allowed')

    if not full.exists() or not full.is_file():
        raise FileNotFoundError('file not found')

    return full



# ============================================
# STATIC FILES & ROOT ENDPOINTS
# ============================================

@app.route('/', methods=['GET'])
def serve_index():
    """메인 페이지 제공"""
    index_path = project_root / 'index.html'
    if index_path.exists():
        return send_file(str(index_path), mimetype='text/html')
    return jsonify({'error': 'index.html not found'}), 404



@app.route('/project.html', methods=['GET'])
def serve_project():
    """프로젝트 편집 페이지 제공"""
    project_path = project_root / 'project.html'
    if project_path.exists():
        return send_file(str(project_path), mimetype='text/html')
    return jsonify({'error': 'project.html not found'}), 404


@app.route('/api/projects/<project_id>/files/<path:file_path>', methods=['GET'])
def serve_project_file(project_id, file_path):
    """프로젝트 내 파일 제공 (Secure)"""
    try:
        full_path = _validate_and_resolve_path(project_id, file_path)
        return send_file(str(full_path))
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except FileNotFoundError:
        return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        logger.error(f"File serve error: {e}")
        # 404로 처리하여 불필요한 에러 노출 방지
        return jsonify({'error': 'File not found'}), 404


# ============================================
# UTILITY ENDPOINTS
# ============================================

@app.route('/api/health', methods=['GET'])
def health():
    """헬스 체크"""
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()}), 200


# ============================================
# PROJECT CRUD ENDPOINTS
# ============================================

@app.route('/api/projects/from-topic', methods=['POST'])
def create_project_from_topic():
    """주제추천 확정 시 프로젝트 생성 (단일 진실 소스)"""
    request_id = request.headers.get('X-Request-Id', 'N/A')
    print(f"REQ POST {request.path} rid={request_id}")
    
    try:
        data = request.get_json() or {}
        print(f"REQ_BODY data={data} rid={request_id}")
        
        # title 필수 (주제추천에서 확정된 제목)
        title = data.get('title', '').strip()
        if not title:
            return jsonify({
                'ok': False,
                'error': 'title is required'
            }), 400
        
        topic_data = data.get('topicData', {})
        
        # 프로젝트 생성 (title을 topic으로 사용)
        project = pm.create_project(
            topic=title,
            provider=data.get('provider', 'imagen4'),
            aspect_ratio=data.get('aspectRatio', '16:9')
        )
        
        logger.info(f"프로젝트 생성 (from-topic): {project.id}, title: {title}")
        print(f"CREATE_FROM_TOPIC_SUCCESS projectId={project.id} title={title} rid={request_id}")
        
        # 프로젝트 생성 후 즉시 메타 보정하여 title 필드 설정
        meta = reconcile_and_persist_meta(project.id, force=True)
        
        # 프로젝트 다시 로드하여 최신 메타 포함
        project = pm.get_project(project.id)
        project_dict = project.to_dict()
        
        # 메타 필드 추가
        if meta:
            project_dict.update({
                'title': meta.get('title') or title,
                'hasScript': meta['hasScript'],
                'hasScenesJson': meta['hasScenesJson'],
                'scenesCount': meta['scenesCount'],
                'imagesCount': meta['imagesCount'],
                'previewImageUrl': meta['previewImageUrl'],
                'status': meta['status'],
            })
        
        # folderName 포함
        json_path = pm._get_project_json_path(project.id)
        if json_path.exists():
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    json_data = json.load(f)
                    project_dict['folderName'] = json_data.get('folderName', project.id)
            except:
                project_dict['folderName'] = project.id
        
        print(f"CREATE_FROM_TOPIC_RESPONSE projectId={project.id} title={project_dict.get('title')} folderName={project_dict.get('folderName')} rid={request_id}")
        
        return jsonify({
            'ok': True,
            'project': project_dict
        }), 201
    except Exception as e:
        print(f"CREATE_FROM_TOPIC_ERROR error={e} rid={request_id}")
        logger.error(f"프로젝트 생성 실패 (from-topic): {e}")
        import traceback
        logger.error(f"[API] Error stack: {traceback.format_exc()}")
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/title-suggestions', methods=['POST'])
def generate_title_suggestions():
    """주제를 분석하여 15개의 제목 후보 생성 (프로젝트 생성 없음)"""
    request_id = request.headers.get('X-Request-Id', 'N/A')
    print(f"REQ POST {request.path} rid={request_id}")
    
    try:
        data = request.get_json() or {}
        topic = data.get('topic', '').strip()
        
        # keep the original keyword handy for enforcing its presence later
        topic_keyword = topic
        lower_topic_keyword = topic_keyword.lower()

        def ensure_topic_in_title(raw):
            title = (raw or '').strip()
            if not title or not topic_keyword:
                return title or topic_keyword
            if lower_topic_keyword in title.lower():
                return title
            return f"{topic_keyword} {title}"
        
        if not topic:
            return jsonify({
                'ok': False,
                'error': 'topic is required'
            }), 400
        
        print(f"TITLE_SUGGESTIONS_REQUEST topic={topic} rid={request_id}")
        
        # OpenAI API Key Check
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            logger.error("OPENAI_API_KEY not found in environment variables")
            return jsonify({'ok': False, 'error': 'OPENAI_API_KEY not found'}), 500
        
        client = openai.OpenAI(api_key=api_key)
        
        # 제목 제안 프롬프트
        system_prompt = """You are a YouTube content title expert. Generate 15 engaging, click-worthy titles in Korean for the given topic.
        
Rules:
- Each title should be 20-40 characters long
- Use numbers, questions, or intriguing statements to increase click-through rate
- Make titles specific and actionable
- Avoid clickbait that doesn't deliver value
- Return ONLY the titles, one per line, without numbering or bullet points
- Do not add any explanations or extra text"""
        
        user_prompt = f"""다음 주제에 대한 YouTube 영상 제목 15개를 생성해주세요:

주제: {topic}

각 제목은 한 줄씩 작성하고, 번호나 기호 없이 제목만 나열해주세요."""
        
        # OpenAI API 호출 (에러 핸들링 포함)
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.8,
                max_tokens=800
            )
        except openai.APIError as e:
            print(f"TITLE_SUGGESTIONS_ERROR OpenAI API error={e} rid={request_id}")
            logger.error(f"제목 제안 생성 실패 (OpenAI API): {e}")
            error_msg = f"OpenAI API 오류: {str(e)}"
            if "rate limit" in str(e).lower() or "rate_limit" in str(e).lower():
                error_msg = "API 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요."
            elif "invalid_api_key" in str(e).lower() or "authentication" in str(e).lower() or "401" in str(e):
                error_msg = "OpenAI API 키가 유효하지 않습니다. 설정을 확인해주세요."
            elif "insufficient_quota" in str(e).lower() or "quota" in str(e).lower():
                error_msg = "OpenAI API 할당량이 부족합니다. 계정을 확인해주세요."
            return jsonify({'ok': False, 'error': error_msg}), 500
        except openai.APIConnectionError as e:
            print(f"TITLE_SUGGESTIONS_ERROR OpenAI connection error={e} rid={request_id}")
            logger.error(f"제목 제안 생성 실패 (OpenAI 연결): {e}")
            return jsonify({'ok': False, 'error': 'OpenAI 서버에 연결할 수 없습니다. 네트워크를 확인해주세요.'}), 500
        except openai.APITimeoutError as e:
            print(f"TITLE_SUGGESTIONS_ERROR OpenAI timeout error={e} rid={request_id}")
            logger.error(f"제목 제안 생성 실패 (OpenAI 타임아웃): {e}")
            return jsonify({'ok': False, 'error': 'OpenAI API 응답 시간이 초과되었습니다. 다시 시도해주세요.'}), 500
        except openai.OpenAIError as e:
            print(f"TITLE_SUGGESTIONS_ERROR OpenAI error={e} rid={request_id}")
            logger.error(f"제목 제안 생성 실패 (OpenAI): {e}")
            return jsonify({'ok': False, 'error': f'OpenAI 오류: {str(e)}'}), 500
        
        # 응답 검증
        if not response or not response.choices or len(response.choices) == 0:
            raise ValueError("OpenAI API에서 빈 응답을 받았습니다.")
        
        if not response.choices[0].message or not response.choices[0].message.content:
            raise ValueError("OpenAI API 응답에 내용이 없습니다.")
        
        # 응답 파싱: 줄바꿈으로 구분된 제목들 추출
        content = response.choices[0].message.content.strip()
        logger.info(f"OpenAI response content (first 200 chars): {content[:200]}")
        
        # 줄바꿈으로 분리하고, 번호나 기호 제거
        raw_lines = content.split('\n')
        titles = []
        for line in raw_lines:
            line = line.strip()
            if not line:
                continue
            # 번호 제거 (예: "1. ", "1) ", "- ", "• " 등)
            import re
            line = re.sub(r'^[\d\s\.\)\-\•\*]+', '', line).strip()
            if line and len(line) > 5:  # 최소 길이 체크
                titles.append(line)
        
        logger.info(f"Parsed {len(titles)} titles from response")
        titles = [ensure_topic_in_title(t) for t in titles]

        # 15개로 제한 (더 많으면 자르고, 적으면 변형 제목 생성)
        if len(titles) > 15:
            titles = titles[:15]
            logger.info(f"Trimmed to 15 titles")
        elif len(titles) < 15:
            # 부족한 경우 변형 제목 생성
            base_titles = titles.copy()
            original_count = len(titles)
            while len(titles) < 15 and len(base_titles) > 0:
                for base in base_titles:
                    if len(titles) >= 15:
                        break
                    # 간단한 변형 추가
                    variations = [
                        f"최신 {base}",
                        f"{base} 완벽 가이드",
                        f"{base} 궁금증 해결",
                        f"{base} 모든 것",
                        f"{base} 시작하기",
                        f"{base} 알아보기"
                    ]
                    for var in variations:
                        if len(titles) >= 15:
                            break
                        if var not in titles and len(var) <= 50:  # 길이 제한
                            titles.append(var)
            
            # 여전히 부족하면 기본 제목 반복
            if len(titles) < 15:
                while len(titles) < 15:
                    for base in base_titles[:3]:  # 처음 3개만 사용
                        if len(titles) >= 15:
                            break
                        titles.append(base)
            
            logger.info(f"Expanded from {original_count} to {len(titles)} titles")
        
        titles = titles[:15]  # 최종 15개 보장
        
        if len(titles) == 0:
            raise ValueError("제목을 생성할 수 없습니다. 주제를 다시 입력해주세요.")
        
        logger.info(f"제목 제안 생성 완료: {len(titles)}개")
        print(f"TITLE_SUGGESTIONS_SUCCESS count={len(titles)} rid={request_id}")
        
        return jsonify({
            'ok': True,
            'titles': titles
        }), 200

    except ValueError as e:
        print(f"TITLE_SUGGESTIONS_ERROR ValueError={e} rid={request_id}")
        logger.error(f"제목 제안 생성 실패 (값 오류): {e}")
        return jsonify({'ok': False, 'error': str(e)}), 400
    except Exception as e:
        print(f"TITLE_SUGGESTIONS_ERROR Unexpected error={e} rid={request_id}")
        logger.error(f"제목 제안 생성 실패 (예상치 못한 오류): {e}")
        import traceback
        logger.error(f"[API] Error stack: {traceback.format_exc()}")
        # 항상 JSON 응답 반환 보장
        return jsonify({
            'ok': False,
            'error': f'제목 생성 실패: {str(e)}',
            'type': type(e).__name__
        }), 500


@app.route('/api/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    """프로젝트 조회 (메타 보정 후 반환)"""
    try:
        logger.info(f"[API] FETCH PROJECT: {project_id}")
        
        # 메타 보정 및 저장
        meta = reconcile_and_persist_meta(project_id, force=False)
        if not meta:
            logger.warning(f"[API] PROJECT NOT FOUND: {project_id}")
            return jsonify({'ok': False, 'error': 'Project not found'}), 404
        
        project = pm.get_project(project_id)
        if not project:
            # project.json이 없어도 메타만 반환 (script/scenes는 파일에서 보강)
            project_path = pm._get_project_path(project_id)
            out = dict(meta)
            script_path = project_path / "script.txt"
            if script_path.exists() and script_path.stat().st_size > 0:
                try:
                    out['script'] = script_path.read_text(encoding='utf-8')
                except Exception:
                    pass
            scenes_json_path = project_path / "scenes.json"
            if scenes_json_path.exists():
                try:
                    with open(scenes_json_path, 'r', encoding='utf-8') as f:
                        raw = json.load(f)
                    scenes_list = raw if isinstance(raw, list) else raw.get('scenes', [])
                    if scenes_list:
                        out['scenes'] = scenes_list
                except Exception:
                    pass
            return jsonify({
                'ok': True,
                'project': out
            }), 200
        
        project_dict = project.to_dict()
        # 메타 필드로 덮어쓰기 (단일 진실 소스)
        project_dict.update({
            'title': meta.get('title') or project_dict.get('topic') or project_dict.get('name', ''),
            'hasScript': meta['hasScript'],
            'hasScenesJson': meta['hasScenesJson'],
            'scenesCount': meta['scenesCount'],
            'imagesCount': meta['imagesCount'],
            'previewImageUrl': meta['previewImageUrl'],
            'status': meta['status'],
            'archivedAt': meta['archivedAt'],
        })
        
        # project.json에 없어도 script.txt / scenes.json에 있으면 응답에 보강 (데이터 유실 방지)
        project_path = pm._get_project_path(project_id)
        script_path = project_path / "script.txt"
        if (not (project_dict.get('script') or '').strip()) and script_path.exists() and script_path.stat().st_size > 0:
            try:
                project_dict['script'] = script_path.read_text(encoding='utf-8')
                logger.info(f"[API] PROJECT {project_id} script 보강 from script.txt")
            except Exception as e:
                logger.warning(f"[API] script.txt 읽기 실패: {e}")
        scenes_json_path = project_path / "scenes.json"
        if (not project_dict.get('scenes') or len(project_dict.get('scenes', [])) == 0) and scenes_json_path.exists():
            try:
                with open(scenes_json_path, 'r', encoding='utf-8') as f:
                    raw = json.load(f)
                scenes_list = raw if isinstance(raw, list) else raw.get('scenes', [])
                if scenes_list:
                    project_dict['scenes'] = scenes_list
                    project_dict['scenesCount'] = len(scenes_list)
                    project_dict['hasScenesJson'] = True
                    logger.info(f"[API] PROJECT {project_id} scenes 보강 from scenes.json ({len(scenes_list)}개)")
            except Exception as e:
                logger.warning(f"[API] scenes.json 읽기 실패: {e}")
        
        logger.info(f"[API] PROJECT {project_id} 반환 - 제목: {project_dict.get('title') or project_dict.get('topic')}, previewImageUrl: {meta.get('previewImageUrl') or 'None'}")
        
        return jsonify({
            'ok': True,
            'project': project_dict
        }), 200
    except Exception as e:
        logger.error(f"프로젝트 조회 실패: {e}")
        import traceback
        logger.error(f"[API] Error stack: {traceback.format_exc()}")
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/projects/<project_id>', methods=['PUT'])
def update_project(project_id):
    """프로젝트 전체 저장"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'ok': False, 'error': 'No data provided'}), 400
        
        # project.json의 데이터로부터 Project 객체 재구성
        project = Project.from_dict(data)
        
        if pm.save_project(project):
            logger.info(f"프로젝트 저장: {project_id}")
            return jsonify({
                'ok': True,
                'project': project.to_dict()
            }), 200
        else:
            return jsonify({'ok': False, 'error': 'Failed to save'}), 500
    except Exception as e:
        logger.error(f"프로젝트 저장 실패: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/projects/<project_id>', methods=['PATCH'])
def partial_update_project(project_id):
    """프로젝트 부분 업데이트 (title/status 등)"""
    request_id = request.headers.get('X-Request-Id', 'N/A')
    print(f"REQ PATCH {request.path} projectId={project_id} rid={request_id}")
    
    try:
        data = request.get_json() or {}
        print(f"REQ_BODY projectId={project_id} data={data} rid={request_id}")
        
        # 프로젝트 존재 확인 (id로만 조회)
        project = pm.get_project(project_id)
        if not project:
            logger.warning(f"[API] PROJECT NOT FOUND: {project_id}")
            return jsonify({'ok': False, 'error': 'Project not found'}), 404
        
        # project.json 경로 확인
        json_path = pm._get_project_json_path(project_id)
        if not json_path.exists():
            logger.warning(f"[API] project.json NOT FOUND: {json_path}")
            return jsonify({'ok': False, 'error': 'Project metadata not found'}), 404
        print(f"META_PATH projectId={project_id} path={json_path}")
        
        # 표준 필드: archived, pinned (boolean) — id 기반 업데이트만
        if 'archived' in data:
            val = data.pop('archived')
            project.status.archived = bool(val) if not isinstance(val, str) else (val == 'true' or val == 'archived')
            if not pm.save_project(project):
                print(f"SAVE_FAILED projectId={project_id} (archived) rid={request_id}")
                return jsonify({'ok': False, 'error': 'Failed to save project'}), 500
            print(f"PATCH_ARCHIVED projectId={project_id} archived={project.status.archived} rid={request_id}")
        if 'pinned' in data or 'isPinned' in data:
            val = data.get('pinned', data.get('isPinned', False))
            project.status.isPinned = bool(val) if not isinstance(val, str) else (val == 'true' or val == '1')
            data.pop('pinned', None)
            data.pop('isPinned', None)
            if not pm.save_project(project):
                print(f"SAVE_FAILED projectId={project_id} (pinned) rid={request_id}")
                return jsonify({'ok': False, 'error': 'Failed to save project'}), 500
            print(f"PATCH_PINNED projectId={project_id} isPinned={project.status.isPinned} rid={request_id}")
        
        # status 필드 업데이트 처리 (문자열 'archived'/'active' 호환)
        if 'status' in data:
            project = pm.get_project(project_id)
            if not project:
                return jsonify({'ok': False, 'error': 'Project not found'}), 404
            
            # status가 문자열인 경우 (예: "archived", "active")
            if isinstance(data['status'], str):
                status_value = data['status']
                
                # Status 객체가 dataclass 인스턴스인지 확인하고, 아니면 새로 생성
                if not hasattr(project.status, '__dataclass_fields__'):
                    # Status가 dict이거나 다른 타입인 경우 새로 생성
                    from backend.models import Status
                    status_dict = {}
                    if isinstance(project.status, dict):
                        status_dict = project.status
                    elif hasattr(project.status, '__dict__'):
                        status_dict = project.status.__dict__
                    else:
                        status_dict = {
                            'script': getattr(project.status, 'script', 'pending'),
                            'images': getattr(project.status, 'images', 'pending'),
                            'tts': getattr(project.status, 'tts', 'pending'),
                            'render': getattr(project.status, 'render', 'pending'),
                            'archived': getattr(project.status, 'archived', False),
                            'isPinned': getattr(project.status, 'isPinned', False),
                            'lastOpenedAt': getattr(project.status, 'lastOpenedAt', None),
                        }
                    status_dict['archived'] = (status_value == 'archived')
                    project.status = Status(**status_dict)
                else:
                    # Status 객체의 archived 필드 직접 업데이트
                    project.status.archived = (status_value == 'archived')
                
                # status 필드를 data에서 제거 (update_project_partial에서 중복 처리 방지)
                data = {k: v for k, v in data.items() if k != 'status'}
                # status(보관/해제)만 변경된 경우에도 반드시 저장 (아래에서 get_project로 덮어쓰기 전에 반영)
                if not pm.save_project(project):
                    print(f"SAVE_FAILED projectId={project_id} (status update) rid={request_id}")
                    return jsonify({'ok': False, 'error': 'Failed to save project'}), 500
                print(f"SAVE_SUCCESS projectId={project_id} (status={status_value}) rid={request_id}")
        
        # title 업데이트 처리
        title_updated = False
        if 'title' in data:
            new_title = data['title']
            project.topic = new_title
            title_updated = True
            print(f"TITLE_UPDATE projectId={project_id} newTitle={new_title} rid={request_id}")
            
            # 프로젝트 저장 (project.topic 업데이트 반영)
            if not pm.save_project(project):
                print(f"TITLE_SAVE_FAILED projectId={project_id} - save_project returned False rid={request_id}")
                return jsonify({'ok': False, 'error': 'Failed to save project'}), 500
            
            # project.json에도 title 필드 저장
            updated_at = datetime.now().astimezone().isoformat()
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    json_data = json.load(f)
                json_data['title'] = new_title
                json_data['topic'] = new_title  # topic도 함께 업데이트 (호환성)
                json_data['updatedAt'] = updated_at
                # folderName은 절대 변경하지 않음 (중요!)
                try:
                    with open(json_path, 'w', encoding='utf-8', errors='replace') as f:
                        json.dump(json_data, f, indent=2, ensure_ascii=False)
                except (UnicodeEncodeError, UnicodeDecodeError) as e:
                    logger.error(f"Unicode error writing project.json (title update) for {project_id}: {e}")
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
                    json_data_no_emoji = remove_emoji_from_dict(json_data)
                    with open(json_path, 'w', encoding='utf-8') as f:
                        json.dump(json_data_no_emoji, f, indent=2, ensure_ascii=False)
                    logger.info(f"project.json saved without emoji (title update) for {project_id}")
                print(f"TITLE_SAVED projectId={project_id} title={new_title} rid={request_id}")
                
                # TITLE.txt 업데이트 (폴더명은 변경하지 않음)
                try:
                    pm._write_title_txt(project_id, new_title, updated_at)
                    print(f"TITLE_TXT_UPDATED projectId={project_id} title={new_title} rid={request_id}")
                except Exception as txt_error:
                    logger.warning(f"[API] Failed to write TITLE.txt for {project_id}: {txt_error}")
                    # TITLE.txt 실패해도 계속 진행
                
                # 저장 후 재읽기 검증
                try:
                    with open(json_path, 'r', encoding='utf-8') as f:
                        reloaded = json.load(f)
                    print(f"META_AFTER_TITLE_UPDATE projectId={project_id} title={reloaded.get('title')} topic={reloaded.get('topic')} folderName={reloaded.get('folderName')} rid={request_id}")
                except Exception as reload_error:
                    logger.warning(f"[API] Failed to reload project.json for {project_id}: {reload_error}")
            except Exception as e:
                print(f"TITLE_JSON_SAVE_FAILED projectId={project_id} error={e} rid={request_id}")
                import traceback
                logger.error(f"[API] Title JSON save failed: {traceback.format_exc()}")
                # JSON 저장 실패 시에도 에러 반환하지 않고 계속 진행 (project.topic은 이미 저장됨)
            
            # title 필드도 data에서 제거
            data = {k: v for k, v in data.items() if k != 'title'}
        
        # 나머지 필드 업데이트
        if data and not title_updated:
            project = pm.update_project_partial(project_id, data)
        elif not title_updated:
            project = pm.get_project(project_id)
        
        if not project:
            return jsonify({'ok': False, 'error': 'Project not found'}), 404
        
        # 프로젝트 저장
        if pm.save_project(project):
            print(f"SAVE_SUCCESS projectId={project_id} rid={request_id}")
            # script/scenes 저장 시 script.txt, scenes.json 동기화 (GET 시 데이터 유실 방지)
            project_path = pm._get_project_path(project_id)
            if 'script' in data:
                try:
                    script_content = getattr(project, 'script', None)
                    (project_path / "script.txt").write_text(script_content if isinstance(script_content, str) else '', encoding='utf-8')
                except Exception as e:
                    logger.warning(f"[API] script.txt 쓰기 실패: {e}")
            if 'scenes' in data:
                try:
                    scenes_list = project.to_dict().get('scenes', [])
                    with open(project_path / "scenes.json", 'w', encoding='utf-8') as f:
                        json.dump(scenes_list, f, indent=2, ensure_ascii=False)
                except Exception as e:
                    logger.warning(f"[API] scenes.json 쓰기 실패: {e}")
        else:
            print(f"SAVE_FAILED projectId={project_id} rid={request_id}")
            return jsonify({'ok': False, 'error': 'Failed to save'}), 500
        
        # 저장 후 재읽기 검증
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                reloaded_data = json.load(f)
            print(f"META_AFTER_WRITE projectId={project_id} title={reloaded_data.get('title') or reloaded_data.get('topic')} status={reloaded_data.get('status')} imagesCount={reloaded_data.get('imagesCount')} rid={request_id}")
        except Exception as e:
            print(f"META_RELOAD_FAILED projectId={project_id} error={e} rid={request_id}")
        
        # 메타 보정 (이미지 카운트 등)
        meta = reconcile_and_persist_meta(project_id, force=False)
        
        # to_dict() 호출 시 에러 처리 (절대 터지지 않게)
        try:
            project_dict = project.to_dict()
            # 메타 필드로 덮어쓰기
            if meta:
                project_dict.update({
                    'title': meta.get('title') or project_dict.get('topic') or project_dict.get('name', ''),
                    'hasScript': meta['hasScript'],
                    'hasScenesJson': meta['hasScenesJson'],
                    'scenesCount': meta['scenesCount'],
                    'imagesCount': meta['imagesCount'],
                    'previewImageUrl': meta['previewImageUrl'],
                    'status': meta['status'],
                    'archived': meta['status'] == 'archived',
                    'pinned': meta.get('isPinned', False),
                })
            else:
                # meta 없어도 archived/pinned는 project.status에서
                project_dict['archived'] = getattr(project.status, 'archived', False) if project.status else False
                project_dict['pinned'] = getattr(project.status, 'isPinned', False) if project.status else False
            # JSON serializable 확인
            json.dumps(project_dict)
        except Exception as e:
            logger.error(f"[API] project.to_dict() 실패: {project_id}, 에러: {e}")
            # 기본 정보만 반환 (안전한 dict만)
            project_dict = {
                'id': str(project.id) if hasattr(project, 'id') else project_id,
                'createdAt': str(project.createdAt) if hasattr(project, 'createdAt') else '',
                'updatedAt': str(project.updatedAt) if hasattr(project, 'updatedAt') else '',
                'topic': getattr(project, 'topic', ''),
            }
        
        print(f"RESP_SUCCESS projectId={project_id} title={project_dict.get('title') or project_dict.get('topic')} rid={request_id}")
        return jsonify({
            'ok': True,
            'project': project_dict
        }), 200
    except FileNotFoundError as e:
        print(f"RESP_ERROR projectId={project_id} FileNotFound: {e} rid={request_id}")
        logger.error(f"[API] Project file not found: {e}")
        return jsonify({'ok': False, 'error': 'Project not found'}), 404
    except Exception as e:
        print(f"RESP_ERROR projectId={project_id} error={e} rid={request_id}")
        logger.error(f"프로젝트 부분 업데이트 실패: {e}")
        import traceback
        logger.error(f"[API] Error stack: {traceback.format_exc()}")
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/projects/batch-archive', methods=['POST'])
def batch_archive_projects():
    """배치 프로젝트 보관"""
    request_id = request.headers.get('X-Request-Id', 'N/A')
    print(f"REQ POST {request.path} rid={request_id}")
    
    try:
        # Content-Type 확인 및 JSON 파싱
        if not request.is_json:
            return jsonify({'ok': False, 'error': 'Content-Type must be application/json'}), 400
        
        data = request.get_json()
        if data is None:
            data = {}
        
        project_ids = data.get('projectIds', [])
        status_value = data.get('status', 'archived')  # 기본값: 'archived'
        
        print(f"REQ_BODY projectIds={project_ids} status={status_value} rid={request_id}")
        
        if not project_ids or not isinstance(project_ids, list):
            return jsonify({'ok': False, 'error': 'projectIds array is required'}), 400
        
        logger.info(f"[API] BATCH ARCHIVE PROJECTS: {len(project_ids)}개 - {project_ids}, status: {status_value}")
        
        updated = []
        updated_projects = []  # 업데이트된 프로젝트 정보
        failed = []
        
        for project_id in project_ids:
            try:
                project = pm.get_project(project_id)
                if not project:
                    failed.append({'id': project_id, 'reason': 'Project not found'})
                    logger.warning(f"[API] 배치 보관 실패: {project_id} - Project not found")
                    continue
                
                # Status 객체가 dataclass 인스턴스인지 확인하고, 아니면 새로 생성
                if not hasattr(project.status, '__dataclass_fields__'):
                    # Status가 dict이거나 다른 타입인 경우 새로 생성
                    from backend.models import Status
                    status_dict = {}
                    if isinstance(project.status, dict):
                        status_dict = project.status.copy()
                    elif hasattr(project.status, '__dict__'):
                        status_dict = dict(project.status.__dict__)
                    else:
                        status_dict = {
                            'script': getattr(project.status, 'script', 'pending'),
                            'images': getattr(project.status, 'images', 'pending'),
                            'tts': getattr(project.status, 'tts', 'pending'),
                            'render': getattr(project.status, 'render', 'pending'),
                            'archived': getattr(project.status, 'archived', False),
                            'isPinned': getattr(project.status, 'isPinned', False),
                            'lastOpenedAt': getattr(project.status, 'lastOpenedAt', None),
                        }
                    status_dict['archived'] = (status_value == 'archived')
                    project.status = Status(**status_dict)
                else:
                    # Status 객체의 archived 필드 직접 업데이트
                    project.status.archived = (status_value == 'archived')
                
                project.updatedAt = datetime.now().isoformat()
                
                # 프로젝트 저장
                json_path = pm._get_project_json_path(project_id)
                print(f"META_PATH projectId={project_id} path={json_path} rid={request_id}")
                
                if pm.save_project(project):
                    updated.append(project_id)
                    print(f"SAVE_SUCCESS projectId={project_id} rid={request_id}")
                    
                    # 저장 후 재읽기 검증
                    try:
                        with open(json_path, 'r', encoding='utf-8') as f:
                            reloaded = json.load(f)
                        print(f"META_AFTER_WRITE projectId={project_id} title={reloaded.get('title') or reloaded.get('topic')} status={reloaded.get('status')} rid={request_id}")
                    except Exception as e:
                        print(f"META_RELOAD_FAILED projectId={project_id} error={e} rid={request_id}")
                    
                    # 메타 보정 및 저장 (이미지/카운트 보정 포함)
                    meta = reconcile_and_persist_meta(project_id, force=True)
                    if meta:
                        updated_projects.append(meta)
                    else:
                        # 메타 보정 실패 시 최소 정보
                        # project.json에서 title 읽기
                        json_path = pm._get_project_json_path(project_id)
                        try:
                            with open(json_path, 'r', encoding='utf-8') as f:
                                json_data = json.load(f)
                            project_title = json_data.get('title') or json_data.get('topic') or getattr(project, 'topic', '')
                        except:
                            project_title = getattr(project, 'topic', '')
                        updated_projects.append({
                            'id': project_id,
                            'title': project_title,
                            'status': status_value,
                            'updatedAt': project.updatedAt,
                        })
                    
                    logger.info(f"[API] 배치 보관 성공: {project_id} -> {status_value}")
                    print(f"ARCHIVE_SUCCESS projectId={project_id} status={status_value} rid={request_id}")
                else:
                    failed.append({'id': project_id, 'reason': 'Save operation failed'})
                    logger.warning(f"[API] 배치 보관 실패: {project_id} - Save operation failed")
            except Exception as e:
                failed.append({'id': project_id, 'reason': str(e)})
                logger.error(f"[API] 배치 보관 실패: {project_id}, 에러: {e}")
        
        logger.info(f"[API] 배치 보관 완료 - 성공: {len(updated)}개, 실패: {len(failed)}개")
        
        return jsonify({
            'ok': True,
            'updated': updated_projects,  # 업데이트된 프로젝트 정보 포함
            'failed': failed,
            'total': len(project_ids),
            'successCount': len(updated),
            'failureCount': len(failed)
        }), 200
        
    except Exception as e:
        logger.error(f"[API] 배치 보관 실패: {e}")
        import traceback
        logger.error(f"[API] 배치 보관 실패 스택: {traceback.format_exc()}")
        # 항상 JSON 응답 반환 (HTML 에러 페이지 방지)
        return jsonify({
            'ok': False, 
            'error': str(e),
            'type': type(e).__name__
        }), 500


@app.route('/api/projects/batch-unarchive', methods=['POST'])
def batch_unarchive_projects():
    """배치 프로젝트 보관 해제"""
    request_id = request.headers.get('X-Request-Id', 'N/A')
    print(f"REQ POST {request.path} rid={request_id}")
    
    try:
        if not request.is_json:
            return jsonify({'ok': False, 'error': 'Content-Type must be application/json'}), 400
        
        data = request.get_json()
        if data is None:
            data = {}
        
        project_ids = data.get('projectIds', [])
        print(f"REQ_BODY projectIds={project_ids} rid={request_id}")
        
        if not project_ids or not isinstance(project_ids, list):
            return jsonify({'ok': False, 'error': 'projectIds array is required'}), 400
        
        logger.info(f"[API] BATCH UNARCHIVE PROJECTS: {len(project_ids)}개 - {project_ids}")
        
        updated = []
        updated_projects = []
        failed = []
        
        for project_id in project_ids:
            try:
                project = pm.get_project(project_id)
                if not project:
                    failed.append({'id': project_id, 'reason': 'Project not found'})
                    logger.warning(f"[API] 배치 보관 해제 실패: {project_id} - Project not found")
                    continue
                
                # Status 객체가 dataclass 인스턴스인지 확인하고, 아니면 새로 생성
                if not hasattr(project.status, '__dataclass_fields__'):
                    from backend.models import Status
                    status_dict = {}
                    if isinstance(project.status, dict):
                        status_dict = project.status.copy()
                    elif hasattr(project.status, '__dict__'):
                        status_dict = dict(project.status.__dict__)
                    else:
                        status_dict = {
                            'script': getattr(project.status, 'script', 'pending'),
                            'images': getattr(project.status, 'images', 'pending'),
                            'tts': getattr(project.status, 'tts', 'pending'),
                            'render': getattr(project.status, 'render', 'pending'),
                            'archived': getattr(project.status, 'archived', False),
                            'isPinned': getattr(project.status, 'isPinned', False),
                            'lastOpenedAt': getattr(project.status, 'lastOpenedAt', None),
                        }
                    status_dict['archived'] = False
                    project.status = Status(**status_dict)
                else:
                    project.status.archived = False
                
                project.updatedAt = datetime.now().isoformat()
                
                # 프로젝트 저장
                json_path = pm._get_project_json_path(project_id)
                print(f"META_PATH projectId={project_id} path={json_path} rid={request_id}")
                
                if pm.save_project(project):
                    updated.append(project_id)
                    print(f"SAVE_SUCCESS projectId={project_id} rid={request_id}")
                    
                    # 저장 후 재읽기 검증
                    try:
                        with open(json_path, 'r', encoding='utf-8') as f:
                            reloaded = json.load(f)
                        print(f"META_AFTER_WRITE projectId={project_id} title={reloaded.get('title') or reloaded.get('topic')} status={reloaded.get('status')} rid={request_id}")
                    except Exception as e:
                        print(f"META_RELOAD_FAILED projectId={project_id} error={e} rid={request_id}")
                    
                    # 메타 보정 및 저장
                    meta = reconcile_and_persist_meta(project_id, force=True)
                    if meta:
                        updated_projects.append(meta)
                    else:
                        # project.json에서 title 읽기
                        json_path = pm._get_project_json_path(project_id)
                        try:
                            with open(json_path, 'r', encoding='utf-8') as f:
                                json_data = json.load(f)
                            project_title = json_data.get('title') or json_data.get('topic') or getattr(project, 'topic', '')
                        except:
                            project_title = getattr(project, 'topic', '')
                        updated_projects.append({
                            'id': project_id,
                            'title': project_title,
                            'status': 'active',
                            'updatedAt': project.updatedAt,
                        })
                    
                    logger.info(f"[API] 배치 보관 해제 성공: {project_id}")
                    print(f"UNARCHIVE_SUCCESS projectId={project_id} rid={request_id}")
                else:
                    failed.append({'id': project_id, 'reason': 'Save operation failed'})
                    logger.warning(f"[API] 배치 보관 해제 실패: {project_id} - Save operation failed")
            except Exception as e:
                failed.append({'id': project_id, 'reason': str(e)})
                logger.error(f"[API] 배치 보관 해제 실패: {project_id}, 에러: {e}")
        
        logger.info(f"[API] 배치 보관 해제 완료 - 성공: {len(updated)}개, 실패: {len(failed)}개")
        
        return jsonify({
            'ok': True,
            'updated': updated_projects,
            'failed': failed,
            'total': len(project_ids),
            'successCount': len(updated),
            'failureCount': len(failed)
        }), 200
        
    except Exception as e:
        logger.error(f"[API] 배치 보관 해제 실패: {e}")
        import traceback
        logger.error(f"[API] 배치 보관 해제 실패 스택: {traceback.format_exc()}")
        return jsonify({
            'ok': False,
            'error': str(e),
            'type': type(e).__name__
        }), 500


@app.route('/api/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    """프로젝트 삭제"""
    try:
        logger.info(f"[API] DELETE PROJECT: {project_id}")
        if pm.delete_project(project_id):
            logger.info(f"[API] 프로젝트 삭제 성공: {project_id}")
            return jsonify({'ok': True}), 200
        else:
            logger.warning(f"[API] 프로젝트 삭제 실패: {project_id}")
            return jsonify({'ok': False, 'error': 'Failed to delete'}), 500
    except Exception as e:
        logger.error(f"[API] 프로젝트 삭제 실패: {project_id}, 에러: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/projects/batch-delete', methods=['POST'])
def batch_delete_projects():
    """배치 프로젝트 삭제"""
    try:
        data = request.get_json() or {}
        project_ids = data.get('projectIds', [])
        
        if not project_ids or not isinstance(project_ids, list):
            return jsonify({'ok': False, 'error': 'projectIds array is required'}), 400
        
        logger.info(f"[API] BATCH DELETE PROJECTS: {len(project_ids)}개 - {project_ids}")
        
        deleted = []
        failed = []
        
        for project_id in project_ids:
            try:
                if pm.delete_project(project_id):
                    deleted.append(project_id)
                    logger.info(f"[API] 배치 삭제 성공: {project_id}")
                else:
                    failed.append({'id': project_id, 'reason': 'Delete operation returned False'})
                    logger.warning(f"[API] 배치 삭제 실패: {project_id} - Delete operation returned False")
            except Exception as e:
                failed.append({'id': project_id, 'reason': str(e)})
                logger.error(f"[API] 배치 삭제 실패: {project_id}, 에러: {e}")
        
        logger.info(f"[API] 배치 삭제 완료 - 성공: {len(deleted)}개, 실패: {len(failed)}개")
        
        return jsonify({
            'ok': True,
            'deleted': deleted,
            'failed': failed,
            'total': len(project_ids),
            'successCount': len(deleted),
            'failureCount': len(failed)
        }), 200
        
    except Exception as e:
        logger.error(f"[API] 배치 삭제 실패: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500


def compute_project_facts(project_id: str) -> Dict[str, Any]:
    """실제 파일 시스템 기준으로 프로젝트 사실(facts) 계산 (메타 보정용)"""
    project_path = pm._get_project_path(project_id)
    
    # 파일 존재 여부 확인
    script_path = project_path / "script.txt"
    scenes_json_path = project_path / "scenes.json"
    
    has_script = script_path.exists() and script_path.stat().st_size > 0
    has_scenes_json = scenes_json_path.exists() and scenes_json_path.stat().st_size > 0
    
    # scenesCount 계산: scenes.json 파일에서 읽기 (단일 진실 소스)
    # scenes.json 파일이 없으면 씬이 없는 것으로 간주 (project.json의 scenes 배열은 무시)
    scenes_count = 0
    if has_scenes_json:
        try:
            with open(scenes_json_path, 'r', encoding='utf-8') as f:
                scenes_data = json.load(f)
                if isinstance(scenes_data, list):
                    scenes_count = len(scenes_data)
                elif isinstance(scenes_data, dict) and 'scenes' in scenes_data:
                    scenes_count = len(scenes_data['scenes'])
                # scenes.json이 비어있거나 유효하지 않으면 0
                if scenes_count == 0:
                    logger.warning(f"[FACTS] scenes.json exists but is empty or invalid for {project_id}")
        except Exception as e:
            logger.warning(f"[FACTS] Failed to read scenes.json for {project_id}: {e}")
            scenes_count = 0
    
    # scenes.json이 없으면 씬이 없는 것으로 간주
    # project.json의 scenes 배열은 메타데이터일 뿐, 실제 씬 데이터는 scenes.json에만 존재
    # 따라서 scenes.json이 없으면 scenesCount = 0으로 설정
    
    # imagesCount 계산: 실제 파일 시스템에서 이미지 파일 개수 세기
    # 1) assets/images/scenes/ 폴더 확인
    # 2) assets/images/ 폴더 확인 (레거시)
    # 3) 씬 객체의 image_path에서 실제 파일 존재 여부 확인
    images_count = 0
    preview_image_url = None
    all_image_files = []
    
    # 1) assets/images/scenes/ 폴더 확인
    images_scenes_dir = project_path / "assets" / "images" / "scenes"
    if images_scenes_dir.exists():
        image_files = [f for f in images_scenes_dir.iterdir() 
                      if f.is_file() and f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']]
        all_image_files.extend(image_files)
    
    # 2) assets/images/ 폴더 확인 (레거시 경로, scenes 하위가 아닌 직접 파일)
    images_dir = project_path / "assets" / "images"
    if images_dir.exists():
        # scenes 폴더가 아닌 직접 파일만 확인
        image_files = [f for f in images_dir.iterdir() 
                      if f.is_file() and f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']]
        all_image_files.extend(image_files)
    
    # 3) 씬 객체의 image_path에서 실제 파일 존재 여부 확인
    project = pm.get_project(project_id)  # project 객체 가져오기
    if project and project.scenes:
        for scene in project.scenes:
            image_path = getattr(scene, 'image_path', None) if hasattr(scene, 'image_path') else None
            if image_path and image_path.strip():
                if image_path.startswith('http'):
                    # URL인 경우 카운트에 포함 (외부 이미지)
                    images_count += 1
                else:
                    # 상대 경로인 경우 실제 파일 존재 여부 확인
                    full_path = project_path / image_path
                    if full_path.exists() and full_path.is_file():
                        # all_image_files에 없으면 추가 (중복 방지)
                        if full_path not in all_image_files:
                            all_image_files.append(full_path)
    
    # 실제 파일 개수 계산 (중복 제거)
    unique_image_files = list(set(all_image_files))
    images_count = len(unique_image_files)
    
    # previewImageUrl 결정: 첫 번째 실제 존재하는 이미지 파일 사용
    if unique_image_files:
        # 숫자 기준 정렬 시도 (scene_001.png, scene_002.png 등)
        def sort_key(f):
            name = f.stem  # 확장자 제거
            import re
            numbers = re.findall(r'\d+', name)
            if numbers:
                return (0, int(numbers[0]))  # 숫자가 있으면 숫자로 정렬
            return (1, name.lower())  # 없으면 이름으로 정렬
        
        sorted_files = sorted(unique_image_files, key=sort_key)
        first_image = sorted_files[0]
        
        # 상대 경로 계산
        try:
            relative_path = first_image.relative_to(project_path)
            preview_image_url = f"/api/projects/{project_id}/files/{relative_path.as_posix()}"
        except ValueError:
            # 절대 경로인 경우
            logger.warning(f"[FACTS] Cannot compute relative path for {first_image}")
            preview_image_url = None
    
    # TTS 확인: assets/audio/ 폴더에 오디오 파일 존재 여부
    audio_dir = project_path / "assets" / "audio"
    has_tts = False
    tts_count = 0
    if audio_dir.exists():
        audio_files = [f for f in audio_dir.iterdir() if f.is_file() and f.suffix.lower() in ['.mp3', '.wav', '.ogg', '.m4a']]
        tts_count = len(audio_files)
        has_tts = tts_count > 0

    # 영상 확인: renders/ 폴더에 영상 파일 존재 여부
    renders_dir = project_path / "renders"
    has_video = False
    if renders_dir.exists():
        video_files = [f for f in renders_dir.iterdir() if f.is_file() and f.suffix.lower() in ['.mp4', '.webm', '.avi', '.mov']]
        has_video = len(video_files) > 0

    return {
        'hasScript': has_script,
        'hasScenesJson': has_scenes_json,
        'scenesCount': scenes_count,
        'imagesCount': images_count,
        'previewImageUrl': preview_image_url,
        'hasTts': has_tts,
        'ttsCount': tts_count,
        'hasVideo': has_video,
    }


def reconcile_and_persist_meta(project_id: str, force: bool = False) -> Dict[str, Any]:
    """프로젝트 메타를 보정하고 project.json에 저장 (단일 진실 소스)"""
    project = pm.get_project(project_id)
    if not project:
        logger.warning(f"[RECONCILE] Project not found: {project_id}")
        return None
    
    # 현재 메타 읽기 (project.json에서)
    project_dict = project.to_dict()
    current_meta = {
        'status': project_dict.get('status', {}).get('archived', False) and 'archived' or 'active',
        'hasScript': project_dict.get('hasScript'),
        'hasScenesJson': project_dict.get('hasScenesJson'),
        'scenesCount': project_dict.get('scenesCount'),
        'imagesCount': project_dict.get('imagesCount'),
        'previewImageUrl': project_dict.get('previewImageUrl'),
        'hasTts': project_dict.get('hasTts'),
        'hasVideo': project_dict.get('hasVideo'),
    }
    
    # 실제 파일 시스템에서 facts 계산
    facts = compute_project_facts(project_id)
    
    # 메타가 없거나 불일치하면 보정
    needs_update = force or (
        current_meta.get('hasScript') is None or
        current_meta.get('scenesCount') is None or
        current_meta.get('imagesCount') is None or
        current_meta.get('hasScript') != facts['hasScript'] or
        current_meta.get('scenesCount') != facts['scenesCount'] or
        current_meta.get('imagesCount') != facts['imagesCount'] or
        current_meta.get('hasTts') != facts.get('hasTts') or
        current_meta.get('hasVideo') != facts.get('hasVideo') or
        (not current_meta.get('previewImageUrl') and facts['previewImageUrl'])
    )
    
    if needs_update:
        # 메타 업데이트
        now = datetime.now().astimezone().isoformat()
        
        # status는 기존 값 유지 (보관 상태는 사용자 액션으로만 변경)
        status_value = current_meta.get('status', 'active')
        if project.status and hasattr(project.status, 'archived'):
            status_value = 'archived' if project.status.archived else 'active'
        
        # archivedAt 업데이트
        archived_at = None
        if status_value == 'archived':
            # 기존 archivedAt이 있으면 유지, 없으면 now
            if project.status and hasattr(project.status, 'archivedAt'):
                archived_at = getattr(project.status, 'archivedAt', None)
            if not archived_at:
                archived_at = now
        
        # project.json에 메타 필드 추가 저장
        # project.json 파일을 직접 읽어서 메타 필드 추가
        json_path = pm._get_project_json_path(project_id)
        print(f"META_PATH projectId={project_id} path={json_path}")
        
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
            
            # 메타 필드 추가/업데이트
            json_data['hasScript'] = facts['hasScript']
            json_data['hasScenesJson'] = facts['hasScenesJson']
            json_data['scenesCount'] = facts['scenesCount']
            json_data['imagesCount'] = facts['imagesCount']
            json_data['previewImageUrl'] = facts['previewImageUrl']
            json_data['hasTts'] = facts.get('hasTts', False)
            json_data['ttsCount'] = facts.get('ttsCount', 0)
            json_data['hasVideo'] = facts.get('hasVideo', False)
            # status: 항상 객체로 저장 (문자열로 덮어쓰면 isPinned 손실 → 즐겨찾기/보관 안 됨)
            current_status = json_data.get('status')

            # [DEBUG] Persistence Check logic
            mem_pinned = getattr(project.status, 'isPinned', False) if project.status else False
            disk_pinned = current_status.get('isPinned', False) if isinstance(current_status, dict) else False
            logger.info(f"[RECONCILE] Persistence check {project_id}: disk_status_type={type(current_status)}, disk_pinned={disk_pinned}, mem_pinned={mem_pinned}, target_archived={status_value=='archived'}")

            if isinstance(current_status, dict):
                # 기존 값 유지 + archived 업데이트 + isPinned 명시적 보장
                # (메모리상에 isPinned가 있으면 그것을 우선, 없으면 디스크 값 유지 - 단, 언핀 동작을 고려해야 함)
                # reconcile은 보통 facts(파일상태) 보정이 목적이므로, 사용자 설정(isPinned)은 disk 값을 신뢰하되, 
                # project 객체가 최신이라면 project객체 값을 써야 함.
                # 여기서는 **current_status로 디스크 값을 깔고, project.status에 있는 값이 '명확하다면' 덮어쓰기?
                # 하지만 project.status는 보통 disk에서 로드됨.
                pass
                json_data['status'] = { **current_status, 'archived': status_value == 'archived' }
            else:
                is_pinned = getattr(project.status, 'isPinned', False) if project.status else False
                json_data['status'] = {
                    'script': getattr(project.status, 'script', 'pending') if project.status else 'pending',
                    'images': getattr(project.status, 'images', 'pending') if project.status else 'pending',
                    'tts': getattr(project.status, 'tts', 'pending') if project.status else 'pending',
                    'render': getattr(project.status, 'render', 'pending') if project.status else 'pending',
                    'archived': status_value == 'archived',
                    'isPinned': is_pinned,
                    'lastOpenedAt': getattr(project.status, 'lastOpenedAt', None) if project.status else None,
                }
            # title 필드 확정 (없으면 topic을 title로 저장) - 항상 보장
            if 'title' not in json_data or not json_data.get('title') or json_data.get('title', '').strip() == '':
                title_value = json_data.get('topic') or json_data.get('name', '')
                if title_value:
                    json_data['title'] = title_value
                    print(f"META_TITLE_SET projectId={project_id} title={title_value}")
            if archived_at:
                json_data['archivedAt'] = archived_at
            json_data['updatedAt'] = now
            
            # 저장
            try:
                with open(json_path, 'w', encoding='utf-8', errors='replace') as f:
                    json.dump(json_data, f, indent=2, ensure_ascii=False)
            except (UnicodeEncodeError, UnicodeDecodeError) as e:
                logger.error(f"Unicode error writing project.json (reconcile) for {project_id}: {e}")
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
                json_data_no_emoji = remove_emoji_from_dict(json_data)
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(json_data_no_emoji, f, indent=2, ensure_ascii=False)
                logger.info(f"project.json saved without emoji (reconcile) for {project_id}")
            
            print(f"META_WRITE_SUCCESS projectId={project_id} imagesCount={facts['imagesCount']} previewImageUrl={facts['previewImageUrl']}")
            
            # 저장 후 재읽기 검증
            with open(json_path, 'r', encoding='utf-8') as f:
                reloaded = json.load(f)
            print(f"META_AFTER_WRITE projectId={project_id} title={reloaded.get('title') or reloaded.get('topic')} status={reloaded.get('status')} imagesCount={reloaded.get('imagesCount')} previewImageUrl={reloaded.get('previewImageUrl')}")
            
            logger.info(f"[RECONCILE] Meta updated for {project_id}: scenesCount={facts['scenesCount']}, imagesCount={facts['imagesCount']}, previewImageUrl={facts['previewImageUrl']}")
        except Exception as e:
            print(f"META_WRITE_FAILED projectId={project_id} error={e}")
            logger.error(f"[RECONCILE] Failed to persist meta for {project_id}: {e}")
            import traceback
            logger.error(f"[RECONCILE] Error stack: {traceback.format_exc()}")
            raise  # 예외를 삼키지 않고 다시 발생시킴
    
    # 최종 status 값 결정
    final_status = status_value if needs_update else current_meta.get('status', 'active')
    # project.status에서 다시 확인 (최신 상태)
    if project.status and hasattr(project.status, 'archived'):
        final_status = 'archived' if project.status.archived else 'active'
    
    # title 필드 확정 (항상 project.json에서 읽기 및 보장)
    json_path = pm._get_project_json_path(project_id)
    project_title = ''
    updated_at = datetime.now().astimezone().isoformat()
    try:
        # needs_update가 True면 이미 json_data가 업데이트되었으므로 다시 읽기
        if needs_update:
            with open(json_path, 'r', encoding='utf-8') as f:
                json_data_final = json.load(f)
        else:
            # needs_update가 False면 현재 json_data 사용
            json_data_final = json_data if 'json_data' in locals() else {}
            if not json_data_final:
                with open(json_path, 'r', encoding='utf-8') as f:
                    json_data_final = json.load(f)
        
        project_title = json_data_final.get('title') or json_data_final.get('topic') or json_data_final.get('name', '')
        
        # title이 없고 topic이나 name이 있으면 title로 저장 (항상 보장)
        if not project_title and (json_data_final.get('topic') or json_data_final.get('name')):
            project_title = json_data_final.get('topic') or json_data_final.get('name', '')
            json_data_final['title'] = project_title
            json_data_final['updatedAt'] = updated_at
            try:
                with open(json_path, 'w', encoding='utf-8', errors='replace') as f:
                    json.dump(json_data_final, f, indent=2, ensure_ascii=False)
            except (UnicodeEncodeError, UnicodeDecodeError) as e:
                logger.error(f"Unicode error writing project.json (title set) for {project_id}: {e}")
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
                json_data_final_no_emoji = remove_emoji_from_dict(json_data_final)
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(json_data_final_no_emoji, f, indent=2, ensure_ascii=False)
                logger.info(f"project.json saved without emoji (title set) for {project_id}")
            print(f"TITLE_SET projectId={project_id} title={project_title}")
        
        # title이 여전히 비어있으면 project 객체에서 읽기
        if not project_title:
            project_title = project_dict.get('title') or project.topic or project_dict.get('name', '')
            if project_title:
                # project.json에도 저장
                json_data_final['title'] = project_title
                json_data_final['updatedAt'] = updated_at
                try:
                    with open(json_path, 'w', encoding='utf-8', errors='replace') as f:
                        json.dump(json_data_final, f, indent=2, ensure_ascii=False)
                except (UnicodeEncodeError, UnicodeDecodeError) as e:
                    logger.error(f"Unicode error writing project.json (title from project) for {project_id}: {e}")
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
                    json_data_final_no_emoji = remove_emoji_from_dict(json_data_final)
                    with open(json_path, 'w', encoding='utf-8') as f:
                        json.dump(json_data_final_no_emoji, f, indent=2, ensure_ascii=False)
                    logger.info(f"project.json saved without emoji (title from project) for {project_id}")
                print(f"TITLE_SET_FROM_PROJECT projectId={project_id} title={project_title}")
        
        # TITLE.txt 업데이트 (항상 최신 제목 유지)
        pm._write_title_txt(project_id, project_title, updated_at)
    except Exception as e:
        logger.warning(f"[RECONCILE] Failed to read/write title for {project_id}: {e}")
        import traceback
        logger.warning(f"[RECONCILE] Title error stack: {traceback.format_exc()}")
        # fallback: project 객체에서 읽기
        project_title = project_dict.get('title') or project.topic or project_dict.get('name', '')
    
    # isPinned: project.status에서 읽기 (즐겨찾기 필터용)
    is_pinned = getattr(project.status, 'isPinned', False) if project.status else False
    # 최종 메타 반환
    return {
        'id': project_id,
        'title': project_title,
        'status': final_status,
        'createdAt': project.createdAt,
        'updatedAt': now if needs_update else project.updatedAt,
        'archivedAt': archived_at if needs_update and archived_at else (current_meta.get('archivedAt') if 'archivedAt' in current_meta else None),
        'hasScript': facts['hasScript'],
        'hasScenesJson': facts['hasScenesJson'],
        'scenesCount': facts['scenesCount'],
        'imagesCount': facts['imagesCount'],
        'previewImageUrl': facts['previewImageUrl'],
        'hasTts': facts.get('hasTts', False),
        'ttsCount': facts.get('ttsCount', 0),
        'hasVideo': facts.get('hasVideo', False),
        'isPinned': is_pinned,
    }


def _calculate_project_metadata(project: Project, project_id: str) -> Dict[str, Any]:
    """프로젝트 메타데이터 계산 (진행률, 파일 존재 여부 등) - 레거시 호환"""
    project_path = pm._get_project_path(project_id)
    
    # 파일 존재 여부 확인
    script_path = project_path / "script.txt"
    scenes_json_path = project_path / "scenes.json"
    characters_json_path = project_path / "characters.json"
    
    has_script = script_path.exists() and script_path.stat().st_size > 0
    has_scenes_json = scenes_json_path.exists() and scenes_json_path.stat().st_size > 0
    
    # scenesCount 계산: scenes.json 파일에서 읽기 (단일 진실 소스)
    # scenes.json 파일이 없으면 씬이 없는 것으로 간주 (project.json의 scenes 배열은 무시)
    scenes_count = 0
    if has_scenes_json:
        try:
            with open(scenes_json_path, 'r', encoding='utf-8') as f:
                scenes_data = json.load(f)
                if isinstance(scenes_data, list):
                    scenes_count = len(scenes_data)
                elif isinstance(scenes_data, dict) and 'scenes' in scenes_data:
                    scenes_count = len(scenes_data['scenes'])
                # scenes.json이 비어있거나 유효하지 않으면 0
                if scenes_count == 0:
                    logger.warning(f"[METADATA] scenes.json exists but is empty or invalid for {project_id}")
        except Exception as e:
            logger.warning(f"Failed to read scenes.json for scenesCount: {e}")
            scenes_count = 0
    
    # scenes.json이 없으면 씬이 없는 것으로 간주
    # project.json의 scenes 배열은 메타데이터일 뿐, 실제 씬 데이터는 scenes.json에만 존재
    
    # imagesCount 계산: 실제 파일 시스템에서 이미지 파일 개수 세기
    # 1) assets/images/scenes/ 폴더 확인
    # 2) assets/images/ 폴더 확인 (레거시)
    # 3) 씬 객체의 image_path에서 실제 파일 존재 여부 확인
    images_count = 0
    all_image_files = []
    
    # 1) assets/images/scenes/ 폴더 확인
    images_scenes_dir = project_path / "assets" / "images" / "scenes"
    if images_scenes_dir.exists():
        image_files = [f for f in images_scenes_dir.iterdir() 
                      if f.is_file() and f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']]
        all_image_files.extend(image_files)
    
    # 2) assets/images/ 폴더 확인 (레거시 경로, scenes 하위가 아닌 직접 파일)
    images_dir = project_path / "assets" / "images"
    if images_dir.exists():
        # scenes 폴더가 아닌 직접 파일만 확인
        image_files = [f for f in images_dir.iterdir() 
                      if f.is_file() and f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']]
        all_image_files.extend(image_files)
    
    # 3) 씬 객체의 image_path에서 실제 파일 존재 여부 확인
    scenes_with_valid_images = []
    if project.scenes:
        for s in project.scenes:
            image_path = getattr(s, 'image_path', None) if hasattr(s, 'image_path') else None
            if image_path and image_path.strip():
                if image_path.startswith('http'):
                    # URL인 경우 카운트에 포함 (외부 이미지)
                    scenes_with_valid_images.append(s)
                else:
                    # 상대 경로인 경우 실제 파일 존재 여부 확인
                    full_path = project_path / image_path
                    if full_path.exists() and full_path.is_file():
                        scenes_with_valid_images.append(s)
                        # all_image_files에 없으면 추가 (중복 방지)
                        if full_path not in all_image_files:
                            all_image_files.append(full_path)
    
    # 실제 파일 개수 계산 (중복 제거)
    unique_image_files = list(set(all_image_files))
    images_count = len(unique_image_files)
    
    # scenesCount가 0이면 imagesCount도 0으로 처리 (씬이 없으면 이미지도 없어야 함)
    if scenes_count == 0:
        images_count = 0
        preview_image_url = None
    
    # TTS 오디오 존재 여부
    audio_dir = project_path / "assets" / "audio"
    has_narration = False
    if audio_dir.exists():
        audio_files = [f for f in audio_dir.iterdir() if f.is_file() and f.suffix.lower() in ['.mp3', '.wav', '.m4a']]
        has_narration = len(audio_files) > 0
    
    # settings에서도 확인
    if project.settings and hasattr(project.settings, 'tts'):
        tts_audio_paths = getattr(project.settings.tts, 'audio_paths', [])
        if tts_audio_paths:
            has_narration = True
    
    # 최종 영상 존재 여부
    renders_dir = project_path / "renders"
    has_final_video = False
    if renders_dir.exists():
        video_files = [f for f in renders_dir.iterdir() if f.is_file() and f.suffix.lower() in ['.mp4', '.mov', '.avi']]
        has_final_video = len(video_files) > 0
    
    # status에서도 확인
    if project.status and hasattr(project.status, 'rendered'):
        has_final_video = has_final_video or project.status.rendered
    
    # 진행률 계산 (0~100)
    progress = 0
    if has_script:
        progress += 20
    if has_scenes_json or scenes_count > 0:
        progress += 20
    # 이미지 진행률 계산 (scenesCount 기준)
    if scenes_count > 0:
        if images_count >= scenes_count:
            progress += 25  # 모든 씬에 이미지가 있으면 완료
        elif images_count > 0:
            # 부분 완료: 생성된 이미지 비율에 따라 계산
            progress += int((images_count / scenes_count) * 25)
        # images_count == 0이면 진행률 추가 안 함
    # scenes_count == 0이면 이미지 진행률 추가 안 함
    if has_narration:
        progress += 15
    if has_final_video:
        progress += 20
    
    progress_percent = min(progress, 100)
    
    # 현재 단계 레이블 (우선순위 순서대로)
    if not has_script:
        current_stage_label = "대본 작성 필요"
    elif not (has_scenes_json or scenes_count > 0):
        current_stage_label = "JSON 생성 필요"
    elif scenes_count == 0:
        # 씬이 없으면 이미지 생성 단계로 가지 않음
        current_stage_label = "JSON 생성 필요"
    elif images_count == 0:
        current_stage_label = "이미지 생성 필요"
    elif images_count > 0 and images_count < scenes_count:
        # 일부 이미지만 생성됨
        current_stage_label = "이미지 생성 진행중"
    elif images_count >= scenes_count and scenes_count > 0:
        # 모든 씬에 이미지가 있음 (이미지 완료)
        if not has_narration:
            current_stage_label = "TTS 생성 필요"
        elif not has_final_video:
            current_stage_label = "영상 생성 필요"
        else:
            current_stage_label = "완성"
    elif not has_narration:
        current_stage_label = "TTS 생성 필요"
    elif not has_final_video:
        current_stage_label = "영상 생성 필요"
    else:
        current_stage_label = "완성"
    
    # 썸네일 URL 결정 (우선순위: previewImageUrl > final video 썸네일 > 첫 씬 이미지)
    preview_image_url = None
    
    # 프로젝트 메타에서 previewImageUrl 확인 (추후 저장 가능)
    if hasattr(project, 'previewImageUrl') and project.previewImageUrl:
        # 메타의 previewImageUrl이 실제 파일을 가리키는지 검증
        meta_preview_path = project.previewImageUrl
        if meta_preview_path.startswith('/api/projects/'):
            # /api/projects/{id}/files/... 형식에서 실제 경로 추출
            try:
                file_path = meta_preview_path.split('/files/', 1)[1]
                full_path = project_path / file_path
                if full_path.exists() and full_path.is_file():
                    preview_image_url = meta_preview_path
                    logger.debug(f"[METADATA] {project_id} - previewImageUrl from project attribute (validated): {preview_image_url}")
                else:
                    logger.warning(f"[METADATA] {project_id} - previewImageUrl in meta points to non-existent file: {meta_preview_path}")
            except Exception as e:
                logger.warning(f"[METADATA] {project_id} - Failed to validate previewImageUrl: {e}")
        else:
            preview_image_url = meta_preview_path
            logger.debug(f"[METADATA] {project_id} - previewImageUrl from project attribute: {preview_image_url}")
    elif has_final_video and project.thumbnail and project.thumbnail.path:
        preview_image_url = f"/api/projects/{project_id}/preview?path={project.thumbnail.path}"
        logger.debug(f"[METADATA] {project_id} - previewImageUrl from thumbnail: {preview_image_url}")
    elif unique_image_files:
        # 실제 존재하는 첫 번째 이미지 파일 사용
        def sort_key(f):
            name = f.stem
            import re
            numbers = re.findall(r'\d+', name)
            if numbers:
                return (0, int(numbers[0]))
            return (1, name.lower())
        
        sorted_files = sorted(unique_image_files, key=sort_key)
        first_image = sorted_files[0]
        
        # 상대 경로 계산
        try:
            relative_path = first_image.relative_to(project_path)
            preview_image_url = f"/api/projects/{project_id}/files/{relative_path.as_posix()}"
            logger.debug(f"[METADATA] {project_id} - previewImageUrl from first image file: {preview_image_url}")
        except ValueError:
            logger.warning(f"[METADATA] {project_id} - Cannot compute relative path for {first_image}")
            preview_image_url = None
    
    if not preview_image_url:
        logger.debug(f"[METADATA] {project_id} - previewImageUrl is None (no preview available)")
    
    # 영상 길이 계산 (초)
    duration_seconds = None
    if project.scenes:
        total_duration = sum(getattr(s, 'durationSec', 0) or 0 for s in project.scenes)
        if total_duration > 0:
            duration_seconds = int(total_duration)
    
    # status 확인
    status_value = "active"
    if project.status and hasattr(project.status, 'archived'):
        if project.status.archived:
            status_value = "archived"
    
    # isPinned 확인
    is_pinned = False
    if project.status and hasattr(project.status, 'isPinned'):
        is_pinned = project.status.isPinned or False
    
    # lastOpenedAt 확인
    last_opened_at = None
    if project.status and hasattr(project.status, 'lastOpenedAt'):
        last_opened_at = project.status.lastOpenedAt
    
    return {
        'hasScript': has_script,
        'hasScenesJson': has_scenes_json,
        'scenesCount': scenes_count,
        'imagesCount': images_count,
        'hasNarration': has_narration,
        'hasFinalVideo': has_final_video,
        'previewImageUrl': preview_image_url,
        'durationSeconds': duration_seconds,
        'progressPercent': progress_percent,
        'currentStageLabel': current_stage_label,
        'status': status_value,
        'isPinned': is_pinned,
        'lastOpenedAt': last_opened_at,
    }


@app.route('/api/projects', methods=['GET'])
def list_projects():
    """모든 프로젝트 나열 (단일 진실 소스: 메타 보정 후 반환)"""
    request_id = request.headers.get('X-Request-Id', 'N/A')
    print(f"REQ GET {request.path} rid={request_id}")
    
    try:
        # status 필터 파라미터
        status_filter = request.args.get('status', 'active')  # active, archived, all
        print(f"REQ_PARAMS status={status_filter} rid={request_id}")
        
        # 프로젝트 id 목록 enumerate (canonical 규칙 + legacy 제외)
        project_ids = pm.list_project_ids()
        projects_list = []
        
        logger.info(f"[API] GET /api/projects?status={status_filter} - 총 {len(project_ids)}개 프로젝트 id 발견")
        print(f"PROJECT_IDS count={len(project_ids)} rid={request_id}")
        
        for project_id in project_ids:
            try:
                # 메타 보정 및 저장 (단일 진실 소스) - 강제 backfill
                meta = reconcile_and_persist_meta(project_id, force=True)
                if not meta:
                    logger.warning(f"[API] Failed to reconcile meta for {project_id}")
                    print(f"RECONCILE_FAILED projectId={project_id} rid={request_id}")
                    continue
                
                print(f"RECONCILE_SUCCESS projectId={project_id} imagesCount={meta.get('imagesCount')} previewImageUrl={meta.get('previewImageUrl')} rid={request_id}")
                
                # status 필터 적용
                if status_filter == 'active' and meta['status'] != 'active':
                    continue
                elif status_filter == 'archived' and meta['status'] != 'archived':
                    continue
                # status_filter == 'all'면 모두 포함
                
                # 프로젝트 전체 정보 로드 (선택적, 메타만 필요하면 생략 가능)
                project = pm.get_project(project_id)
                if project:
                    project_dict = project.to_dict()
                    # 메타 필드로 덮어쓰기 (단일 진실 소스)
                    # isPinned: meta 우선, 없으면 project_dict.status에서 (reconcile 직후 반영 보장)
                    status_obj = project_dict.get('status')
                    is_pinned_val = meta.get('isPinned')
                    if is_pinned_val is None and isinstance(status_obj, dict):
                        is_pinned_val = status_obj.get('isPinned', False)
                    # KPI/필터와 동일 기준: archived, pinned boolean
                    is_archived = meta['status'] == 'archived'
                    project_dict.update({
                        'title': meta.get('title') or project_dict.get('topic') or project_dict.get('name', ''),
                        'hasScript': meta['hasScript'],
                        'hasScenesJson': meta['hasScenesJson'],
                        'scenesCount': meta['scenesCount'],
                        'imagesCount': meta['imagesCount'],
                        'previewImageUrl': meta['previewImageUrl'],
                        'status': meta['status'],
                        'archived': is_archived,
                        'archivedAt': meta['archivedAt'],
                        'isPinned': is_pinned_val if is_pinned_val is not None else False,
                        'pinned': is_pinned_val if is_pinned_val is not None else False,
                    })
                    projects_list.append(project_dict)
                else:
                    # project.json이 없어도 메타만 반환 (최소 정보, archived/pinned 정규화)
                    meta_item = dict(meta)
                    meta_item['archived'] = meta.get('status') == 'archived'
                    meta_item['pinned'] = meta.get('isPinned', False)
                    projects_list.append(meta_item)
                
            except Exception as e:
                logger.error(f"[API] Error processing project {project_id}: {e}")
                print(f"PROCESS_ERROR projectId={project_id} error={e} rid={request_id}")
                continue
        
        # updatedAt 기준 정렬 (최신순)
        projects_list.sort(key=lambda p: p.get('updatedAt', ''), reverse=True)
        
        logger.info(f"[API] GET /api/projects - {len(projects_list)}개 프로젝트 반환 완료 (필터: {status_filter})")
        print(f"RESP_SUCCESS count={len(projects_list)} status={status_filter} rid={request_id}")
        
        return jsonify({
            'ok': True,
            'projects': projects_list
        }), 200
    except Exception as e:
        print(f"RESP_ERROR error={e} rid={request_id}")
        logger.error(f"프로젝트 목록 조회 실패: {e}")
        import traceback
        logger.error(f"[API] Error stack: {traceback.format_exc()}")
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/projects/stats', methods=['GET'])
def get_project_stats():
    """프로젝트 통계 (KPI)"""
    try:
        projects = pm.list_projects()
        
        total_projects = len(projects)
        active_projects = 0
        archived_projects = 0
        completed_projects = 0
        scenes_counts = []
        durations = []
        
        for project in projects:
            metadata = _calculate_project_metadata(project, project.id)
            
            if metadata['status'] == 'archived':
                archived_projects += 1
            else:
                active_projects += 1
            
            if metadata['hasFinalVideo']:
                completed_projects += 1
            
            if metadata['scenesCount'] > 0:
                scenes_counts.append(metadata['scenesCount'])
            
            if metadata['durationSeconds']:
                durations.append(metadata['durationSeconds'])
        
        # 평균 계산
        avg_scenes_count = round(sum(scenes_counts) / len(scenes_counts), 1) if scenes_counts else 0
        avg_duration_seconds = int(sum(durations) / len(durations)) if durations else None
        
        return jsonify({
            'ok': True,
            'totalProjects': total_projects,
            'activeProjects': active_projects,
            'archivedProjects': archived_projects,
            'completedProjects': completed_projects,
            'avgScenesCount': avg_scenes_count,
            'avgDurationSeconds': avg_duration_seconds
        }), 200
    except Exception as e:
        logger.error(f"프로젝트 통계 조회 실패: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500


# ============================================
# UTILS / AI ENDPOINTS
# ============================================

@app.route('/api/projects/<project_id>/analyze/characters', methods=['POST'])
def analyze_characters(project_id):
    """대본에서 캐릭터 분석 및 추출 (LLM)"""
    try:
        data = request.get_json() or {}
        script_text = data.get('script') or ''

        if not script_text:
            return jsonify({'ok': False, 'error': 'No script provided'}), 400

        # Calculate Script Hash
        script_hash = hashlib.md5(script_text.encode('utf-8')).hexdigest()

        # OpenAI API Key Check
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            return jsonify({'ok': False, 'error': 'OPENAI_API_KEY not found'}), 500
        
        client = openai.OpenAI(api_key=api_key)

        system_prompt = """
        You are a casting director. Analyze the script below and identify the PHYSICAL CHARACTERS who appear effectively in the scenes.

        Rules:
        1. Extract ONLY characters who are visually present or significantly mentioned.
        2. IGNORE the narrator unless they are a specific visible character (e.g., "News Anchor", "Presenter").
        3. If there are NO physical characters (e.g., documentary style, scenery only), return an empty list [].
        4. For each character, provide:
           - name: Character name (Korean)
           - role: Role in the story (Korean)
           - description: detailed visual description for image generation (English). 
             Include age, gender, clothing, appearance, and specific features.
        
        Output JSON format:
        {
            "characters": [
                { "name": "...", "role": "...", "description": "..." }
            ]
        }
        """

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Script:\\n{script_text[:3000]}"} # Limit context if needed
            ],
            response_format={ "type": "json_object" },
            temperature=0.3
        )

        result = json.loads(response.choices[0].message.content)
        characters = result.get('characters', [])

        # Fallback: Force 'Narrator' if 0 characters found
        if not characters:
            logger.info("No characters found. Defaulting to Narrator.")
            characters = [{
                "id": str(uuid4()),
                "name": "내레이터",
                "role": "1인 내레이션",
                "description": "A neutral, professional narrator or presenter, modern style, suitable for a documentary or educational video. Face is reliable and trustworthy."
            }]
        else:
            # Assign IDs to extracted characters
            for char in characters:
                char['id'] = str(uuid4())

        logger.info(f"Character analysis complete: {len(characters)} found (Hash: {script_hash})")

        return jsonify({
            'ok': True,
            'scriptHash': script_hash,
            'characters': characters
        }), 200

    except Exception as e:
        logger.error(f"Character analysis failed: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/api/translate', methods=['POST'])
def translate_text():
    """텍스트 번역 (Korean -> English) using OpenAI"""
    try:
        data = request.get_json() or {}
        text = data.get('text', '').strip()
        logger.info(f"Translation request received for: {text[:50]}...")
        
        if not text:
            logger.error("No text provided for translation")
            return jsonify({'ok': False, 'error': 'No text provided'}), 400

        # OpenAI API Key Check
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            logger.error("OPENAI_API_KEY not found in environment variables")
            return jsonify({'ok': False, 'error': 'OPENAI_API_KEY not found'}), 500
        
        client = openai.OpenAI(api_key=api_key)
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a professional translator. Translate the following Korean text into natural, descriptive English. Do not add any explanations, notes, or extra formatting. Just return the translated text."},
                {"role": "user", "content": text}
            ],
            temperature=0.3,
            max_tokens=500
        )
        
        translated_text = response.choices[0].message.content.strip()
        logger.info(f"Translation successful: {translated_text[:50]}...")
        
        return jsonify({
            'ok': True,
            'text': text,
            'translated': translated_text
        }), 200
        
    except Exception as e:
        logger.error(f"Translation failed: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500


# ============================================
# SCENES / SCRIPT ENDPOINTS
# ============================================
@app.route('/api/projects/<project_id>/scenes', methods=['POST'])
def save_scene(project_id):
    """대본(씬) 저장 - accepts { text: '...' } and updates first scene"""
    try:
        data = request.get_json() or {}
        text = data.get('text') or data.get('script') or data.get('text_raw')

        if text is None:
            return jsonify({'ok': False, 'error': 'No text provided'}), 400

        project = pm.get_project(project_id)
        if not project:
            return jsonify({'ok': False, 'error': 'Project not found'}), 404

        # update first scene or create one
        if not project.scenes or len(project.scenes) == 0:
            scene_id = str(uuid4())
            scene = Scene(id=scene_id, title='Scene 1', narration_ko=text)
            project.scenes = [scene]
        else:
            scene = project.scenes[0]
            scene.narration_ko = text

        # persist
        if pm.save_project(project):
            return jsonify({'ok': True, 'projectId': project.id, 'updatedAt': project.updatedAt}), 200
        else:
            return jsonify({'ok': False, 'error': 'Failed to save project'}), 500
    except Exception as e:
        logger.error(f"씬 저장 실패: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500


# ============================================
# GENERATION ENDPOINTS (PR-3)
# ============================================

@app.route('/api/projects/<project_id>/generate/image', methods=['POST'])
def generate_image(project_id):
    """이미지 생성 (DALL-E 3) - Enhanced"""
    try:
        data = request.get_json() or {}
        scene_id = data.get('sceneId')
        base_prompt = data.get('prompt')
        sequence = data.get('sequence', 0)
        
        # New SSOT parameters
        style_id = data.get('styleId')
        aspect_ratio = data.get('aspectRatio', '16:9')
        characters = data.get('characters', []) # Optional structure or simplified list
        
        if not scene_id or not base_prompt:
            return jsonify({'ok': False, 'error': 'sceneId and prompt are required'}), 400
        
        # 프로젝트 로드
        project = pm.get_project(project_id)
        if not project:
            return jsonify({'ok': False, 'error': 'Project not found'}), 404
            
        # OpenAI API Key Check
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            return jsonify({'ok': False, 'error': 'OPENAI_API_KEY not found'}), 500
            
        # Assets 디렉토리 준비
        project_dir = pm.get_project_dir(project_id)
        images_dir = project_dir / 'assets' / 'images'
        images_dir.mkdir(parents=True, exist_ok=True)
        
        # Prompt Synthesis
        final_prompt_parts = []
        
        # 1. Style Layer
        used_style_name = "None"
        if style_id:
            style_desc = get_style_prompt(style_id)
            if style_desc:
                final_prompt_parts.append(f"Art Style: {style_desc}.")
                used_style_name = style_id
        
        # 2. Character Layer
        if characters:
            char_block = format_characters_prompt(characters)
            if char_block:
                final_prompt_parts.append(char_block)
                final_prompt_parts.append("Maintain consistent character appearances as described above.")
        
        # 3. Scene Layer
        final_prompt_parts.append(f"\n[Scene Description]\n{base_prompt}")
        
        raw_prompt = "\n".join(final_prompt_parts)
        final_prompt = clamp_prompt_server(raw_prompt, base_prompt)
        logger.info(f"[PROMPT_DEBUG_SERVER] sceneId={scene_id} rawLen={len(raw_prompt)} sendLen={len(final_prompt)} rawHead={raw_prompt[:120]} rawTail={raw_prompt[-120:]} send={final_prompt[:200]}")

        # DALL-E 3 호출
        client = openai.OpenAI(api_key=api_key)

        # Aspect Ratio Handling
        size = "1024x1024"  # Default square
        if aspect_ratio == '16:9':
            size = "1792x1024"
        elif aspect_ratio == '9:16':
            size = "1024x1792"
        elif aspect_ratio == '1:1':
            size = "1024x1024"

        logger.info(f"Generating image for scene {sequence}: {final_prompt[:100]}... (Size: {size})")

        try:
            response = client.images.generate(
                model="dall-e-3",
                prompt=final_prompt,
                size=size,
                quality="standard",
                n=1,
            )
            
            image_url = response.data[0].url
            
            # 이미지 다운로드 및 저장
            img_data = requests.get(image_url).content
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"scene_{sequence}_{timestamp}.png"
            file_path = images_dir / filename
            
            with open(file_path, 'wb') as f:
                f.write(img_data)
                
            # 상대 경로 (프로젝트 기준 상대 경로)
            relative_path = f"assets/images/{filename}"
            # frontend에서 접근 가능한 URL
            relative_url = f"/api/projects/{project_id}/files/assets/images/{filename}"
            
            # 씬 객체의 image_path 업데이트
            scene_updated = False
            if project.scenes:
                # scene_id로 씬 찾기
                for scene in project.scenes:
                    if str(scene.id) == str(scene_id):
                        scene.image_path = relative_path
                        scene_updated = True
                        logger.info(f"Updated scene {scene_id} image_path: {relative_path}")
                        break
                
                # scene_id로 찾지 못한 경우 sequence로 찾기 (fallback)
                if not scene_updated:
                    for idx, scene in enumerate(project.scenes):
                        if (scene.sequence if hasattr(scene, 'sequence') else idx + 1) == sequence:
                            scene.image_path = relative_path
                            scene_updated = True
                            logger.info(f"Updated scene at sequence {sequence} image_path: {relative_path}")
                            break
            
            # 프로젝트 저장 (씬 업데이트 반영)
            if scene_updated:
                # updatedAt 갱신
                project.updatedAt = datetime.now().astimezone().isoformat()
                pm.save_project(project)
                logger.info(f"Project saved with updated scene image_path and updatedAt")
            
            logger.info(f"Image generated and saved: {filename}")
            
            return jsonify({
                'ok': True,
                'imageUrl': relative_url,
                'imagePath': relative_path,  # 상대 경로도 반환 (프론트에서 사용 가능)
                'localPath': str(file_path),
                'filename': filename,
                'sceneUpdated': scene_updated,
                'metadata': { # Expanded Metadata
                    'styleId': used_style_name,
                    'aspectRatio': aspect_ratio,
                    'usedPrompt': final_prompt,
                    'width': int(size.split('x')[0]),
                    'height': int(size.split('x')[1])
                }
            }), 200

        except openai.OpenAIError as e:
            logger.error(f"OpenAI API Error: {e} | sceneId={scene_id} rawLen={len(raw_prompt)} sendLen={len(final_prompt)}")
            err_str = str(e)
            if "too long" in err_str.lower():
                err_str += f" (rawLen={len(raw_prompt)}, sendLen={len(final_prompt)})"
            return jsonify({'ok': False, 'error': f"OpenAI API Error: {err_str}"}), 500

    except Exception as e:
        logger.error(f"이미지 생성 실패: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/projects/<project_id>/generate/tts', methods=['POST'])
def generate_tts_endpoint(project_id):
    """씬별 TTS 생성 - PR-4 (Issue #3: supports speed parameter)"""
    try:
        logger.info(f"TTS endpoint hit: project_id={project_id}")
        data = request.get_json() or {}
        scene_id = data.get('sceneId')
        speed = float(data.get('speed', 1.0))  # Issue #3: Accept speed parameter
        
        # Clamp speed to reasonable range
        speed = max(0.7, min(1.3, speed))
        
        if not scene_id:
            return jsonify({'ok': False, 'error': 'sceneId is required'}), 400
        
        # 프로젝트 로드
        project = pm.get_project(project_id)
        if not project:
            return jsonify({'ok': False, 'error': 'Project not found'}), 404
        
        # 씬 찾기
        scene_idx = None
        for i, s in enumerate(project.scenes):
            if s.id == scene_id:
                scene_idx = i
                break
        
        if scene_idx is None:
            return jsonify({'ok': False, 'error': f'Scene {scene_id} not found'}), 404
        
        scene = project.scenes[scene_idx]
        
        # 나레이션 텍스트 (한국어 우선, 없으면 영어)
        narration = scene.narration_ko or scene.narration_en or ""
        if not narration.strip():
            return jsonify({'ok': False, 'error': 'Scene narration is empty'}), 400
        
        # 오디오 파일 경로 (Issue #1, #3: unique filename per speed to avoid cache issues)
        project_dir = pm.get_project_dir(project_id)
        audio_dir = project_dir / 'assets' / 'audio'
        audio_dir.mkdir(parents=True, exist_ok=True)
        
        # Use timestamp in filename to ensure uniqueness per generation
        import time
        timestamp = int(time.time() * 1000)
        speed_suffix = f"_{int(speed*100)}" if speed != 1.0 else ""
        audio_filename = f'{scene_id}_{timestamp}{speed_suffix}.mp3'
        audio_path = audio_dir / audio_filename
        
        # TTS 생성 (Issue #3: pass speed parameter)
        success = generate_tts(
            text=narration,
            output_path=str(audio_path),
            voice="ko-KR-SunHiNeural",
            rate=speed
        )
        
        if not success or not audio_path.exists():
            return jsonify({'ok': False, 'error': 'TTS generation failed'}), 500
        
        # 오디오 길이 측정
        duration = get_audio_duration(str(audio_path))
        if duration is None:
            return jsonify({'ok': False, 'error': 'Failed to measure audio duration'}), 500
        
        # 프로젝트 업데이트
        scene.audio_path = f'assets/audio/{audio_filename}'
        scene.durationSec = duration
        project.scenes[scene_idx] = scene
        
        # 프로젝트 저장
        pm.save_project(project)
        
        logger.info(f"TTS 생성 완료: {project_id}/{scene_id} (속도: {speed}x, 길이: {duration:.2f}초)")
        
        return jsonify({
            'ok': True,
            'sceneId': scene_id,
            'audioPath': f'assets/audio/{audio_filename}',
            'durationSec': duration,
            'speed': speed  # Issue #3: return speed in response
        }), 200
        
    except Exception as e:
        logger.error(f"TTS 생성 실패: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/projects/<project_id>/render/preview', methods=['POST'])
def render_preview(project_id):
    """미리보기 렌더링 (모든 씬 병합) - PR-4"""
    try:
        # 프로젝트 로드
        project = pm.get_project(project_id)
        if not project:
            return jsonify({'ok': False, 'error': 'Project not found'}), 404
        
        # 씬에 image_path와 audio_path가 있는지 확인
        valid_scenes = [s for s in project.scenes if s.image_path and s.audio_path]
        if not valid_scenes:
            return jsonify({'ok': False, 'error': 'No scenes with both image and audio'}), 400
        
        project_dir = pm.get_project_dir(project_id)
        renders_dir = project_dir / 'renders'
        renders_dir.mkdir(parents=True, exist_ok=True)
        
        output_video = renders_dir / 'preview.mp4'
        
        # 각 씬별로 임시 비디오 생성 후 concat
        import subprocess
        from pathlib import Path
        from src.common.settings import settings
        
        temp_videos = []
        concat_file_path = renders_dir / 'concat_list.txt'
        
        try:
            for idx, scene in enumerate(valid_scenes):
                image_file = project_dir / scene.image_path
                audio_file = project_dir / scene.audio_path
                
                # 파일 존재 확인
                if not image_file.exists() or not audio_file.exists():
                    logger.warning(f"씬 파일 없음: {scene.id}")
                    continue
                
                # 임시 비디오 파일
                temp_video = renders_dir / f'temp_scene_{idx}.mp4'
                temp_videos.append(temp_video)
                
                # render_video_simple 호출
                success = render_video_simple(
                    image_path=str(image_file),
                    audio_path=str(audio_file),
                    output_path=str(temp_video),
                    width=int(project.settings.video.width) if hasattr(project, 'settings') else 1280,
                    height=int(project.settings.video.height) if hasattr(project, 'settings') else 720,
                    fps=int(project.settings.video.fps) if hasattr(project, 'settings') else 30
                )
                
                if not success or not temp_video.exists():
                    logger.error(f"씬 렌더링 실패: {scene.id}")
                    return jsonify({'ok': False, 'error': f'Failed to render scene {scene.id}'}), 500
                
                logger.info(f"씬 렌더링 완료: {scene.id}")
            
            if not temp_videos:
                return jsonify({'ok': False, 'error': 'No scenes to render'}), 400
            
            # 비디오 concat
            if len(temp_videos) == 1:
                # 단일 비디오면 복사
                import shutil
                shutil.copy(str(temp_videos[0]), str(output_video))
            else:
                # 다중 비디오 concat
                with open(concat_file_path, 'w', encoding='utf-8') as f:
                    for temp_video in temp_videos:
                        f.write(f"file '{temp_video.name}'\n")
                
                ffmpeg_path = settings.get('FFMPEG_PATH', 'ffmpeg')
                concat_cmd = [
                    ffmpeg_path,
                    '-y',
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', str(concat_file_path),
                    '-c', 'copy',
                    str(output_video)
                ]
                
                result = subprocess.run(
                    concat_cmd,
                    capture_output=True,
                    timeout=300
                )
                
                if result.returncode != 0:
                    logger.error(f"Concat 실패: {result.stderr.decode()}")
                    return jsonify({'ok': False, 'error': 'Failed to concat videos'}), 500
            
            # 임시 파일 정리
            for temp_video in temp_videos:
                if temp_video.exists():
                    temp_video.unlink()
            
            if concat_file_path.exists():
                concat_file_path.unlink()
            
            if not output_video.exists():
                return jsonify({'ok': False, 'error': 'Preview video not created'}), 500
            
            logger.info(f"미리보기 렌더링 완료: {project_id}")
            
            return jsonify({
                'ok': True,
                'videoPath': 'renders/preview.mp4'
            }), 200
            
        except Exception as e:
            # 임시 파일 정리
            for temp_video in temp_videos:
                if temp_video.exists():
                    try:
                        temp_video.unlink()
                    except:
                        pass
            raise e
        
    except Exception as e:
        logger.error(f"미리보기 렌더링 실패: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/projects/<project_id>/generate/srt', methods=['POST'])
def generate_srt_endpoint(project_id):
    """SRT 자막 생성 - PR-5"""
    try:
        # 프로젝트 로드
        project = pm.get_project(project_id)
        if not project:
            return jsonify({'ok': False, 'error': 'Project not found'}), 404
        
        # 씬에서 나레이션과 duration이 있는지 확인
        valid_scenes = [s for s in project.scenes if s.narration_ko and s.durationSec]
        if not valid_scenes:
            return jsonify({'ok': False, 'error': 'No scenes with narration and duration'}), 400
        
        # SRT 콘텐츠 생성
        srt_lines = []
        cumulative_time = 0.0
        
        for idx, scene in enumerate(valid_scenes):
            narration = scene.narration_ko.strip()
            duration = scene.durationSec
            
            if not narration:
                continue
            
            # 문장 분할 (한문장씩 또는 마침표 기준)
            sentences = split_sentences_ko(narration, max_length=100)
            
            if not sentences:
                continue
            
            # 각 문장을 균등하게 분배
            sentence_duration = duration / len(sentences)
            
            for sent_idx, sentence in enumerate(sentences):
                start_time = cumulative_time + (sent_idx * sentence_duration)
                end_time = cumulative_time + ((sent_idx + 1) * sentence_duration)
                
                # 마지막 문장은 정확히 씬 끝시간으로
                if sent_idx == len(sentences) - 1:
                    end_time = cumulative_time + duration
                
                # SRT 인덱스 (전체 문장 번호)
                srt_idx = len(srt_lines) // 4 + 1  # 임시 계산, 아래서 재계산
                srt_lines.append(str(srt_idx))
                srt_lines.append(f"{format_timestamp(start_time)} --> {format_timestamp(end_time)}")
                srt_lines.append(sentence)
                srt_lines.append("")  # 빈 줄
            
            cumulative_time += duration
        
        # 최종 SRT 인덱스 재계산
        final_srt = []
        srt_idx = 1
        i = 0
        while i < len(srt_lines):
            if srt_lines[i] and srt_lines[i][0].isdigit():
                # 이전 인덱스를 새 인덱스로 변경
                final_srt.append(str(srt_idx))
                srt_idx += 1
            else:
                final_srt.append(srt_lines[i])
            i += 1
        
        srt_content = "\n".join(final_srt)
        
        # 파일 저장
        project_dir = pm.get_project_dir(project_id)
        subtitles_dir = project_dir / 'assets' / 'subtitles'
        subtitles_dir.mkdir(parents=True, exist_ok=True)
        srt_path = subtitles_dir / 'subtitles.srt'
        
        success = write_srt(str(srt_path), srt_content)
        if not success:
            return jsonify({'ok': False, 'error': 'Failed to save SRT file'}), 500
        
        # 프로젝트 업데이트 (자막 활성화)
        # Subtitles dict is mutable; just update in-place
        if hasattr(project.settings, 'subtitles') and isinstance(project.settings.subtitles, dict):
            project.settings.subtitles['enabled'] = True
        # else: relax and don't fail; subtitles might vary in structure
        
        pm.save_project(project)
        
        logger.info(f"SRT 생성 완료: {project_id}")
        
        return jsonify({
            'ok': True,
            'srtPath': 'assets/subtitles/subtitles.srt'
        }), 200
        
    except Exception as e:
        import traceback
        tb_str = traceback.format_exc()
        logger.error(f"SRT 생성 실패:\n{tb_str}")
        # write to file for debugging
        try:
            with open('srt_error.log', 'w', encoding='utf-8') as f:
                f.write(f"Error: {e}\n\nTraceback:\n{tb_str}")
        except:
            pass
        print(f"[SRT ERROR] {e}\n{tb_str}", flush=True)
        return jsonify({'ok': False, 'error': str(e)}), 500


# ============================================
# SETTINGS ENDPOINTS (PR-5: BGM, etc)
# ============================================

@app.route('/api/projects/<project_id>/settings/bgm', methods=['PATCH'])
def update_bgm_settings(project_id):
    """BGM 설정 업데이트 - PR-5"""
    try:
        data = request.get_json() or {}
        
        project = pm.get_project(project_id)
        if not project:
            return jsonify({'ok': False, 'error': 'Project not found'}), 404
        
        # BGM 설정 업데이트
        if 'enabled' in data:
            project.settings.bgm.enabled = bool(data['enabled'])
        if 'volume' in data:
            volume = float(data['volume'])
            project.settings.bgm.volume = max(0.0, min(1.0, volume))  # 0.0~1.0 제한
        
        # 프로젝트 저장
        pm.save_project(project)
        
        logger.info(f"BGM 설정 업데이트: {project_id}")
        
        return jsonify({
            'ok': True,
            'project': project.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"BGM 설정 업데이트 실패: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/projects/<project_id>/upload/bgm', methods=['POST'])
def upload_bgm(project_id):
    """BGM 파일 업로드 - PR-5"""
    try:
        if 'file' not in request.files:
            return jsonify({'ok': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'ok': False, 'error': 'Empty filename'}), 400
        
        # 파일 유형 확인 (mp3, wav, aac)
        allowed_extensions = {'.mp3', '.wav', '.aac', '.ogg', '.flac'}
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in allowed_extensions:
            return jsonify({'ok': False, 'error': f'Unsupported format: {file_ext}'}), 400
        
        project = pm.get_project(project_id)
        if not project:
            return jsonify({'ok': False, 'error': 'Project not found'}), 404
        
        # BGM 디렉토리 생성
        project_dir = pm.get_project_dir(project_id)
        bgm_dir = project_dir / 'assets' / 'bgm'
        bgm_dir.mkdir(parents=True, exist_ok=True)
        
        # 파일 저장 (기본 이름: bgm.mp3)
        bgm_filename = f'bgm{file_ext}'
        bgm_path = bgm_dir / bgm_filename
        file.save(str(bgm_path))
        
        # 프로젝트 업데이트
        project.settings.bgm.path = f'assets/bgm/{bgm_filename}'
        pm.save_project(project)
        
        logger.info(f"BGM 업로드 완료: {project_id}/{bgm_filename}")
        
        return jsonify({
            'ok': True,
            'bgmPath': f'assets/bgm/{bgm_filename}'
        }), 200
        
    except Exception as e:
        logger.error(f"BGM 업로드 실패: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/projects/<project_id>/render/final', methods=['POST'])
def render_final(project_id):
    """최종 렌더링 (BGM + 자막 포함) - PR-5"""
    try:
        import subprocess
        from pathlib import Path
        from src.common.settings import settings as src_settings
        
        project = pm.get_project(project_id)
        if not project:
            return jsonify({'ok': False, 'error': 'Project not found'}), 404
        
        # 렌더 가능한 씬 확인
        valid_scenes = [s for s in project.scenes if s.image_path and s.audio_path]
        if not valid_scenes:
            return jsonify({'ok': False, 'error': 'No scenes with both image and audio'}), 400
        
        project_dir = pm.get_project_dir(project_id)
        renders_dir = project_dir / 'renders'
        renders_dir.mkdir(parents=True, exist_ok=True)
        
        output_video = renders_dir / 'final.mp4'
        
        # 1단계: 각 씬별 임시 비디오 생성
        temp_videos = []
        concat_file_path = renders_dir / 'concat_list_final.txt'
        
        try:
            for idx, scene in enumerate(valid_scenes):
                image_file = project_dir / scene.image_path
                audio_file = project_dir / scene.audio_path
                
                if not image_file.exists() or not audio_file.exists():
                    logger.warning(f"씬 파일 없음: {scene.id}")
                    continue
                
                temp_video = renders_dir / f'temp_final_scene_{idx}.mp4'
                temp_videos.append(temp_video)
                
                success = render_video_simple(
                    image_path=str(image_file),
                    audio_path=str(audio_file),
                    output_path=str(temp_video),
                    width=int(project.settings.video.width),
                    height=int(project.settings.video.height),
                    fps=int(project.settings.video.fps)
                )
                
                if not success or not temp_video.exists():
                    logger.error(f"씬 렌더링 실패: {scene.id}")
                    return jsonify({'ok': False, 'error': f'Failed to render scene {scene.id}'}), 500
            
            if not temp_videos:
                return jsonify({'ok': False, 'error': 'No scenes to render'}), 400
            
            # 2단계: 비디오 concat
            if len(temp_videos) == 1:
                import shutil
                shutil.copy(str(temp_videos[0]), str(output_video))
            else:
                with open(concat_file_path, 'w', encoding='utf-8') as f:
                    for temp_video in temp_videos:
                        f.write(f"file '{temp_video.name}'\n")
                
                ffmpeg_path = src_settings.get('FFMPEG_PATH', 'ffmpeg')
                concat_cmd = [
                    ffmpeg_path, '-y', '-f', 'concat', '-safe', '0',
                    '-i', str(concat_file_path), '-c', 'copy', str(output_video)
                ]
                
                result = subprocess.run(concat_cmd, capture_output=True, timeout=300)
                if result.returncode != 0:
                    logger.error(f"Concat 실패: {result.stderr.decode()}")
                    return jsonify({'ok': False, 'error': 'Failed to concat videos'}), 500
            
            # 임시 파일 정리
            for temp_video in temp_videos:
                if temp_video.exists():
                    temp_video.unlink()
            if concat_file_path.exists():
                concat_file_path.unlink()
            
            if not output_video.exists():
                return jsonify({'ok': False, 'error': 'Video creation failed'}), 500
            
            logger.info(f"최종 렌더링 완료: {project_id}")
            
            return jsonify({'ok': True, 'videoPath': 'renders/final.mp4'}), 200
            
        except Exception as e:
            for temp_video in temp_videos:
                if temp_video.exists():
                    try:
                       temp_video.unlink()
                    except:
                        pass
            raise e
        
    except Exception as e:
        logger.error(f"최종 렌더링 실패: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/api/projects/<project_id>/generate/thumbnail', methods=['POST'])
def generate_thumbnail(project_id):
    """썸네일 생성 (Pillow 사용)"""
    try:
        # 프로젝트 로드
        project = pm.get_project(project_id)
        if not project:
            return jsonify({'ok': False, 'error': f'Project {project_id} not found'}), 404
        
        # 요청 파싱
        data = request.get_json() or {}
        mode = data.get('mode', 'with_text')  # 'with_text' or 'no_text'
        
        # 썸네일 디렉토리 생성
        thumbnail_dir = pm.get_project_dir(project_id) / "assets" / "thumbnails"
        thumbnail_dir.mkdir(parents=True, exist_ok=True)
        thumbnail_path = thumbnail_dir / "thumbnail.png"
        
        # 썬네일 생성 (1280x720)
        width, height = 1280, 720
        
        # 배경 색상 (gradient로 보이도록 만들기)
        img = Image.new('RGB', (width, height), color=(13, 11, 28))  # 진한 배경색
        draw = ImageDraw.Draw(img)
        
        # 그라디언트 효과 (왼쪽 파란색, 오른쪽 보라색)
        for y in range(height):
            ratio = y / height
            r = int(20 + (80 - 20) * ratio)
            g = int(10 + (30 - 10) * ratio)
            b = int(50 + (100 - 50) * ratio)
            draw.rectangle([(0, y), (width, y + 1)], fill=(r, g, b))
        
        # with_text 모드일 때만 텍스트 추가
        if mode == 'with_text':
            try:
                # 텍스트 준비 (제목 + 첫 씬 정보)
                title_text = project.topic or "제목 없음"
                
                # 첫 번째 씬 정보
                subtitle_text = ""
                if project.scenes and len(project.scenes) > 0:
                    first_scene = project.scenes[0]
                    subtitle_text = first_scene.title or "첫 번째 장면"
                
                # PIL Font 로드 - Malgun Gothic 우선, 실패시 fallback
                title_font = None
                subtitle_font = None
                
                # 시도 1: Malgun Gothic (Windows 기본 한글 폰트)
                try:
                    title_font = ImageFont.truetype("C:\\Windows\\Fonts\\malgun.ttf", 100)
                    subtitle_font = ImageFont.truetype("C:\\Windows\\Fonts\\malgun.ttf", 50)
                    logger.info("✓ Malgun Gothic 폰트 사용")
                except Exception as e:
                    logger.warning(f"Malgun Gothic 로드 실패: {e}")
                
                # 시도 2: Arial (대체 폰트)
                if title_font is None:
                    try:
                        title_font = ImageFont.truetype("C:\\Windows\\Fonts\\arial.ttf", 100)
                        subtitle_font = ImageFont.truetype("C:\\Windows\\Fonts\\arial.ttf", 50)
                        logger.info("✓ Arial 폰트 사용")
                    except Exception as e:
                        logger.warning(f"Arial 로드 실패: {e}")
                
                # 시도 3: 기본 폰트
                if title_font is None:
                    logger.warning("TrueType 폰트 없음 - 기본 폰트 사용")
                    title_font = ImageFont.load_default()
                    subtitle_font = ImageFont.load_default()
                
                # 텍스트 위치 계산
                title_bbox = draw.textbbox((0, 0), title_text, font=title_font)
                title_width = title_bbox[2] - title_bbox[0]
                title_height = title_bbox[3] - title_bbox[1]
                title_x = (width - title_width) // 2
                title_y = (height - 200) // 2
                
                subtitle_bbox = draw.textbbox((0, 0), subtitle_text, font=subtitle_font) if subtitle_text else (0, 0, 0, 0)
                subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
                subtitle_x = (width - subtitle_width) // 2
                subtitle_y = title_y + title_height + 30
                
                # 배경 버블 효과 (텍스트 뒤에 반투명 사각형)
                bubble_margin = 40
                bubble_padding = 20
                
                # 제목 배경 (금색)
                draw.rectangle(
                    [(title_x - bubble_margin, title_y - bubble_padding),
                     (title_x + title_width + bubble_margin, title_y + title_height + bubble_padding)],
                    fill=(255, 215, 0),  # 금색 배경
                    outline=(255, 240, 0, 255)  # 금색 테두리
                )
                
                # 텍스트 그리기 (검은색 - 배경과 대조)
                draw.text((title_x, title_y), title_text, font=title_font, fill=(0, 0, 0))
                
                if subtitle_text:
                    # 서브타이틀 배경
                    draw.rectangle(
                        [(subtitle_x - bubble_margin, subtitle_y - 10),
                         (subtitle_x + subtitle_width + bubble_margin, subtitle_y + 50)],
                        fill=(255, 255, 255),  # 흰색 배경
                        outline=(200, 200, 200)
                    )
                    draw.text((subtitle_x, subtitle_y), subtitle_text, font=subtitle_font, fill=(50, 50, 50))
                
                logger.info(f"✓ 텍스트 렌더링: '{title_text}' + '{subtitle_text}'")
                
            except Exception as e:
                logger.warning(f"텍스트 렌더링 실패, 텍스트 없이 진행: {e}")
        
        # 썸네일 저장
        img.save(str(thumbnail_path), 'PNG')
        logger.info(f"썸네일 생성 완료: {thumbnail_path}")
        
        # project.json 업데이트
        project.thumbnail.mode = mode
        project.thumbnail.path = 'assets/thumbnails/thumbnail.png'
        
        # 프로젝트 저장
        pm.save_project(project)
        
        return jsonify({'ok': True, 'thumbnailPath': 'assets/thumbnails/thumbnail.png'}), 200
        
    except Exception as e:
        logger.error(f"썸네일 생성 실패: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/projects/<project_id>/<path:filepath>', methods=['GET'])
def serve_project_file_path(project_id, filepath):
    """프로젝트 파일 제공 (assets, renders 등)"""
    try:
        project_dir = pm.get_project_dir(project_id)
        file_path = project_dir / filepath
        
        # 보안: 프로젝트 디렉토리 벗어나지 않도록
        file_path = file_path.resolve()
        project_dir = project_dir.resolve()
        
        if not str(file_path).startswith(str(project_dir)):
            return jsonify({'error': 'Forbidden'}), 403
        
        if not file_path.exists():
            return jsonify({'error': 'File not found'}), 404
        
        # 파일 유형에 따라 적절한 MIME type으로 반환
        if file_path.suffix.lower() in ['.mp4', '.mov', '.webm']:
            return app.send_file(file_path, mimetype='video/mp4')
        elif file_path.suffix.lower() in ['.mp3', '.wav', '.aac']:
            return app.send_file(file_path, mimetype='audio/mpeg')
        elif file_path.suffix.lower() in ['.png', '.jpg', '.jpeg']:
            return app.send_file(file_path, mimetype='image/png')
        elif file_path.suffix.lower() == '.srt':
            return app.send_file(file_path, mimetype='text/plain; charset=utf-8')
        else:
            return app.send_file(file_path)
    except Exception as e:
        logger.error(f"파일 제공 실패: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/projects/<project_id>/download', methods=['GET'])
def download_project_file(project_id):
    """Download project asset with Content-Disposition attachment"""
    rel_path = request.args.get('path')
    if not rel_path:
        return jsonify({'ok': False, 'error': 'path query param is required'}), 400

    try:
        full = _validate_and_resolve_path(project_id, rel_path)
    except FileNotFoundError:
        return jsonify({'ok': False, 'error': 'Project or file not found'}), 404
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400

    logger.info(f"Download requested: {project_id} -> {rel_path}")
    mime, _ = mimetypes.guess_type(str(full))
    try:
        return send_file(str(full), mimetype=mime or 'application/octet-stream', as_attachment=True, download_name=full.name)
    except Exception as e:
        logger.error(f"파일 다운로드 실패: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/projects/<project_id>/preview', methods=['GET'])
def preview_project_file(project_id):
    """Serve a file inline for preview (audio/video/image).

    Query: ?path=<relative path inside project>
    """
    rel_path = request.args.get('path')
    if not rel_path:
        return jsonify({'ok': False, 'error': 'path query param is required'}), 400

    try:
        full = _validate_and_resolve_path(project_id, rel_path)
    except FileNotFoundError:
        return jsonify({'ok': False, 'error': 'Project or file not found'}), 404
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400

    mime, _ = mimetypes.guess_type(str(full))
    try:
        return send_file(str(full), mimetype=mime or 'application/octet-stream', as_attachment=False)
    except Exception as e:
        logger.error(f"파일 프리뷰 실패: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/projects/<project_id>/text', methods=['GET'])
def read_text_file(project_id):
    """Safely read a text file under the project and return its contents as JSON.

    Query: ?path=<relative path>
    Allowed extensions: .srt, .txt, .json, .md
    If file > 1MB, return truncated content and `truncated: true`.
    """
    rel_path = request.args.get('path')
    if not rel_path:
        return jsonify({'ok': False, 'error': 'path query param is required'}), 400

    allowed_exts = {'.srt', '.txt', '.json', '.md'}
    try:
        full = _validate_and_resolve_path(project_id, rel_path)
    except FileNotFoundError:
        return jsonify({'ok': False, 'error': 'Project or file not found'}), 404
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400

    if full.suffix.lower() not in allowed_exts:
        return jsonify({'ok': False, 'error': 'file type not allowed'}), 400

    try:
        size = full.stat().st_size
        max_bytes = 1024 * 1024  # 1MB
        truncated = False
        if size > max_bytes:
            truncated = True
            read_bytes = max_bytes
        else:
            read_bytes = size

        # try utf-8, fallback to utf-8-sig
        content = None
        try:
            with open(full, 'r', encoding='utf-8') as f:
                if truncated:
                    content = f.read(read_bytes)
                else:
                    content = f.read()
        except UnicodeDecodeError:
            try:
                with open(full, 'r', encoding='utf-8-sig') as f:
                    if truncated:
                        content = f.read(read_bytes)
                    else:
                        content = f.read()
            except Exception as e:
                logger.error(f"텍스트 파일 읽기 실패(encoding): {e}")
                return jsonify({'ok': False, 'error': 'Failed to decode file as utf-8'}), 500

        mime, _ = mimetypes.guess_type(str(full))
        resp = {
            'ok': True,
            'path': str(Path(rel_path).as_posix()),
            'content': content,
            'mime': mime or 'text/plain',
        }
        if truncated:
            resp['truncated'] = True

        return jsonify(resp), 200

    except Exception as e:
        logger.error(f"텍스트 파일 읽기 실패: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/projects/<project_id>/artifacts', methods=['GET'])
def list_project_artifacts(project_id):
    """Return a normalized list of important artifacts for the project.

    Response contains keys like tts, subtitles, thumbnail, renders, exports with arrays of metadata.
    """
    try:
        project = pm.get_project(project_id)
        if not project:
            return jsonify({'ok': False, 'error': 'Project not found'}), 404

        project_dir = pm.get_project_dir(project_id)

        def _meta_for(relpath):
            fp = project_dir / relpath
            if not fp.exists():
                return None
            stat = fp.stat()
            mime, _ = mimetypes.guess_type(str(fp))
            return {
                'relativePath': str(Path(relpath).as_posix()),
                'mime': mime or 'application/octet-stream',
                'size': stat.st_size,
                'modified': datetime.fromtimestamp(stat.st_mtime).isoformat()
            }

        artifacts = {
            'tts': [],
            'subtitles': [],
            'thumbnail': [],
            'renders': [],
            'exports': []
        }

        # TTS from scenes
        for s in getattr(project, 'scenes', []):
            if getattr(s, 'audio_path', None):
                meta = _meta_for(s.audio_path)
                if meta: artifacts['tts'].append({ 'sceneId': s.id, **meta })

        # subtitles
        subp = project_dir / 'assets' / 'subtitles' / 'subtitles.srt'
        if subp.exists():
            artifacts['subtitles'].append(_meta_for('assets/subtitles/subtitles.srt'))

        # thumbnail
        thumb_dir = project_dir / 'assets' / 'thumbnails'
        if thumb_dir.exists():
            for f in thumb_dir.iterdir():
                if f.is_file():
                    artifacts['thumbnail'].append(_meta_for(str(Path('assets/thumbnails') / f.name)))

        # renders
        renders_dir = project_dir / 'renders'
        if renders_dir.exists():
            for f in renders_dir.iterdir():
                if f.is_file():
                    artifacts['renders'].append(_meta_for(str(Path('renders') / f.name)))

        # exports
        exports_dir = project_dir / 'exports'
        if exports_dir.exists():
            for f in exports_dir.iterdir():
                if f.is_file():
                    artifacts['exports'].append(_meta_for(str(Path('exports') / f.name)))

        return jsonify({'ok': True, 'artifacts': artifacts}), 200

    except Exception as e:
        logger.error(f"아티팩트 조회 실패: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500


# ============================================
# ERROR HANDLERS (모든 에러를 JSON으로 반환)
# ============================================

@app.errorhandler(404)
def not_found(error):
    """404 에러를 JSON으로 반환"""
    return jsonify({'ok': False, 'error': 'Not found'}), 404


@app.errorhandler(500)
def server_error(error):
    """500 에러를 JSON으로 반환"""
    logger.error(f"[API] 서버 에러: {error}")
    import traceback
    logger.error(f"[API] 서버 에러 스택: {traceback.format_exc()}")
    return jsonify({
        'ok': False, 
        'error': 'Server error',
        'type': type(error).__name__ if hasattr(error, '__class__') else 'Unknown'
    }), 500


@app.errorhandler(Exception)
def handle_exception(e):
    """모든 예외를 JSON으로 반환 (HTML 에러 페이지 방지)"""
    logger.error(f"[API] 처리되지 않은 예외: {e}")
    import traceback
    logger.error(f"[API] 예외 스택: {traceback.format_exc()}")
    
    # 요청 경로가 /api/로 시작하는 경우에만 JSON 반환
    if request.path.startswith('/api/'):
        return jsonify({
            'ok': False,
            'error': str(e),
            'type': type(e).__name__
        }), 500
    
    # /api/가 아닌 경로는 기본 처리
    return jsonify({'ok': False, 'error': 'Internal server error'}), 500


@app.after_request
def after_request(response):
    """모든 API 응답이 JSON인지 확인"""
    # /api/ 경로의 경우 Content-Type이 application/json인지 확인
    if request.path.startswith('/api/'):
        if 'application/json' not in response.content_type:
            # JSON이 아닌 경우 JSON으로 변환
            try:
                if response.status_code >= 400:
                    # 에러 응답인 경우
                    error_data = {
                        'ok': False,
                        'error': response.get_data(as_text=True)[:500] if response.data else 'Unknown error',
                        'status': response.status_code
                    }
                    response.data = json.dumps(error_data)
                    response.content_type = 'application/json'
            except Exception:
                pass
    return response


if __name__ == '__main__':
    try:
        logger.info("Flask 서버 시작 (포트 5000)")
    except:
        print("Flask 서버 시작 (포트 5000)")
    try:
        app.run(
            host='127.0.0.1',
            port=5000,
            debug=False,
            threaded=True,
            use_reloader=False
        )
    except Exception as e:
        print(f"서버 시작 실패: {e}")
        import traceback
        traceback.print_exc()
