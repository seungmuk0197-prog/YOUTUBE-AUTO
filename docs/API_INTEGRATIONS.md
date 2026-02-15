# API Integrations & Configuration Guide

이 문서는 YouTube Auto 파이프라인에서 필요한 모든 외부 API와 설정을 정리합니다.

## 목차
1. [필수 요구사항](#필수-요구사항)
2. [TTS (음성 생성)](#tts-음성-생성)
3. [LLM (대본/번역)](#llm-대본번역)
4. [이미지 생성](#이미지-생성)
5. [YouTube 업로드](#youtube-업로드)
6. [번역](#번역)

---

## 필수 요구사항

### FFmpeg (필수)
비디오 렌더링에 필수입니다.

**설치:**
```bash
# Windows (winget)
winget install ffmpeg

# macOS (Homebrew)
brew install ffmpeg

# Linux (Ubuntu/Debian)
sudo apt-get install ffmpeg
```

**확인:**
```bash
ffmpeg -version
ffprobe -version
```

**환경변수:**
```
FFMPEG_PATH=ffmpeg  # (기본값: PATH에서 자동 검색)
```

---

## TTS (음성 생성)

### 1. Edge TTS (권장 - 무료, 로컬)
- **설정 불필요!** 완전 무료이며 API 키가 필요 없습니다.
- **설치:**
  ```bash
  pip install edge-tts
  ```
- **테스트:**
  ```bash
  edge-tts --text "안녕하세요" --voice ko-KR-SunHiNeural --write-media test.mp3
  ```
- **지원 한국어 음성:**
  - `ko-KR-SunHiNeural` (여성, 기본)
  - `ko-KR-InJoonNeural` (남성)

**현재 구현:** ✅ `src/video/tts.py`에서 Edge TTS 사용

---

### 2. OpenAI TTS (선택 - 유료)
- **필요 설정:**
  ```
  OPENAI_API_KEY=sk-...
  ```
- **설치:**
  ```bash
  pip install openai
  ```
- **테스트:**
  ```bash
  from openai import OpenAI
  client = OpenAI(api_key="sk-...")
  response = client.audio.speech.create(
      model="tts-1",
      voice="alloy",
      input="Hello world"
  )
  ```

---

### 3. ElevenLabs TTS (선택 - 유료)
- **필요 설정:**
  ```
  ELEVENLABS_API_KEY=sk_...
  ```
- **API 문서:** https://elevenlabs.io/docs
- **테스트:**
  ```bash
  pip install elevenlabs
  ```

---

## LLM (대본/번역)

### OpenAI GPT (선택)
- **필요 설정:**
  ```
  OPENAI_API_KEY=sk-...
  ```
- **용도:**
  - 대본 자동 생성/개선
  - 자동 번역
- **테스트:**
  ```bash
  from openai import OpenAI
  client = OpenAI(api_key="sk-...")
  response = client.chat.completions.create(
      model="gpt-4o",
      messages=[{"role": "user", "content": "안녕"}]
  )
  print(response.choices[0].message.content)
  ```

---

## 이미지 생성

### 1. 임시 플레이스홀더 (현재 구현 - 무료)
- 설정 불필요
- **구현:** `src/video/render.py` - `create_placeholder_image()`
- 단색 배경의 간단한 PNG 이미지 생성

### 2. OpenAI DALL-E (선택 - 유료)
- **필요 설정:**
  ```
  OPENAI_API_KEY=sk-...
  ```
- **테스트:**
  ```bash
  from openai import OpenAI
  client = OpenAI(api_key="sk-...")
  image = client.images.generate(
      model="dall-e-3",
      prompt="Beautiful landscape",
      n=1,
      size="1280x720"
  )
  ```

### 3. ComfyUI (로컬, 무료)
- **설치:**
  ```bash
  git clone https://github.com/comfyanonymous/ComfyUI
  cd ComfyUI
  python main.py
  ```
- **필요 설정:**
  ```
  COMFYUI_URL=http://127.0.0.1:8188
  ```

### 4. Stable Diffusion (로컬, 무료)
- **설치:** WebUI 또는 Automatic1111 사용
- **필요 설정:**
  ```
  STABLE_DIFFUSION_URL=http://127.0.0.1:7860
  ```

---

## YouTube 업로드

### YouTube Data API v3
- **필요:**
  - 유튜브 계정
  - Google Cloud 프로젝트
  - OAuth 2.0 인증서

**설정 단계:**
1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 새 프로젝트 생성
3. "YouTube Data API v3" 활성화
4. 채널 ID 확인
   ```bash
   # 로그인 후 URL에서 확인
   https://www.youtube.com/channel/UCxxxxxx
   ```
5. OAuth 2.0 클라이언트 생성
   - 응용 프로그램 유형: "데스크탑 앱"
   - `client_secret.json` 다운로드

**필요 환경변수:**
```
YOUTUBE_CLIENT_SECRETS_PATH=/path/to/client_secret.json
YOUTUBE_TOKEN_PATH=/path/to/token.json  (자동 생성)
YOUTUBE_CHANNEL_ID=UCxxxxxx
```

**테스트:**
```bash
pip install google-auth-oauthlib google-auth-httplib2 google-api-python-client
```

**현재 상태:** 📝 `src/upload/youtube_uploader.py` (구현 예정)

---

## 번역

### 1. LibreTranslate (로컬, 무료)
- **설치 & 실행:**
  ```bash
  docker run -d -p 5000:5000 libretranslate/libretranslate
  ```
- **필요 설정:**
  ```
  TRANSLATE_ENDPOINT=http://127.0.0.1:5000/translate
  TRANSLATE_TIMEOUT=30000
  ```
- **테스트:**
  ```bash
  curl -X POST http://127.0.0.1:5000/translate \
    -H "Content-Type: application/json" \
    -d '{"q":"Hello","source":"en","target":"ko"}'
  ```

### 2. OpenAI GPT (유료)
- 이미 `OPENAI_API_KEY` 설정되면 사용 가능

---

## 빠른 시작 체크리스트

### 최소 실행 (FREE)
- ✅ FFmpeg 설치 완료
- ✅ edge-tts 설치 완료 (`pip install edge-tts`)
- ✅ Pillow 설치 완료 (`pip install pillow`)

### 다음 단계
```bash
# 1. 환경 설정
cp .env.example .env  # 필요시 수정

# 2. 의존성 설치
pip install -r requirements.txt

# 3. 파이프라인 실행
python main.py --script config/input_script.txt
```

---

## 문제 해결

### FFmpeg not found
```bash
# 재설치
winget install ffmpeg  # Windows
brew install ffmpeg    # macOS
sudo apt-get install ffmpeg  # Linux

# 또는 환경변수 설정
FFMPEG_PATH=/full/path/to/ffmpeg
```

### edge-tts 실패
```bash
# 재설치
pip install --upgrade edge-tts

# 테스트
edge-tts --text "테스트" --voice ko-KR-SunHiNeural --write-media test.mp3
```

### 네트워크 서비스 (LibreTranslate, ComfyUI 등) 연결 안 됨
- 도커 실행 여부 확인
- URL 설정 확인
- 포트 방화벽 확인

---

**최종 수정:** 2026-02-10
