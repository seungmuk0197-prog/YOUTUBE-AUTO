# YouTube Auto Studio - Web UI

독립형 Next.js 웹 UI로, YouTube 자동화 스튜디오의 프로젝트 편집 인터페이스를 제공합니다.

## 구조

```
web-ui/
├── pages/
│   ├── index.js        # 프로젝트 목록 페이지
│   └── project.js      # 프로젝트 편집 페이지 (6단계: 대본/TTS/자막/썸네일/BGM/렌더링)
├── lib/
│   └── api.js          # 백엔드 API 수동, 목데이트 데이터 포함
├── public/             # 정적 파일
├── .env.local          # 환경 변수
├── next.config.js      # Next.js 설정
├── package.json        # 의존성
└── .eslintrc.json      # ESLint 설정
```

## 설치 및 실행

### 1. 의존성 설치
```bash
cd web-ui
npm install
```

### 2. 개발 서버 시작
```bash
npm run dev
```

서버가 시작되면 **http://localhost:3000** 에서 UI에 접근할 수 있습니다.

### 3. 백엔드 서버 확인
프로젝트 생성/편집 기능을 사용하려면 백엔드 Flask 서버가 실행 중이어야 합니다:
```bash
# 프로젝트 루트에서
python main.py
```

백엔드 서버는 **http://localhost:5000** 에서 실행됩니다.

## API 레이어

[lib/api.js](lib/api.js)는 모든 백엔드 API 호출을 추상화하며, 개발 중 백엔드가 연결되지 않았을 때 자동으로 목 데이터를 반환합니다.

### 사용 가능한 API 함수

- `fetchProjects()` - 모든 프로젝트 조회
- `fetchProject(projectId)` - 특정 프로젝트 상세 조회
- `saveScript(projectId, text)` - 대본 저장
- `generateTTS(projectId, sceneId, voice, speed)` - TTS 음성 생성
- `generateSubtitles(projectId)` - 자막 생성
- `generateThumbnail(projectId, title, bgColor)` - 썸네일 생성
- `uploadBGM(projectId, file)` - BGM 업로드
- `startRender(projectId)` - 최종 영상 렌더링

## 환경 변수

[.env.local](.env.local)에서 다음 변수를 설정할 수 있습니다:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api    # 백엔드 API 엔드포인트
NEXT_PUBLIC_WS_URL=ws://localhost:5000                 # WebSocket URL (향후 사용)
```

## 기능

### 프로젝트 목록
- 생성된 모든 프로젝트의 그리드 표시
- 각 프로젝트의 상태 태그 표시 (✓ 대본, ✓ TTS, ✓ 렌더링)
- 새 프로젝트 생성 폼

### 프로젝트 편집 (6단계)

1. **📝 대본** - 영상 나레이션 스크립트 작성 및 저장
2. **🔊 TTS** - AI 음성으로 대본 읽기 (음성/속도 선택)
3. **📝 자막** - TTS 오디오로부터 자동 자막 생성
4. **📸 썸네일** - 제목과 배경색으로 AI 썸네일 생성
5. **🎵 BGM** - 배경 음악 추가 및 볼륨 조정
6. **🎬 렌더링** - 최종 영상 생성

## 빌드 및 배포

프로덕션 환경:
```bash
npm run build
npm start
```

## 개발

코드 스타일 점검:
```bash
npm run lint
```

## 주의사항

- UI는 **Next.js 16.1.6** 및 **React 18.2.0**으로 구성되어 있습니다.
- 목 데이터 모드에서는 실제 데이터 저장 없이 "Not connected yet" 메시지가 표시됩니다.
- 항상 백엔드 서버가 http://localhost:5000 에서 실행 중이어야 실제 기능이 작동합니다.

## 트러블슈팅

### 포트 3000이 이미 사용 중인 경우
```bash
npm run dev -- -p 3001
```

### CSS 스타일이 적용되지 않는 경우
브라우저 개발자 도구에서 캐시를 비우고 페이지를 새로고침하세요.

### API 연결 오류
1. 백엔드 서버가 실행 중인지 확인
2. `.env.local` 의 `NEXT_PUBLIC_API_BASE_URL` 값 확인
3. 브라우저 콘솔에서 네트워크 요청 상태 확인
