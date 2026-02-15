# 4-2 이미지 생성 페이지 구조 변경 계획

## 현재 구조 분석

### 1. 데이터 로딩 방식 (image-generation.js)

**현재 문제점:**
- localStorage 키가 전역으로 저장됨 (projectId 무관)
  - `step2Blueprint`
  - `generatedScript`
  - `scenes`
  - `characters`
  - `generatedImages`
  - `generatedCharacterImages`
- projectId는 `blueprint?.id` 또는 fallback `'p_20260210_155249_6d2c'` 사용
- 프로젝트 간 데이터가 섞일 수 있음

**코드 위치:**
```javascript
// image-generation.js:64-115
const loadAllData = () => {
    const savedBlueprint = localStorage.getItem('step2Blueprint');
    const savedScript = localStorage.getItem('generatedScript');
    const savedScenes = localStorage.getItem('scenes');
    // ...
    const projectId = blueprint?.id || 'p_20260210_155249_6d2c';
}
```

### 2. 라우팅 구조

**현재:**
- `/image-generation` - 독립 페이지
- localStorage에서 데이터 로드
- projectId가 URL에 없음

**변경 필요:**
- `/projects/:projectId/image-generation` 또는
- `/projects/:projectId?step=images` 형태로 전환
- projectId를 URL에서 추출하여 사용

### 3. 백엔드 API 호출

**현재:**
- `POST /api/projects/${projectId}/generate/image` - 이미 projectId 사용 중 ✅
- 하지만 projectId가 localStorage의 blueprint에서 추출됨

**변경 필요:**
- URL에서 projectId 추출
- 백엔드에서 프로젝트 데이터 로드 (`GET /api/projects/${projectId}`)
- scenes, characters 등도 백엔드에서 가져오기

---

## 변경 계획

### 1. 라우팅 변경

**신규 구조:**
```
/projects/:projectId              → ProjectDashboard (기본 진입)
/projects/:projectId?step=images → 4-2 이미지 생성 (기존 image-generation.js)
```

**변경 사항:**
- `image-generation.js` → `project.js` 내부 step 분기로 통합 또는
- `/projects/[projectId]/image-generation.js` 동적 라우트 생성

### 2. 데이터 로딩 구조 통일

**변경 전:**
```javascript
// localStorage 전역 키
localStorage.getItem('scenes')
localStorage.getItem('characters')
localStorage.getItem('generatedImages')
```

**변경 후:**
```javascript
// projectId 네임스페이스 분리
const projectId = router.query.projectId;
localStorage.getItem(`project:${projectId}:scenes`)
localStorage.getItem(`project:${projectId}:characters`)
localStorage.getItem(`project:${projectId}:generatedImages`)

// 또는 백엔드 API 사용
const project = await fetch(`/api/projects/${projectId}`);
const scenes = project.scenes;
const characters = project.characters;
```

### 3. Project Dashboard 통합

**새로운 구조:**
```
ProjectDashboard (/projects/:projectId)
├── [상단 요약 영역]
│   ├── 프로젝트 제목 (수정 가능)
│   ├── 생성일/수정일
│   ├── 장면 수
│   ├── 전체 길이(초)
│   └── 현재 상태
│
├── [작업파일 현황 영역]
│   ├── script.txt [열기]
│   ├── scenes.json [열기]
│   ├── characters.json [열기]
│   ├── scenes images (11/11) [갤러리]
│   ├── narration.mp3 [재생]
│   ├── final.mp4 [미리보기]
│   └── zip 파일 [다운로드]
│
└── [단계 이동 버튼]
    ├── 대본 편집 → /projects/:projectId?step=script
    ├── JSON 생성 → /projects/:projectId?step=json
    ├── 이미지 생성 → /projects/:projectId?step=images  ← 4-2
    ├── TTS 생성 → /projects/:projectId?step=tts
    └── ...
```

### 4. 4-2 이미지 생성 페이지 수정

