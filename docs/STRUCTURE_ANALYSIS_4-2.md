# 4-2 이미지 생성 페이지 구조 분석 및 변경 계획

## 현재 구조 파악

### 1. 라우팅 현황

**현재 라우팅:**
- `/image-generation` - 독립 페이지 (localStorage 기반)
- `/project?id=...&step=...` - 프로젝트 페이지 (step 분기)
- `/create` - 프로젝트 생성 후 `/project?id=...`로 이동

**문제점:**
- `project.js`에서 `step`이 없으면 기본 `'script'`로 설정됨
  ```javascript
  const currentStep = router.query.step || 'script'; // ← 자동 진입 원인
  ```
- 프로젝트 생성/클릭 시 자동으로 대본 편집 화면이 열림

### 2. 4-2 이미지 생성 페이지 데이터 흐름

**현재 (image-generation.js):**
```javascript
// localStorage 전역 키 사용
const savedBlueprint = localStorage.getItem('step2Blueprint');
const savedScript = localStorage.getItem('generatedScript');
const savedScenes = localStorage.getItem('scenes');
const savedCharacters = localStorage.getItem('characters');
const savedImages = localStorage.getItem('generatedImages');
const savedCharImages = localStorage.getItem('generatedCharacterImages');

// projectId 추출
const projectId = blueprint?.id || 'p_20260210_155249_6d2c';
```

**문제점:**
- projectId가 URL에 없음
- localStorage가 전역이라 프로젝트 간 데이터 섞임
- blueprint가 없으면 fallback ID 사용

### 3. 백엔드 API 호출

**현재:**
- `POST /api/projects/${projectId}/generate/image` ✅ (이미 projectId 사용)
- 하지만 projectId가 localStorage의 blueprint에서 추출됨

**필요한 API:**
- `GET /api/projects/${projectId}` - 프로젝트 전체 데이터
- `GET /api/projects/${projectId}/files` - 작업파일 현황 확인

---

## 변경 계획

### Phase 1: 라우팅 구조 변경

**목표:** `/projects/:projectId` 기본 진입 시 Dashboard 표시

**변경 사항:**

1. **project.js 수정:**
   ```javascript
   // 변경 전
   const currentStep = router.query.step || 'script';
   
   // 변경 후
   const currentStep = router.query.step; // undefined면 Dashboard 표시
   ```

2. **Project Dashboard 컴포넌트 추가:**
   ```javascript
   if (!currentStep) {
       return <ProjectDashboard projectId={projectId} project={project} />;
   }
   ```

3. **4-2 이미지 생성 통합:**
   - 옵션 A: `project.js`에 `step === 'images'` 분기 추가
   - 옵션 B: `/projects/[projectId]/image-generation.js` 동적 라우트 생성

### Phase 2: 데이터 로딩 구조 통일

**목표:** projectId 기준으로 데이터 로드 및 저장

**변경 사항:**

1. **localStorage 네임스페이스 분리:**
   ```javascript
   // 변경 전
   localStorage.setItem('scenes', JSON.stringify(scenes));
   
   // 변경 후
   localStorage.setItem(`project:${projectId}:scenes`, JSON.stringify(scenes));
   ```

2. **백엔드 API 우선 사용:**
   ```javascript
   const loadProjectData = async (projectId) => {
       try {
           const project = await fetch(`/api/projects/${projectId}`);
           const data = await project.json();
           setScenes(data.scenes || []);
           setCharacters(data.characters || []);
           // ...
       } catch (error) {
           // Fallback: localStorage
           const savedScenes = localStorage.getItem(`project:${projectId}:scenes`);
           // ...
       }
   };
   ```

3. **projectId 변경 감지:**
   ```javascript
   useEffect(() => {
       if (projectId) {
           // 기존 상태 reset
           setScenes([]);
           setCharacters([]);
           setGeneratedImages({});
           // 새 데이터 로드
           loadProjectData(projectId);
       }
   }, [projectId]);
   ```

### Phase 3: Project Dashboard 구현

**구성 요소:**

1. **상단 요약 영역:**
   - 프로젝트 제목 (수정 가능 input + 저장 버튼)
   - 생성일/수정일
   - 장면 수: `project.scenes?.length || 0`
   - 전체 길이: `project.scenes.reduce((sum, s) => sum + (s.duration || 0), 0)`
   - 현재 상태: 대본/JSON/이미지/TTS/영상 존재 여부

