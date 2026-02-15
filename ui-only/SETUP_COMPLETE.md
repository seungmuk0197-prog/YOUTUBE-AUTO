# Setup Guide: UI-Only Standalone Next.js App

## Summary of Changes

This guide documents the creation of a standalone Next.js UI at `ui-only/web` that works with Flask backend on `http://localhost:5000`, extracted from the monorepo without monorepo dependencies.

## What Was Done

### 1. ✅ Router Type Detection
- **Result:** Pages Router (confirmed via `pages/` directory structure)
- **Action:** No refactoring needed - kept as-is
- **Files:** `pages/index.js`, `pages/step-*.js`, new `pages/editor.js`

### 2. ✅ Safe Fork Created
- **Path:** `ui-only/web/` (new directory in youtube-auto root)
- **Source:** Copied entire `apps/ai-automation/web` from monorepo
- **Contents:** All source files, configs, public assets

### 3. ✅ Removed Monorepo Dependencies
- **Removed from package.json:**
  - `"@hanra/api": "*"`
  - `"@hanra/server": "*"`
  - `"@sentry/nextjs": "^7.80.0"` (optional)
- **Kept:** `next`, `react`, `react-dom`, `eslint`
- **Result:** Package is now standalone and installable

### 4. ✅ Added API Proxy Layer
- **Method:** Next.js rewrites in `next.config.js`
- **Rule:** `/api/:path*` → `http://localhost:5000/api/:path*`
- **Result:** All client requests to `/api/*` are proxied to Flask backend

### 5. ✅ Created API Wrapper
- **File:** `lib/api.js` (new)
- **Functions:**
  - `apiFetch(path, options)` - Core fetch wrapper
  - `apiGet(path)` - GET helper
  - `apiPost(path, data)` - POST helper with JSON
  - `apiPut(path, data)` - PUT helper
  - `apiDelete(path)` - DELETE helper
  - `apiPostFormData(path, formData)` - POST with files
- **Features:** Error handling, JSON parsing, same-origin calls
- **Usage:**
  ```javascript
  import { apiGet, apiPost } from '../lib/api';
  const projects = await apiGet('projects');
  const newProject = await apiPost('projects', { name: 'My Project' });
  ```

### 6. ✅ Updated Pages to Use Flask API
- **pages/index.js** (updated):
  - Loads projects: `GET /api/projects`
  - Creates project: `POST /api/projects`
  - Navigates to editor: `/editor?id={projectId}`
  - Shows error state when backend unavailable
  - Uses API wrapper for all calls
  
- **pages/editor.js** (new):
  - Loads project details: `GET /api/projects/{id}`
  - Displays project info and metadata
  - Shows workflow step placeholders
  - Clean UI without monorepo dependencies

- **Legacy pages:** `step-2.js`, `step-3.js`, etc. (copied but not updated)
  - Status: ⚠️ May not work without monorepo packages
  - Recommendation: Update or remove in future

### 7. ✅ Environment Configuration
- **File:** `.env.local` (new)
  ```env
  NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
  NEXT_PUBLIC_WS_URL=ws://localhost:5000
  ```
- **Purpose:** Environment variables for development
- **Note:** API proxy handles actual routing

### 8. ✅ Documentation Created
- **README_SETUP.md:** Comprehensive setup guide with:
  - Quick start instructions
  - Architecture overview
  - Page descriptions
  - API integration patterns
  - Troubleshooting
  - File structure

# Verification Checklist

## Pre-Launch Verification

### ✅ File Structure
```
C:\Users\채승묵\projects\youtube-auto\ui-only\web\
├── pages/
│   ├── index.js ✅ (updated)
│   ├── editor.js ✅ (new)
│   ├── step-*.js (legacy)
│   └── ...
├── lib/
│   └── api.js ✅ (new)
├── components/
├── utils/
├── public/
├── scripts/
├── .env.local ✅ (new)
├── .eslintrc.json
├── next.config.js ✅ (updated)
├── package.json ✅ (updated)
├── README_SETUP.md ✅ (new)
└── ...
```

### ✅ Configuration Files

**package.json:**
```bash
# Verify no @hanra packages
npm list 2>/dev/null | grep -i hanra
# Should return: (empty)

# Verify dependencies
npm list next react react-dom
# Should show: next@16.1.6, react@18.2.0, react-dom@18.2.0
```

**next.config.js:**
- ✅ rewrites() includes `/api/:path*` → `http://localhost:5000/api/:path*`
- ✅ env.NEXT_PUBLIC_API_BASE_URL = `http://localhost:5000`
- ✅ No references to monorepo packages

**.env.local:**
- ✅ `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api`
- ✅ `NEXT_PUBLIC_WS_URL=ws://localhost:5000`

## Launch Sequence

### Step 1: Install Dependencies
```bash
cd C:\Users\채승묵\projects\youtube-auto\ui-only\web
npm install
```

**Expected output:**
```
added 438 packages in 45s
```

**If error:** `npm ERR! 404 Not Found - GET https://registry.npmjs.org/@hanra...`
- Verify package.json has @hanra packages removed
- Run `npm cache clean --force`
- Try again

### Step 2: Start Flask Backend
```bash
cd C:\Users\채승묵\projects\youtube-auto
python main.py
```

**Expected:**
```
 * Running on http://127.0.0.1:5000
```

**Verify:**
```bash
curl http://localhost:5000/api/projects
# Should return JSON array (even if empty)
```

### Step 3: Start Next.js Dev Server
```bash
cd C:\Users\채승묵\projects\youtube-auto\ui-only\web
npm run dev
```