**변경 사항:**

1. **projectId 추출:**
   ```javascript
   const router = useRouter();
   const { projectId } = router.query;
   if (!projectId) {
       router.push('/projects');
       return;
   }
   ```

2. **데이터 로딩:**
   ```javascript
   useEffect(() => {
       if (projectId) {
           loadProjectData(projectId);
       }
   }, [projectId]);

   const loadProjectData = async (projectId) => {
       // 백엔드에서 프로젝트 데이터 로드
       const project = await fetch(`/api/projects/${projectId}`);
       setScenes(project.scenes || []);
       setCharacters(project.characters || []);
       
       // 또는 localStorage (네임스페이스 분리)
       const savedScenes = localStorage.getItem(`project:${projectId}:scenes`);
       // ...
   };
   ```

3. **localStorage 저장:**
   ```javascript
   // 변경 전
   localStorage.setItem('generatedImages', JSON.stringify(newImages));
   
   // 변경 후
   localStorage.setItem(`project:${projectId}:generatedImages`, JSON.stringify(newImages));
   ```

4. **이미지 URL 처리:**
   - 백엔드가 반환하는 `imageUrl`은 상대 경로: `/api/projects/{projectId}/files/assets/images/{filename}`
   - 현재 코드에서 `window.location.origin`을 붙이고 있음 → 유지

---

## 구현 단계

### Phase 1: 라우팅 구조 변경
1. `/projects/[projectId].js` 생성 (ProjectDashboard)
2. `image-generation.js`를 `/projects/[projectId]/image-generation.js`로 이동 또는
3. `project.js`에 step 분기 추가하여 `step=images` 처리

### Phase 2: 데이터 로딩 통일
1. localStorage 키를 `project:{projectId}:...` 형식으로 변경
2. 백엔드 API 호출 추가 (`GET /api/projects/:projectId`)
3. projectId 변경 시 상태 reset 로직 추가

### Phase 3: Project Dashboard 구현
1. 상단 요약 영역 UI
2. 작업파일 현황 영역 (파일 존재 여부 확인 API 연동)
3. 단계 이동 버튼 그룹

### Phase 4: 기존 자동 진입 제거
1. 프로젝트 카드 클릭 시 대시보드로 이동
2. 프로젝트 생성 후 대시보드로 이동
3. step=3 자동 세팅 코드 제거

---

## 수용 기준 (완료 조건)

- ✅ 프로젝트 카드 클릭 시 `/projects/:projectId` 대시보드로 이동
- ✅ 프로젝트 생성 직후 대시보드가 열림
- ✅ 4-2 이미지 생성은 사용자가 직접 클릭해야만 열림
- ✅ 새로고침 후에도 projectId가 유지됨
- ✅ 다른 프로젝트 갔다가 돌아와도 데이터가 섞이지 않음
- ✅ 작업파일 현황이 실제 파일 존재 여부와 일치함

---

## 참고: 현재 4-2 페이지 주요 기능

1. **캐릭터 이미지 생성**
   - 5개/행 그리드 레이아웃
   - 핑크 액센트 (다크 테마)
   - 플레이스홀더: "기다리다"

2. **썸네일(씬) 이미지 생성**
   - 3개/행 그리드 레이아웃
   - 블루 액센트 (다크 테마)
   - 플레이스홀더: "GEN"

3. **스타일 선택**
   - 3개/행 그리드
   - 18가지 스타일 옵션

4. **이미지 비율 선택**
   - 16:9 (롱폼)
   - 9:16 (숏폼)

5. **API 호출**
   - `POST /api/projects/${projectId}/generate/image`
   - 이미 projectId 사용 중 ✅

---

## 다음 단계

1. `/projects/[projectId].js` 생성 (ProjectDashboard)
2. `image-generation.js`를 projectId 기반으로 수정
3. localStorage 네임스페이스 분리
4. 백엔드 API 연동 강화
