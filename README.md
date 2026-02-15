# YouTube Auto - 자동 영상 생성 파이프라인

텍스트 대본에서 자동으로 유튜브 영상을 생성하는 파이프라인입니다.

**대본 → TTS → 자막 → FFmpeg 렌더링 → MP4 생성**

## UI는 1개만 사용 (통일)

- **개발/운영에서 쓰는 UI**: `web-ui` 하나뿐입니다.
- **접속 주소**: [http://localhost:3001](http://localhost:3001) (프로젝트 목록: `/projects?filter=active`)
- **실행 방법**: 루트에서 `start_dev.bat` 실행, 또는 `cd web-ui` 후 `npm run dev`
- `ui-only` 폴더는 별도/레거시용이므로, 일상 개발·수정은 **web-ui만** 사용하세요. (두 개 쓰면 경로·포트가 엉겨서 혼동됩니다.)

## 기능

- ✅ **TTS**: Edge TTS를 사용한 한국어 음성 생성 (무료, API 키 불필요)
- ✅ **자막**: 자동 SRT 자막 생성 (텍스트 길이 기반 타이밍)
- ✅ **렌더링**: FFmpeg를 사용한 MP4 생성
- ✅ **설정**: YAML + 환경변수 기반 통합 설정 시스템
- 🔄 **확장 예정**: OpenAI 이미지 생성, YouTube 업로드, 자동 번역

## 빠른 시작

### 1. 시스템 요구사항

**필수:**
- Python 3.8+
- FFmpeg 설치 (비디오 렌더링 필수)

**FFmpeg 설치:**

```bash
# Windows (winget 사용)
winget install ffmpeg

# macOS (Homebrew)
brew install ffmpeg

# Linux (Ubuntu/Debian)
sudo apt-get install ffmpeg

# 확인
ffmpeg -version
```

### 2. 프로젝트 설정

```bash
# 프로젝트 디렉토리로 이동
cd youtube-auto

# Python 가상환경 생성 (권장)
python -m venv .venv

# 가상환경 활성화
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

# 의존성 설치
pip install -r requirements.txt
```

### 3. 환경설정 (선택사항)

```bash
# .env 파일 생성
cp .env.example .env

# 필요한 API 키를 .env에 추가 (모두 선택사항)
# - OPENAI_API_KEY: 대본 생성, 이미지 생성 등 (선택)
# - 기타: docs/API_INTEGRATIONS.md 참고
```

### 4. 파이프라인 실행

**기본 실행:**

```bash
python main.py
```

**커스텀 대본 사용:**

```bash
python main.py --script path/to/your_script.txt
```

**음성 선택:**

```bash
# 남성 음성 (기본값은 여성)
python main.py --voice ko-KR-InJoonNeural
```

**TTS만 생성 (렌더링 건너뛰기):**

```bash
python main.py --skip-render
```

**자막 없이 생성:**


**자막 없이 생성:**

```bash
python main.py --no-subtitles
```

### 5. 통합 개발 환경 실행 (권장)

백엔드와 프론트엔드 서버를 동시에 실행하려면 프로젝트 루트에서 다음 스크립트를 실행하세요:

```bash
start_dev.bat
```

이 스크립트는 다음 작업을 수행합니다:
1. Python 가상환경 활성화
2. Flask 백엔드 서버 실행 (Port 5000)
3. Next.js 프론트엔드 서버 실행 (Port 3000)


## 폴더 구조

```
youtube-auto/
├── src/                      # 코드
│   ├── common/
│   │   ├── logger.py         # 로깅
│   │   ├── settings.py       # 설정 로더
│   │   └── utils.py          # 유틸
│   ├── video/
│   │   ├── tts.py            # TTS 생성
│   │   ├── srt.py            # 자막 생성
│   │   ├── render.py         # FFmpeg 렌더링
│   │   ├── creator.py        # 기존 영상 생성 로직
│   │   └── subtitles.py      # 기존 자막 로직
│   ├── script/               # 대본 처리
│   ├── upload/               # YouTube 업로드 (예정)
│   ├── thumbnail/            # 썰네일 이미지 생성 (예정)
│   └── report/               # 보고서 생성 (예정)
├── config/
│   ├── settings.yaml         # 파이프라인 설정
│   └── input_script.txt      # 입력 대본 (샘플)
├── outputs/
│   ├── audio/                # 생성된 오디오 (mp3/wav)
│   ├── subtitles/            # 생성된 자막 (srt)
│   ├── images/               # 사용된 이미지
│   └── videos/               # 최종 비디오 (mp4)
├── logs/                     # 실행 로그
├── tests/                    # 테스트
├── main.py                   # 메인 엔트리포인트
├── requirements.txt          # Python 의존성
├── .env.example              # 환경변수 템플릿
├── .gitignore                # Git 무시 파일
└── README.md                 # 이 파일
```

## 출력값

파이프라인 완료 후 다음 파일들이 생성됩니다:

- `outputs/audio/narration.mp3` - 생성된 음성 파일
- `outputs/subtitles/subtitles.srt` - 생성된 자막
- `outputs/images/cover.png` - 사용된 이미지
- `outputs/videos/final.mp4` - 최종 비디오 파일

## 지원하는 TTS 음성 (Edge TTS)

**한국어:**

- `ko-KR-SunHiNeural` - 여성 (기본값)
- `ko-KR-InJoonNeural` - 남성

**다른 언어 지원도 가능합니다** (예: `en-US-AriaNeural`)

## API 설정 가이드

자세한 API 설정은 [docs/API_INTEGRATIONS.md](docs/API_INTEGRATIONS.md) 를 참고하세요.

| API | 용도 | 필수 | 비용 | 상태 |
|-----|------|------|------|------|
| Edge TTS | 음성 생성 | ✅ | 무료 | ✅ 구현됨 |
| FFmpeg | 비디오 렌더링 | ✅ | 무료 | ✅ 구현됨 |
| Pillow | 이미지 처리 | - | 무료 | ✅ 구현됨 |
| OpenAI | 대본/번역/이미지 | - | 유료 | 📝 예정 |
| YouTube API | 영상 업로드 | - | 무료* | 📝 예정 |

*YouTube는 무료이지만 API 설정 필요

## 로깅 및 디버깅

로그는 실시간으로 콘솔에 출력되며, 파일로도 저장됩니다:

```bash
logs/YYYYMMDD_HHMMSS.log
```

문제 발생 시:

1. 로그 파일 확인
2. [docs/API_INTEGRATIONS.md](docs/API_INTEGRATIONS.md)의 문제 해결 섹션 참고
3. FFmpeg 설치 여부 확인
4. 인터넷 연결 확인 (TTS 사용 시)

## 예제

### 예제 1: 간단한 대본으로 영상 생성

```bash
python main.py --script config/input_script.txt
```

### 예제 2: 커스텀 대본 사용

```bash
# custom_script.txt 생성
echo "안녕하세요. 이것은 테스트 영상입니다." > custom_script.txt

# 실행
python main.py --script custom_script.txt
```

### 예제 3: 렌더링 없이 TTS와 자막만 생성

```bash
python main.py --skip-render
```

## 주의사항

1. **네트워크 필요**: Edge TTS 사용 시 인터넷 연결 필수
2. **FFmpeg 필수**: 비디오 렌더링에는 시스템 FFmpeg가 필수입니다
3. **긴 대본**: 매우 긴 대본은 처리 시간이 오래 걸릴 수 있습니다

## 라이선스

MIT

## 기여

버그 리포트 및 기능 요청은 이슈를 통해 제출해주세요.
