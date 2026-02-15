# YouTube Auto Studio - 전체 구조 개요

## 1. 진행 단계 (10단계)

| 단계 | 키 | 라벨 | 페이지/라우트 | 비고 |
|------|-----|------|----------------|------|
| 1 | topic | 주제 추천 | `/` (index.js) | 주제/대본 입력, 트렌드 TOP 20 |
| 2 | script-plan | 대본 기획 | `/script-planning` | |
| 3 | script-gen | 대본 생성 | `/script-generation` | LLM 대본 생성 → `/api/script` |
| 4-1 | json | JSON 생성 | `/json-generation` | 대본→장면/캐릭터 분석, scenes/characters 저장 |
| **4-2** | **images** | **이미지 생성** | **`/image-generation`** | **씬/캐릭터 이미지 생성** |
| 5 | tts | TTS 생성 | `/tts-generation` | |
| 6 | video-security | 영상보안 | (project step) | |
| 7 | meta | 제목/설명작성 | (project step) | |
| 8 | thumbnail | 썸네일 생성기 | (project step) | |
| 9 | shorts | 쇼츠 쇼 제작기 | (project step) | |
| 10 | intro | 인트로 생성기 | (project step) | |

---

## 2. 4-2. 이미지 생성 상세

### 2.1 프론트엔드 (web-ui)

**파일:** `web-ui/pages/image-generation.js`

**데이터 소스 (localStorage):**
- `step2Blueprint` → blueprint (프로젝트 메타)
- `generatedScript` → 대본 텍스트
- `scenes` → 장면 배열 (id, imagePrompt, sequence, duration 등)
- `characters` → 캐릭터 배열 (id, name, role, description)
- `generatedImages` → { sceneId: { url, metadata } } (씬 이미지)
- `generatedCharacterImages` → { characterId: { url, metadata } } (캐릭터 이미지)

**주요 기능:**
- **스타일 선택:** IMAGE_STYLES (기본, 50년대 영화, 조선시대 사극, …)
- **비율:** 16:9 / 9:16
- **씬 이미지:** 전체 생성, 개별 생성, 재생성, 파일로 교체, 다운로드
- **캐릭터 이미지:** 전체/개별 생성
- **다음 단계:** TTS 생성 페이지로 이동 (`/tts-generation`), `projectData` localStorage 저장

**API 호출:**
- `POST /api/projects/:projectId/generate/image`
  - Body: `{ prompt, sceneId, sequence?, aspectRatio, style? }`
  - 응답: `{ ok, imageUrl, localPath?, filename? }` 또는 `{ error, message? }`

**라우팅:**  
- 진입: JSON 생성 페이지 등에서 `router.push('/image-generation')`  
- 사이드바: `StudioLayout`의 `activeStep="images"`로 4-2 강조

### 2.2 API 라우팅 (Next.js → Flask)

**next.config.js:**
```js
rewrites: [{ source: '/api/:path*', destination: 'http://127.0.0.1:5000/api/:path*' }]
```
- 브라우저 요청 `/api/projects/xxx/generate/image` → `http://127.0.0.1:5000/api/projects/xxx/generate/image` 로 전달

### 2.3 백엔드 (Flask)

**파일:** `backend/api.py`

**엔드포인트:** `POST /api/projects/<project_id>/generate/image`

**동작 요약:**
- Body: `sceneId`, `prompt` 필수. `sequence`, `aspectRatio`(16:9|9:16|1:1), `style` 등 선택
- `OPENAI_API_KEY` 사용 (단일 키)
- DALL-E 3 호출: `model="dall-e-3"`, size는 aspectRatio에 따라 1792x1024 / 1024x1792 / 1024x1024
- 이미지 다운로드 후 `projects/<id>/assets/images/` 에 저장
- 응답: `imageUrl` = `/api/projects/<id>/files/assets/images/<filename>` 형태

**프로젝트/파일:**  
- `backend/project_manager.py` → 프로젝트 디렉터리/생성  
- `backend/models.py` → Scene 등 모델 정의

---

## 3. 디렉터리 구조 (요약)

```
youtube-auto/
├── .env                    # 루트 환경변수 (OPENAI_API_KEYS, GEMINI_*, LLM_PROVIDER 등)
├── backend/
│   ├── api.py              # Flask API (이미지 생성 포함)
│   ├── models.py
│   └── project_manager.py
├── web-ui/
│   ├── .env                # NEXT_PUBLIC_*, LLM_PROVIDER 등
│   ├── next.config.js      # /api → 127.0.0.1:5000 리라이트
│   ├── lib/
│   │   ├── api.js          # fetchProjects, fetchProject 등
│   │   └── llm.ts          # callLLM, OpenAI/Gemini 폴백
│   ├── pages/
│   │   ├── index.js        # 1. 주제/대본 입력
│   │   ├── script-planning.js
│   │   ├── script-generation.js  # 3. 대본 생성 → /api/script
│   │   ├── json-generation.js    # 4-1. JSON(장면/캐릭터)
│   │   ├── image-generation.js   # 4-2. 이미지 생성 ← 현재 작업
│   │   ├── tts-generation.js     # 5. TTS
│   │   ├── project.js      # 프로젝트 상세 (step별 콘텐츠)
│   │   ├── projects.js     # 프로젝트 목록
│   │   ├── create.js       # 프로젝트 생성
│   │   └── api/
│   │       ├── generate.ts # POST /api/generate (LLM 텍스트)
│   │       ├── script.js   # POST /api/script (대본 생성)
│   │       └── translate.js
│   └── components/
│       └── StudioLayout.js  # 진행 단계 10개, 현재 프로젝트, 헤더
└── docs/
    └── STRUCTURE_OVERVIEW.md  # 이 문서
```

---

## 4. 4-2 작업 시 참고 포인트

1. **이미지 생성 API**  
   - 프론트: `image-generation.js` 내 `generateSingleImage`, `generateCharacterImage`  
   - 백엔드: `backend/api.py` 의 `generate_image()`  
   - 현재 백엔드는 **단일 OPENAI_API_KEY** 사용. 여러 키 폴백이 필요하면 `api.py`에서 LLM 폴백과 유사하게 키 순환 로직 추가 가능.

2. **데이터 흐름**  
   - 4-1(JSON 생성) → `scenes`, `characters`, `step2Blueprint`, `generatedScript` 저장  
   - 4-2(이미지 생성) → 위 데이터 로드 후 `/api/projects/:id/generate/image` 호출  
   - 생성된 이미지 URL은 `generatedImages` / `generatedCharacterImages`와 localStorage에 유지.

3. **프로젝트 ID**  
   - `blueprint.id` 또는 localStorage 기반 프로젝트 식별자.  
   - 백엔드에 프로젝트가 없으면 404. 실제 연동 시 프로젝트 생성/조회(예: `project_manager`)와 맞춰야 함.

4. **다음 단계**  
   - 4-2 완료 후 `handleProceedToTTS` → `projectData` 저장, `/tts-generation` 이동.

이제 4-2에서 수정/추가하고 싶은 동작을 알려주시면, 해당 부분만 골라서 구체적으로 수정안을 제안하겠습니다.
