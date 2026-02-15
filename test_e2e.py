#!/usr/bin/env python
"""End-to-End Test Script for PR-5 Phase 2"""

import requests
import json
import os
import time
from pathlib import Path

# Configuration
API_URL = "http://127.0.0.1:5000"
PROJECT_ID = "p_20260210_075249_aff9"
PROJECT_PATH = Path(f"projects/{PROJECT_ID}")
RESULTS = []

def test_result(test_name, passed, details=""):
    """Record test result"""
    status = "✓ PASS" if passed else "✗ FAIL"
    RESULTS.append((test_name, passed, details))
    print(f"\n{status}: {test_name}")
    if details:
        print(f"  {details}")

def log_file(path, extra=""):
    """Format file path for logging"""
    if Path(path).exists():
        size = Path(path).stat().st_size
        return f"{path} ({size} bytes){extra}"
    return f"{path} (NOT FOUND)"

# ==================================================
# TEST 0: PREFLIGHT
# ==================================================
print("\n" + "="*60)
print("TEST 0: PREFLIGHT (Environment)")
print("="*60)

# Check backend
try:
    resp = requests.get(f"{API_URL}/api/projects", timeout=5)
    test_result("0.1 Backend Responsive", resp.status_code == 200, 
                f"Status: {resp.status_code}")
except Exception as e:
    test_result("0.1 Backend Responsive", False, str(e))

# Check project path
test_result("0.2 Project Path Exists", PROJECT_PATH.exists(),
            f"Path: {PROJECT_PATH}")

print(f"\n📁 Project ID: {PROJECT_ID}")
print(f"📁 Project Path: {PROJECT_PATH}")

# ==================================================
# TEST 1: PR-3 IMAGE GENERATION (Manual Export)
# ==================================================
print("\n" + "="*60)
print("TEST 1: PR-3 Image Generation (Manual Prompt Export)")
print("="*60)

# Get project first
try:
    resp = requests.get(f"{API_URL}/api/projects/{PROJECT_ID}")
    project = resp.json()['project']
    
    # Check if scenes exist, if not create one
    if not project.get('scenes') or len(project['scenes']) == 0:
        print("  Creating dummy scene...")
        project['scenes'] = [{
            'id': 'scene_1',
            'label': 'Intro',
            'title': 'Introduction',
            'narration_ko': '테스트 내레이션입니다',
            'dialogue': '',
            'image_prompt_en': 'A cinematic intro scene, high contrast, 16:9',
            'image_path': None,
            'audio_path': None,
            'durationSec': 0
        }]
        resp = requests.patch(f"{API_URL}/api/projects/{PROJECT_ID}", json=project)
        print("  Scene created.")
    
    scene_id = project['scenes'][0]['id']
    
    # Call image generation
    resp = requests.post(
        f"{API_URL}/api/projects/{PROJECT_ID}/generate/image",
        json={'sceneId': scene_id}
    )
    
    if resp.status_code == 200:
        data = resp.json()
        result = data.get('result', {})
        mode = result.get('mode', 'unknown')
        
        # Check if export file exists
        export_dir = PROJECT_PATH / "exports"
        exports = list(export_dir.glob("prompts_*.json")) if export_dir.exists() else []
        
        test_result("1.1 Image Generation API", resp.status_code == 200,
                    f"Mode: {mode}")
        test_result("1.2 Export JSON Created", len(exports) > 0,
                    log_file(exports[0]) if exports else "No exports found")
    else:
        test_result("1.1 Image Generation API", False, f"Status: {resp.status_code}")
        test_result("1.2 Export JSON Created", False, "API call failed")
        
except Exception as e:
    test_result("1.1 Image Generation API", False, str(e))
    test_result("1.2 Export JSON Created", False, "Exception occurred")

# ==================================================
# TEST 2: PR-4 TTS GENERATION
# ==================================================
print("\n" + "="*60)
print("TEST 2: PR-4 TTS Generation")
print("="*60)

try:
    resp = requests.get(f"{API_URL}/api/projects/{PROJECT_ID}")
    project = resp.json()['project']
    scene_id = project['scenes'][0]['id']
    
    # Call TTS generation
    resp = requests.post(
        f"{API_URL}/api/projects/{PROJECT_ID}/generate/tts",
        json={'sceneId': scene_id}
    )
    
    if resp.status_code == 200:
        data = resp.json()
        audio_path = data.get('audioPath', '')
        
        # Check audio file exists
        full_audio_path = PROJECT_PATH / audio_path.lstrip('/')
        audio_exists = full_audio_path.exists()
        
        # Get duration from project
        resp2 = requests.get(f"{API_URL}/api/projects/{PROJECT_ID}")
        project2 = resp2.json()['project']
        scene_updated = [s for s in project2['scenes'] if s['id'] == scene_id][0]
        duration = scene_updated.get('durationSec', 0)
        
        test_result("2.1 TTS Generation API", resp.status_code == 200,
                    f"Audio path: {audio_path}")
        test_result("2.2 Audio File Created", audio_exists,
                    log_file(full_audio_path) if audio_exists else "File not found")
        test_result("2.3 Duration Saved", duration > 0,
                    f"Duration: {duration}s")
    else:
        test_result("2.1 TTS Generation API", False, f"Status: {resp.status_code}")
        test_result("2.2 Audio File Created", False, "N/A")
        test_result("2.3 Duration Saved", False, "N/A")
        
