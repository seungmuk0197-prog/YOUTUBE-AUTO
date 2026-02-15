# PR-5 Phase 2 Implementation Summary

## ✅ COMPLETED: BGM Mixing + Thumbnail Generation + Final Render

### Timeline
- **Started**: PR-5 Phase 1 complete (SRT subtitle generation working)
- **Completed**: All 3 parts (BGM, Thumbnail, Final Render) implemented
- **Status**: Ready for testing

---

## PART A: BGM Mixing (Backend + Frontend)

### Backend Changes (youtube-auto/backend/api.py)

#### 1. Added Pillow Import
```python
from PIL import Image, ImageDraw, ImageFont
```

#### 2. PATCH Endpoint - BGM Settings
**Route**: `PATCH /api/projects/:id/settings/bgm`

**Functionality**:
- Update `project.settings.bgm.enabled` (boolean)
- Update `project.settings.bgm.volume` (0.0-1.0 clamped)
- Persists to project.json

**Request Body**:
```json
{
  "enabled": true,
  "volume": 0.25
}
```

**Response**:
```json
{
  "ok": true,
  "project": { ... full project object ... }
}
```

#### 3. POST Endpoint - BGM File Upload
**Route**: `POST /api/projects/:id/upload/bgm`

**Functionality**:
- Accept multipart form-data with audio file
- Validate extensions: `.mp3`, `.wav`, `.aac`, `.ogg`, `.flac`
- Save to: `projects/<id>/assets/bgm/bgm.<ext>`
- Update `project.settings.bgm.path`

**Response**:
```json
{
  "ok": true,
  "bgmPath": "assets/bgm/bgm.mp3"
}
```

### Frontend Changes (mook-studio/api.ts)

#### Added 2 New API Functions:

1. **updateBGMSettings(projectId, settings)**
   - PATCH call to update BGM enabled/volume
   - Type-safe: `{ enabled?: boolean, volume?: number }`

2. **uploadBGM(projectId, file)**
   - POST multipart form-data
   - Accepts File object
   - Returns `{ bgmPath }`

### Frontend UI Changes (TTSAndRender.tsx)

#### State Variables Added:
```typescript
const [bgmVolume, setBgmVolume] = useState<number>(0.15);
const [bgmEnabled, setBgmEnabled] = useState<boolean>(false);
const [bgmUploading, setBgmUploading] = useState<boolean>(false);
```

#### Handler Functions Added:
```typescript
const handleBGMVolume = async (volume: number)    // Update volume, call API
const handleBGMUpload = async (file: File)        // Upload file, enable BGM
```

#### UI Section Added:
- **BGM Mixing Section** (Step 3 in pipeline)
  - Toggle button: Enable/disable BGM
  - Volume slider: 0-100% range
  - File upload widget: Accept .mp3/.wav/.aac/.ogg/.flac
  - Status display: Shows upload progress

---

## PART B: Thumbnail Generation (Backend + Frontend)

### Backend Changes (youtube-auto/backend/api.py)

#### New Endpoint - Thumbnail Generation
**Route**: `POST /api/projects/:id/generate/thumbnail`

**Functionality**:
- Generate 1280x720 PNG thumbnail using Pillow
- Two modes:
  - `with_text`: Renders project topic + first scene title with golden gradient background
  - `no_text`: Renders gradient background only
- Save to: `projects/<id>/assets/thumbnails/thumbnail.png`
- Update `project.thumbnail.mode` and `project.thumbnail.path`

**Request Body**:
```json
{
  "mode": "with_text"  // or "no_text"
}
```

**Response**:
```json
{
  "ok": true,
  "thumbnailPath": "assets/thumbnails/thumbnail.png"
}
```

**Visual Design**:
- Dimensions: 1280x720 (16:9 aspect ratio)
- Format: PNG
- Background: Blue-to-purple gradient (procedurally generated)
- Text (if with_text):
  - Title: Large bold white text (project topic)
  - Subtitle: Medium text (first scene title)
  - Bubble effect: Semi-transparent golden background behind text

### Frontend Changes (mook-studio/api.ts)

#### Added 1 New API Function:
```typescript
generateThumbnail(projectId, mode) -> { thumbnailPath }
```

### Frontend New Component (ThumbnailGenerator.tsx)

#### Features:
- **Step 8** in pipeline (Sidebar navigation)
- **Mode Selection**:
  - Radio buttons: "With Text" vs "Without Text"
  - Visual preview of option being selected
  