2. **작업파일 현황 영역:**
   ```javascript
   // 백엔드 API로 파일 존재 여부 확인
   const checkFileExists = async (projectId, filePath) => {
       const res = await fetch(`/api/projects/${projectId}/files/${filePath}`);
       return res.ok;
   };
   
   // 표시할 파일들
   const files = [
       { name: 'script.txt', path: 'script.txt', action: '열기' },
       { name: 'scenes.json', path: 'scenes.json', action: '열기' },
       { name: 'characters.json', path: 'characters.json', action: '열기' },
       { name: 'scenes images', path: 'assets/images', action: '갤러리', count: true },
       { name: 'narration.mp3', path: 'assets/audio/narration.mp3', action: '재생' },
       { name: 'final.mp4', path: 'final.mp4', action: '미리보기' },
       { name: 'zip 파일', path: 'output.zip', action: '다운로드' },
   ];
   ```

3. **단계 이동 버튼:**
   ```javascript
   const steps = [
       { label: '대본 편집', step: 'script', progressKey: 'script-gen' },
       { label: 'JSON 생성', step: 'json', progressKey: 'json' },
       { label: '이미지 생성', step: 'images', progressKey: 'images' },
       { label: 'TTS 생성', step: 'tts', progressKey: 'tts' },
       { label: '영상 보안', step: 'render', progressKey: 'video-security' },
       { label: '제목/설명', step: 'meta', progressKey: 'meta' },
   ];
   
   // 클릭 시
   router.push(`/project?id=${projectId}&step=${step}`);
   ```

### Phase 4: 4-2 이미지 생성 페이지 수정

**변경 사항:**

1. **projectId 추출:**
   ```javascript
   const router = useRouter();
   const { id: projectId } = router.query;
   
   useEffect(() => {
       if (!projectId) {
           router.push('/projects');
           return;
       }
       loadProjectData(projectId);
   }, [projectId]);
   ```

2. **데이터 로딩:**
   ```javascript
   const loadProjectData = async (projectId) => {
       // 백엔드에서 프로젝트 데이터 로드
       const project = await fetch(`/api/projects/${projectId}`);
       const data = await project.json();
       
       setScenes(data.scenes || []);
       setCharacters(data.characters || []);
       
       // 이미 생성된 이미지 (localStorage 또는 백엔드)
       const savedImages = localStorage.getItem(`project:${projectId}:generatedImages`);
       if (savedImages) {
           setGeneratedImages(JSON.parse(savedImages));
       }
   };
   ```

3. **localStorage 저장:**
   ```javascript
   localStorage.setItem(`project:${projectId}:generatedImages`, JSON.stringify(newImages));
   localStorage.setItem(`project:${projectId}:generatedCharacterImages`, JSON.stringify(newCharImages));
   ```

---

## 구현 우선순위

### 1단계: 라우팅 변경 (즉시)
- `project.js`에서 step 없을 때 Dashboard 표시
- 프로젝트 생성/클릭 시 Dashboard로 이동 확인

### 2단계: Project Dashboard 기본 구조
- 상단 요약 영역
- 단계 이동 버튼 그룹
- 작업파일 현황 (기본 UI만)

### 3단계: 데이터 로딩 통일
- localStorage 네임스페이스 분리
- 백엔드 API 연동
- projectId 변경 감지

### 4단계: 4-2 페이지 통합
- projectId 기반 데이터 로드
- localStorage 네임스페이스 적용
- 백엔드 API 우선 사용

### 5단계: 작업파일 현황 완성
- 백엔드 파일 존재 여부 API 연동
- 파일 열기/다운로드 기능

---

## 수용 기준 체크리스트

- [ ] 프로젝트 카드 클릭 시 `/projects/:projectId` 대시보드로 이동
- [ ] 프로젝트 생성 직후 대시보드가 열림
- [ ] 4-2 이미지 생성은 사용자가 직접 클릭해야만 열림
- [ ] 새로고침 후에도 projectId가 유지됨
- [ ] 다른 프로젝트 갔다가 돌아와도 데이터가 섞이지 않음
- [ ] 작업파일 현황이 실제 파일 존재 여부와 일치함

---

## 참고: 현재 4-2 페이지 기능

- ✅ 캐릭터 이미지 생성 (5개/행, 핑크 액센트)
- ✅ 썸네일 이미지 생성 (3개/행, 블루 액센트)
- ✅ 스타일 선택 (18가지, 3개/행)
- ✅ 이미지 비율 선택 (16:9, 9:16)
- ✅ API 호출 (`POST /api/projects/${projectId}/generate/image`)

**유지할 기능:**
- 모든 UI/UX 기능은 그대로 유지
- 변경되는 것은 데이터 로딩 방식과 라우팅 구조만