**Expected output:**
```
  ▲ Next.js 16.1.6
  - Local:        http://localhost:3000
  - Environments: .env.local

✓ Ready in 2.1s
```

**If error:** Port 3000 in use
```bash
npm run dev -- -p 3001
```

---

## Runtime Verification

### Test 1: Home Page Loads
1. Open **http://localhost:3000**
2. **Expected:** 
   - Title: "YouTube Auto Studio"
   - Sidebar with gradient background
   - Project list (or "프로젝트가 없습니다" if empty)
   - Search input and "새 프로젝트" button

### Test 2: API Connection Works
1. Check browser DevTools → Network tab
2. Refresh page
3. **Expected:**
   - XHR request to `/api/projects`
   - Status: 200 OK
   - Response: JSON array

### Test 3: Create Project
1. Click "새 프로젝트" button
2. Fill form:
   - Name: "Test Project"
   - Description: "Test"
3. Click "생성"
4. **Expected:**
   - Modal closes
   - Project appears in list
   - Redirects to `/editor?id=<new-id>`
   - Project details page loads

### Test 4: Project Details Load
1. On editor page (**http://localhost:3000/editor?id=...**)
2. **Expected:**
   - Project name displayed
   - Project ID shown
   - Creation date visible
   - Settings displayed (if any)
   - "목록으로" button works

### Test 5: Navigate Back
1. Click "목록으로" or "⬅ 목록으로"
2. **Expected:**
   - Returns to home page
   - Project list still shows new project

### Test 6: Backend Disconnect Test
1. Stop Flask: Press Ctrl+C in Flask terminal
2. Go to http://localhost:3000
3. **Expected:**
   - Shows error banner: "프로젝트를 불러올 수 없습니다..."
   - No crash, graceful error handling
4. Restart Flask, refresh page
5. **Expected:**
   - Projects load again

### Test 7: Console Errors
1. Open DevTools → Console tab
2. Check for errors (should see none or only React StrictMode warnings)
3. **Expected:** No error messages related to:
   - `@hanra/api`
   - `@hanra/server`
   - Missing modules
   - CORS issues

---

## Common Issues & Solutions

### Issue: "API_BASE not found"
- **Cause:** Environment variable loading issue
- **Solution:** Restart dev server (`npm run dev`)

### Issue: "Cannot find module '@hanra/api'"
- **Cause:** Old step pages still using monorepo packages
- **Solution:** These are legacy; either update or remove them
- **For now:** Safe to ignore if index.js and editor.js work

### Issue: Port 3000 already in use
- **Solution:** 
  ```bash
  npm run dev -- -p 3001
  # Or kill existing process
  netstat -ano | findstr :3000
  taskkill /PID <PID> /F
  ```

### Issue: Slow first build
- **Expected:** First build takes 30-60 seconds
- **Next requests:** Much faster (cached)
- **Solution:** Wait or increase system resources

### Issue: Cannot connect to Flask backend
- **Debugging:**
  1. Is Flask running? `curl http://localhost:5000`
  2. Does endpoint exist? `curl http://localhost:5000/api/projects`
  3. Check Flask logs for errors
  4. Check Next.js browser DevTools Network tab

---

## Performance Notes

- **First Load:** ~3-5 seconds (includes Next.js compilation)
- **Subsequent Loads:** <500ms
- **Build Time:** 30-60 seconds (first time)
- **Dev Server Memory:** ~150-200MB
- **API Latency:** ~50-100ms (depending on Flask backend)

---

## Next Steps for Completion

### Short-term (Required for MVP)
- [ ] Test all endpoints against Flask backend
- [ ] Add mock data fallback for offline development
- [ ] Implement error boundary component
- [ ] Add loading indicators

### Medium-term (Enhancement)
- [ ] Implement 6-step workflow pages
  - [ ] Step 1: Script writing
  - [ ] Step 2: TTS generation
  - [ ] Step 3: Subtitle generation
  - [ ] Step 4: Thumbnail generation
  - [ ] Step 5: BGM upload
  - [ ] Step 6: Render video
- [ ] File upload support (for BGM, assets)
- [ ] Progress tracking UI

### Long-term (Polish)
- [ ] WebSocket real-time updates
- [ ] Project sharing/collaboration
- [ ] Advanced settings UI
- [ ] Export/download functionality
- [ ] Dark mode support

---

## Deployment Notes

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Production Environment
- Create `.env.production.local`:
  ```env
  NEXT_PUBLIC_API_BASE_URL=https://api.youtube-auto.com/api
  NEXT_PUBLIC_WS_URL=wss://api.youtube-auto.com
  ```
- Update `next.config.js` rewrites to production URL

---

## Support & Debugging

### Enable Debug Logging
Add to `lib/api.js`:
```javascript
console.log(`[apiFetch] ${url}`, options);
```

### Check Network Traffic
- Browser DevTools → Network tab
- Filter by XHR/Fetch
- Check request headers and response status

### Monitor Next.js Build
```bash
npm run build -- --debug
```

### Check Environment Variables
In `pages/index.js` or any page:
```javascript
console.log('API Base:', process.env.NEXT_PUBLIC_API_BASE_URL);
```

---

## Version Info

- **Next.js:** 16.1.6
- **React:** 18.2.0
- **Node:** 18+ (recommended)
- **npm:** 9+
- **Python Flask:** (backend requirement)

---

**Created:** 2026-02-11  
**Status:** ✅ Ready for testing  
**Last Updated:** 2026-02-11