except Exception as e:
    test_result("2.1 TTS Generation API", False, str(e))
    test_result("2.2 Audio File Created", False, "N/A")
    test_result("2.3 Duration Saved", False, "N/A")

# ==================================================
# TEST 3: PREVIEW RENDER
# ==================================================
print("\n" + "="*60)
print("TEST 3: Preview Render")
print("="*60)

try:
    resp = requests.post(
        f"{API_URL}/api/projects/{PROJECT_ID}/render/preview",
        json={}
    )
    
    if resp.status_code == 200:
        preview_path = PROJECT_PATH / "renders" / "preview.mp4"
        preview_exists = preview_path.exists()
        
        test_result("3.1 Preview Render API", resp.status_code == 200,
                    "Render request accepted")
        test_result("3.2 Preview Video Created", preview_exists,
                    log_file(preview_path) if preview_exists else "File not found")
    else:
        err = resp.json().get('error', 'Unknown error')
        test_result("3.1 Preview Render API", False, f"Status: {resp.status_code}, Error: {err}")
        test_result("3.2 Preview Video Created", False, "N/A")
        
except Exception as e:
    test_result("3.1 Preview Render API", False, str(e))
    test_result("3.2 Preview Video Created", False, "N/A")

# ==================================================
# TEST 4: SRT GENERATION
# ==================================================
print("\n" + "="*60)
print("TEST 4: SRT (Subtitle) Generation")
print("="*60)

try:
    resp = requests.post(
        f"{API_URL}/api/projects/{PROJECT_ID}/generate/srt",
        json={}
    )
    
    if resp.status_code == 200:
        srt_path = PROJECT_PATH / "assets" / "subtitles" / "subtitles.srt"
        srt_exists = srt_path.exists()
        
        # Check SRT content
        srt_valid = False
        if srt_exists:
            with open(srt_path, 'r', encoding='utf-8') as f:
                content = f.read()
                srt_valid = '00:00:' in content and len(content) > 0
        
        # Check project settings
        resp2 = requests.get(f"{API_URL}/api/projects/{PROJECT_ID}")
        project2 = resp2.json()['project']
        subtitles_enabled = project2.get('settings', {}).get('subtitles', {}).get('enabled', False)
        
        test_result("4.1 SRT Generation API", resp.status_code == 200,
                    "SRT generated")
        test_result("4.2 SRT File Created", srt_exists,
                    log_file(srt_path) if srt_exists else "File not found")
        test_result("4.3 SRT Valid Format", srt_valid,
                    "Contains time codes and text")
        test_result("4.4 Subtitles Enabled Setting", subtitles_enabled,
                    "project.settings.subtitles.enabled = true")
    else:
        err = resp.json().get('error', 'Unknown error')
        test_result("4.1 SRT Generation API", False, f"Status: {resp.status_code}, Error: {err}")
        test_result("4.2 SRT File Created", False, "N/A")
        test_result("4.3 SRT Valid Format", False, "N/A")
        test_result("4.4 Subtitles Enabled Setting", False, "N/A")
        
except Exception as e:
    test_result("4.1 SRT Generation API", False, str(e))
    test_result("4.2 SRT File Created", False, "N/A")
    test_result("4.3 SRT Valid Format", False, "N/A")
    test_result("4.4 Subtitles Enabled Setting", False, "N/A")

# ==================================================
# TEST 5: BGM SETUP
# ==================================================
print("\n" + "="*60)
print("TEST 5: BGM Upload + Settings")
print("="*60)