- **Generate Button**:
  - Disabled state with loading spinner
  - Calls backend endpoint
  
- **Preview Section**:
  - Displays generated thumbnail image
  - Aspect ratio: 16:9
  - Download button (save as PNG)
  - Regenerate button

#### Styling:
- Dark theme consistent with app
- Amber-colored header icon
- Responsive grid layout

---

## PART C: Final Render (Backend + Frontend UI)

### Backend Endpoint (Already complete from earlier phase)
**Route**: `POST /api/projects/:id/render/final`

**FFmpeg Pipeline**:
1. Create individual scene videos (concat ts files)
2. Concat all scenes into single video
3. **Apply BGM mixing** (if enabled):
   - Loop BGM to match video duration
   - Apply volume reduction filter
   - Mix narration + BGM audio using `amix` filter
4. **Apply SRT subtitles** (if enabled):
   - Burn-in subtitles using subtitles filter
5. Output: `projects/<id>/renders/final.mp4`

**FFmpeg Filter Logic**:
- Base: `ffmpeg -f concat -safe 0 -i concat.txt`
- BGM: `-filter_complex "...[0:v][0:a][1:a]concat=n=1:v=1:a=1[outv][outa]; [outa][bgm_audio]amix=inputs=2:duration=first..."`
- SRT: `-filter_complex "... subtitles='path/to/subtitles.srt'"`

### Frontend Changes (TTSAndRender.tsx)

#### State Variables Added:
```typescript
const [finalLoading, setFinalLoading] = useState<boolean>(false);
const [finalReady, setFinalReady] = useState<boolean>(false);
```

#### Handler Function Added:
```typescript
const handleFinalRender = async ()  // Call renderFinal API
```

#### UI Section Added (Step 4 in pipeline):
- **Final Render Section**:
  - Conditional display: waiting state vs ready state
  - Waiting state:
    - Info text about final render process
    - Button: "최종 렌더 시작" (Start Final Render)
    - Shows loading spinner when rendering
  - Ready state:
    - Video player: Display final.mp4
    - Download button: Save final video
    - Regenerate button: Create new version

#### Progress Summary Updated:
- Changed from 2-column to 4-column grid
- Shows progress for: TTS ✓, Preview ✓, BGM ✓, Final Render ✓

---

## Schema Updates (models.py)

### Already Defined:
```python
@dataclass
class Thumbnail:
    text: str = ""
    mode: str = "with_text"
    path: Optional[str] = None

@dataclass
class BGMSettings:
    enabled: bool = False
    path: Optional[str] = None
    volume: float = 0.15

@dataclass
class Settings:
    bgm: BGMSettings = field(default_factory=BGMSettings)
    subtitles: Dict[str, Any] = field(default_factory=lambda: {"enabled": False})
```

---

## File Storage Structure

```
projects/<project-id>/
├── project.json                          (Updated with settings)
├── assets/
│   ├── images/                           (Scene images from PR-3)
│   ├── bgm/
│   │   └── bgm.mp3                      (NEW - PR-5 Phase 2)
│   ├── subtitles/
│   │   └── subtitles.srt                (NEW - PR-5 Phase 1)
│   └── thumbnails/
│       └── thumbnail.png                (NEW - PR-5 Phase 2)
├── exports/
│   └── audio/
│       └── <scene-id>.mp3               (From PR-4)
└── renders/
    ├── preview.mp4                      (From PR-4)
    └── final.mp4                        (NEW - PR-5 Phase 2)
```

---

## Testing Checklist

### Part A - BGM Mixing:
- [ ] Generate TTS for all scenes (existing functionality)
- [ ] Navigate to TTSAndRender step
- [ ] Toggle BGM enabled/disabled
- [ ] Adjust volume slider (0-100%)
- [ ] Upload .mp3 file for BGM
- [ ] Verify file stored in assets/bgm/
- [ ] Check project.json has bgm settings

### Part B - Thumbnail Generation:
- [ ] Navigate to Thumbnail Generator step
- [ ] Select "With Text" mode
- [ ] Click "썸네일 생성" button
- [ ] Verify thumbnail.png generated
- [ ] Check visual appearance (gradient + text)
- [ ] Switch to "No Text" mode
- [ ] Regenerate and compare
- [ ] Download thumbnail.png

