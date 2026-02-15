# UI-Only Standalone Next.js App

> **⚠️ 일상 개발용 UI는 여기가 아닙니다.**  
> 프로젝트 목록·편집 등은 **루트의 `web-ui`**만 사용하세요.  
> 실행: 루트에서 `start_dev.bat` → **http://localhost:3001**  
> (UI를 2개 쓰면 포트·경로가 엉겨서 혼동됩니다.)

A standalone Next.js 16 web UI for YouTube Auto Studio that works with the Flask backend on `http://localhost:5000`.

## Architecture

- **Router Type:** Pages Router (`pages/` directory)
- **API Communication:** Through Next.js rewrites (`/api` → `http://localhost:5000/api`)
- **API Wrapper:** `lib/api.js` - simple fetch wrapper for all API calls
- **Dependencies Removed:** `@hanra/api`, `@hanra/server` (all monorepo packages)

## Quick Start

### 1. Install Dependencies

```bash
cd ui-only/web
npm install
```

### 2. Start Flask Backend

Ensure Flask is running on port 5000:

```bash
cd ../..  # Back to project root
python main.py
```

The backend should be accessible at `http://localhost:5000`

### 3. Start Next.js Dev Server

```bash
cd ui-only/web
npm run dev
```

Server starts on `http://localhost:3000` with output:

```
> next dev -p 3000 -H 0.0.0.0

  ▲ Next.js 16.1.6
  - Local:        http://localhost:3000
  - Environments: .env.local

✓ Ready in 2.1s
```

## Pages

### `/` (Home)
- **File:** `pages/index.js`
- **Features:** 
  - Project list grid
  - Search by project name
  - Create new project modal
  - Links to project editor (`/editor?id=<projectId>`)
- **API Calls:**
  - `GET /api/projects` - Load project list
  - `POST /api/projects` - Create new project
- **Status:** ✅ Functional with Flask backend

### `/editor?id=<projectId>` (Project Editor)
- **File:** `pages/editor.js`
- **Features:**
  - Display project details (name, ID, dates, settings)
  - Information about 6-step workflow (stub)
  - Back to project list button
- **API Calls:**
  - `GET /api/projects/:id` - Load project details
- **Status:** ✅ Functional (basic implementation)
- **TODO:** Implement 6-step editing workflow

### Other Pages
- **`/step-*` pages:** Copied from monorepo but not updated for standalone use
- **Status:** ⚠️ Likely non-functional without monorepo packages
- **Recommendation:** Either remove or update to use Flask API

## API Integration

### Fetch Wrapper (`lib/api.js`)

All API calls go through same-origin `/api` which proxies to Flask:

```javascript
import { apiGet, apiPost, apiPut, apiDelete, apiPostFormData } from '../lib/api';

// GET /api/projects
const projects = await apiGet('projects');

// POST /api/projects with JSON
const newProject = await apiPost('projects', { name: 'My Project' });

// POST /api/projects/{id} with FormData (files)
const formData = new FormData();
formData.append('file', file);
await apiPostFormData(`projects/${id}/upload`, formData);
```

### Next.js Rewrites (next.config.js)

```javascript
async rewrites() {
  return {
    beforeFiles: [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*',
      },
    ],
  };
}
```

This allows:
- Client-side code to call `/api/projects` (same-origin)
- Next.js server automatically proxies to Flask backend
- Avoids CORS issues

## Environment Variables

### `.env.local`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
NEXT_PUBLIC_WS_URL=ws://localhost:5000
```

Currently these are for reference; the app uses same-origin `/api` through rewrites.

## Configuration Files

### `package.json`
- **Created:** Standalone version with only Next.js/React deps
- **Removed:** `@hanra/api`, `@hanra/server`, `@sentry/nextjs`, all `@hanra/*` packages
- **Scripts:**
  - `dev`: Start dev server on port 3000
  - `build`: Run inject-api-base script then build
  - `start`: Start production server
  - `lint`: Run ESLint

### `next.config.js`
- **API Proxy:** `/api/:path*` → `http://localhost:5000/api/:path*`
- **Environment:** `NEXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:5000`
- **Redirects:** Maintains old step redirects (can be removed)

### `.eslintrc.json`
- **Config:** Extends Next.js core web vitals
- **Rules:** Allow unescaped entities, warn on dependency issues

## Troubleshooting

### Backend Connection Failed
- **Error:** "프로젝트를 불러올 수 없습니다..."
- **Solution:**
  1. Verify Flask is running: `python main.py`
  2. Check it's on port 5000: http://localhost:5000
  3. Try direct request: `curl http://localhost:5000/api/projects`

### Port 3000 Already in Use
```bash
npm run dev -- -p 3001
```

### Environment Variables Not Applied
- Stop dev server
- Clear `.next` folder: `rm -r .next`
- Restart: `npm run dev`

### CSS/JSX Compile Errors
- Check node version: `npm --version` (should be 18+)
- Reinstall: `rm -rf node_modules package-lock.json && npm install`

## Known Limitations

1. **Monorepo Pages:** `/step-*` pages depend on `@hanra/api` and won't work
2. **Workflow Steps:** Editor page shows only overview; 6-step workflow not implemented
3. **File Uploads:** BGM/asset uploads not integrated yet
4. **Real-time Updates:** No WebSocket integration

## Next Steps

1. **Implement 6-Step Workflow:**
   - Create dedicated step pages or components
   - Wire each step to Flask endpoints (TTS, subtitles, thumbnail, etc.)
   - Add progress visualization

2. **File Upload Support:**
   - BGM upload form
   - Asset management UI

3. **Error Handling:**
   - Retry logic for API failures
   - User-friendly error messages
   - Fallback/mock data for development

4. **Testing:**
   - Unit tests for API wrapper
   - E2E tests with Flask mock

## Build & Deploy

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

## File Structure

```
ui-only/web/
├── pages/
│   ├── index.js           # Project list home
│   ├── editor.js          # Project editor (new)
│   ├── step-2.js          # Legacy (from monorepo)
│   ├── step-3.js          # Legacy (from monorepo)
│   └── ...
├── components/
│   └── ProviderSelector.js
├── lib/
│   ├── api.js             # API fetch wrapper (new)
│   └── [existing files]
├── utils/
│   └── apiBase.js
├── public/
│   └── [static assets]
├── scripts/
│   └── inject-api-base.js
├── .env.local             # Environment vars (new)
├── .eslintrc.json         # ESLint config
├── next.config.js         # Next.js config (updated)
└── package.json           # Dependencies (updated)
```

## Developer Notes

- **Pages Router Rationale:** Preserves compatibility with existing `step-*` pages
- **No Monorepo Coupling:** All imports are local or from npm packages
- **API Wrapper Pattern:** Centralized error handling and request logging
- **Same-Origin Proxy:** Avoids CORS while maintaining clean API imports

---

**Last Updated:** 2026-02-11  
**Status:** ✅ Basic functionality working