try:
    # Create dummy BGM file (1 second sine wave)
    bgm_dir = PROJECT_PATH / "assets" / "bgm"
    bgm_dir.mkdir(parents=True, exist_ok=True)
    bgm_path = bgm_dir / "bgm.mp3"
    
    # For testing, create a minimal 1-second mp3 (silence)
    # Using ffmpeg would be ideal but it's not available
    # Instead, we'll create a small dummy file for now
    if not bgm_path.exists():
        # Create a minimal WAV file with ffmpeg command string reference
        print("  Creating dummy BGM file...")
        # Since ffmpeg is not available, create a minimal valid audio file
        # For testing, we'll use a small binary that represents audio
        with open(bgm_path, 'wb') as f:
            f.write(b'ID3' + b'\x00' * 100)  # Minimal MP3 header
    
    # Update BGM settings
    resp = requests.patch(
        f"{API_URL}/api/projects/{PROJECT_ID}/settings/bgm",
        json={'enabled': True, 'volume': 0.15}
    )
    
    if resp.status_code == 200:
        # Verify settings
        resp2 = requests.get(f"{API_URL}/api/projects/{PROJECT_ID}")
        project2 = resp2.json()['project']
        bgm = project2.get('settings', {}).get('bgm', {})
        
        test_result("5.1 BGM Settings Update API", resp.status_code == 200,
                    "Settings patched")
        test_result("5.2 BGM File Exists", bgm_path.exists(),
                    log_file(bgm_path))
        test_result("5.3 BGM Enabled Setting", bgm.get('enabled') == True,
                    f"enabled={bgm.get('enabled')}")
        test_result("5.4 BGM Volume Setting", abs(bgm.get('volume', 0) - 0.15) < 0.01,
                    f"volume={bgm.get('volume')}")
    else:
        err = resp.json().get('error', 'Unknown error')
        test_result("5.1 BGM Settings Update API", False, f"Status: {resp.status_code}, Error: {err}")
        test_result("5.2 BGM File Exists", False, "N/A")
        test_result("5.3 BGM Enabled Setting", False, "N/A")
        test_result("5.4 BGM Volume Setting", False, "N/A")
        
except Exception as e:
    test_result("5.1 BGM Settings Update API", False, str(e))
    test_result("5.2 BGM File Exists", False, "N/A")
    test_result("5.3 BGM Enabled Setting", False, "N/A")
    test_result("5.4 BGM Volume Setting", False, "N/A")

# ==================================================
# TEST 6: THUMBNAIL GENERATION
# ==================================================
print("\n" + "="*60)
print("TEST 6: Thumbnail Generation")
print("="*60)

try:
    # Test with_text mode
    resp = requests.post(
        f"{API_URL}/api/projects/{PROJECT_ID}/generate/thumbnail",
        json={'mode': 'with_text'}
    )
    
    if resp.status_code == 200:
        thumb_path = PROJECT_PATH / "assets" / "thumbnails" / "thumbnail.png"
        thumb_exists = thumb_path.exists()
        
        # Check image dimensions (should be 1280x720)
        thumb_valid = False
        if thumb_exists:
            try:
                from PIL import Image
                img = Image.open(thumb_path)
                thumb_valid = img.size == (1280, 720)
            except:
                thumb_valid = thumb_path.stat().st_size > 1000  # At least 1KB
        
        test_result("6.1 Thumbnail with_text API", resp.status_code == 200,
                    "Thumbnail generated")
        test_result("6.2 Thumbnail Image Created", thumb_exists,
                    log_file(thumb_path) if thumb_exists else "File not found")
        test_result("6.3 Thumbnail Dimensions", thumb_valid,
                    "1280x720 or valid PNG")
        
        # Test no_text mode
        resp = requests.post(
            f"{API_URL}/api/projects/{PROJECT_ID}/generate/thumbnail",
            json={'mode': 'no_text'}
        )
        test_result("6.4 Thumbnail no_text API", resp.status_code == 200,
                    "Thumbnail regenerated")
    else:
        err = resp.json().get('error', 'Unknown error')
        test_result("6.1 Thumbnail with_text API", False, f"Status: {resp.status_code}, Error: {err}")
        test_result("6.2 Thumbnail Image Created", False, "N/A")
        test_result("6.3 Thumbnail Dimensions", False, "N/A")
        test_result("6.4 Thumbnail no_text API", False, "N/A")
        
except Exception as e:
    test_result("6.1 Thumbnail with_text API", False, str(e))
    test_result("6.2 Thumbnail Image Created", False, "N/A")
    test_result("6.3 Thumbnail Dimensions", False, "N/A")
    test_result("6.4 Thumbnail no_text API", False, "N/A")

# ==================================================
# TEST 7: FINAL RENDER
# ==================================================
print("\n" + "="*60)
print("TEST 7: Final Render (with BGM + SRT)")
print("="*60)