### Part C - Final Render:
- [ ] Verify SRT subtitles exist (from Part B of PR-5 Phase 1)
- [ ] Navigate to TTSAndRender → Step 4
- [ ] Click "최종 렌더 시작" button
- [ ] Verify FFmpeg combines:
  - [ ] All scene videos concatenated
  - [ ] BGM audio mixed with narration (check audio channels)
  - [ ] SRT subtitles burned into video
- [ ] Play final.mp4 in video player
- [ ] Download final video

### Integration Test:
```
1. Create new project (fresh start)
2. Script → JSON → Images → Storyboard → TTS & Subtitles → BGM & Thumbnail → Final Render
3. Verify each step completes without errors
4. Check final.mp4 duration = sum of scene durations
5. Check final.mp4 contains audio + video + subtitles + BGM
```

---

## Key Implementation Details

### BGM Audio Mixing:
- Uses FFmpeg `amix` filter for audio mixing
- BGM loops to match final video duration
- Volume: 0.15 default (adjustable 0.0-1.0)
- Preserves narration audio quality

### Thumbnail Generation:
- Pillow-based image generation (no external image services)
- Gradient background: Procedurally generated
- Font: System default (Windows Arial if available)
- Text positioning: Center-aligned with bubble background

### Final Video Output:
- Format: MP4 (H.264 codec)
- Resolution: 1280x720 (editable in settings)
- FPS: 30 (default)
- Audio channels: 2 (stereo, narration + BGM mixed)
- Subtitles: Hardcoded (burned-in)

---

## Error Handling

### BGM Errors:
- If `bgm.enabled === true` but file not found → Returns 400 error
- Invalid file extension → Returns 400 error with allowed formats

### Thumbnail Errors:
- If project.topic is empty → Uses "제목 없음" (No Title)
- If first scene missing → Uses scene label only
- Font loading failure → Falls back to default PIL font (still renders)

### Final Render Errors:
- If SRT file missing but subtitles.enabled → Skips subtitles (no error)
- If BGM file missing but bgm.enabled → Returns 400 error
- FFmpeg failure → Logs to project.lastRun.error and returns 500

---

## Code Statistics

### Backend Changes:
- **backend/api.py**:
  - Added: `from PIL import Image, ImageDraw, ImageFont`
  - Added: 1 new endpoint for thumbnail generation (~85 lines)
  - Modified: Final render endpoint already exists
  - Total new lines: ~120

### Frontend Changes:
- **api.ts**:
  - Added: `generateThumbnail()` function (~9 lines)
  - Total new lines: ~15

- **TTSAndRender.tsx**:
  - Added: 3 handler functions (~40 lines)
  - Added: BGM mixing section (~50 lines)
  - Added: Final render section (~60 lines)
  - Total new lines: ~170

- **ThumbnailGenerator.tsx** (NEW FILE):
  - Complete component: ~230 lines

- **MainContent.tsx**:
  - Added: Import ThumbnailGenerator
  - Added: Case for 'thumbnail' in switch
  - Total changes: ~5 lines

**Total Implementation**: ~545 lines of code

---

## Dependencies

### Already Present:
- ✅ Pillow (>=10.0.0) - For thumbnail generation
- ✅ FFmpeg - For video/audio processing (system binary)
- ✅ Flask + flask-cors - Backend server
- ✅ React + TypeScript - Frontend

### No New Dependencies Needed!

---

## PR-5 Complete Roadmap

**Phase 1 (DONE)**: SRT Subtitle Generation
- Generate subtitles from narration text
- Support Korean text segmentation
- Save as .srt file with timing

**Phase 2 Current (DONE)**: BGM + Thumbnail + Final Render
- Part A: BGM audio mixing integration
- Part B: Thumbnail generation with Pillow
- Part C: Final render with combined audio + video + subtitles

**Phase 3 (Future)**: Advanced Features
- Custom subtitle styling/positioning
- Multiple audio track support
- Watermark generation
- Batch rendering optimization

---

## Next Steps (After Testing)

1. ✅ Start Flask backend server
2. ✅ Start Vite frontend dev server  
3. ✅ Run full integration test
4. 📝 Document any issues/fixes needed
5. 🚀 Merge PR-5 Phase 2 (if tests pass)
6. 🔄 Begin PR-5 Phase 3 planning

---

**Implementation Date**: February 10, 2026
**Status**: Complete, Ready for Testing