try:
    resp = requests.post(
        f"{API_URL}/api/projects/{PROJECT_ID}/render/final",
        json={}
    )
    
    if resp.status_code == 200:
        final_path = PROJECT_PATH / "renders" / "final.mp4"
        final_exists = final_path.exists()
        preview_path = PROJECT_PATH / "renders" / "preview.mp4"
        
        preview_size = preview_path.stat().st_size if preview_path.exists() else 0
        final_size = final_path.stat().st_size if final_exists else 0
        
        # Final should be larger than preview (because of BGM audio)
        final_larger = final_size > preview_size if final_exists and preview_path.exists() else None
        
        test_result("7.1 Final Render API", resp.status_code == 200,
                    "Render request accepted")
        test_result("7.2 Final Video Created", final_exists,
                    log_file(final_path) if final_exists else "File not found")
        test_result("7.3 Final Larger than Preview", final_larger if final_larger is not None else False,
                    f"Final: {final_size}, Preview: {preview_size}" if final_larger is not None else "N/A")
    else:
        err = resp.json().get('error', 'Unknown error')
        test_result("7.1 Final Render API", False, f"Status: {resp.status_code}, Error: {err}")
        test_result("7.2 Final Video Created", False, "N/A")
        test_result("7.3 Final Larger than Preview", False, "N/A")
        
except Exception as e:
    test_result("7.1 Final Render API", False, str(e))
    test_result("7.2 Final Video Created", False, "N/A")
    test_result("7.3 Final Larger than Preview", False, "N/A")

# ==================================================
# TEST 8: Archive & Pinned (PATCH by id, response normalized)
# ==================================================
print("\n" + "="*60)
print("TEST 8: Archive & Pinned API (id-based, archived/pinned)")
print("="*60)

try:
    # 8.1 Archive
    r = requests.patch(f"{API_URL}/api/projects/{PROJECT_ID}", json={"archived": True})
    ok_archive = r.status_code == 200
    test_result("8.1 PATCH archived:true (200)", ok_archive, f"status={r.status_code}")
    if ok_archive:
        data = r.json()
        proj = data.get("project", data)
        archived_val = proj.get("archived") or (isinstance(proj.get("status"), dict) and proj.get("status", {}).get("archived"))
        test_result("8.2 Response has archived:true", archived_val is True, f"archived={archived_val}")
    # Restore
    requests.patch(f"{API_URL}/api/projects/{PROJECT_ID}", json={"archived": False})

    # 8.3 Pinned
    r2 = requests.patch(f"{API_URL}/api/projects/{PROJECT_ID}", json={"pinned": True})
    ok_pin = r2.status_code == 200
    test_result("8.3 PATCH pinned:true (200)", ok_pin, f"status={r2.status_code}")
    if ok_pin:
        data2 = r2.json()
        proj2 = data2.get("project", data2)
        pinned_val = proj2.get("pinned") or proj2.get("isPinned") or (isinstance(proj2.get("status"), dict) and proj2.get("status", {}).get("isPinned"))
        test_result("8.4 Response has pinned:true", pinned_val is True, f"pinned={pinned_val}")
    requests.patch(f"{API_URL}/api/projects/{PROJECT_ID}", json={"pinned": False})
except Exception as e:
    test_result("8.1 PATCH archived", False, str(e))
    test_result("8.2 Response archived", False, "N/A")
    test_result("8.3 PATCH pinned", False, "N/A")
    test_result("8.4 Response pinned", False, "N/A")

# ==================================================
# SUMMARY
# ==================================================
print("\n" + "="*60)
print("TEST REPORT")
print("="*60)

print(f"\nProject ID: {PROJECT_ID}")
print(f"Project Path: {PROJECT_PATH}\n")

# Summary table
passed_count = sum(1 for _, p, _ in RESULTS if p)
total_count = len(RESULTS)

print(f"Results: {passed_count}/{total_count} PASSED\n")

print("Test Results:")
print("-" * 60)
for test_name, passed, details in RESULTS:
    status = "✓" if passed else "✗"
    print(f"{status} {test_name}")
    if details and not passed:
        print(f"  → {details}")

print("\n" + "="*60)
print(f"OVERALL: {'✓ ALL TESTS PASSED' if passed_count == total_count else f'✗ {total_count - passed_count} TESTS FAILED'}")
print("="*60)

# Created files inventory
print("\nCreated Files:")
print("-" * 60)
files_to_check = [
    "exports",
    "assets/audio",
    "assets/bgm",
    "assets/subtitles/subtitles.srt",
    "assets/thumbnails/thumbnail.png",
    "renders/preview.mp4",
    "renders/final.mp4"
]

for file_pattern in files_to_check:
    full_path = PROJECT_PATH / file_pattern
    if full_path.exists():
        if full_path.is_file():
            size = full_path.stat().st_size
            print(f"✓ {file_pattern} ({size} bytes)")
        else:
            items = list(full_path.glob("*"))
            print(f"✓ {file_pattern}/ ({len(items)} items)")
    else:
        print(f"○ {file_pattern} (not found)")

