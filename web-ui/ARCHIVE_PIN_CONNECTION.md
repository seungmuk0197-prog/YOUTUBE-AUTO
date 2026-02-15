# 즐겨찾기 / 보관 — web-ui 연결 정리

**사용하는 UI는 web-ui 하나입니다.** (localhost:3001)

## 연결 경로

| 역할 | 파일 (전부 web-ui 경로) |
|------|--------------------------|
| 프로젝트 목록 페이지 (카드, 보관 버튼, ⭐ 즐겨찾기) | `web-ui/pages/projects.js` |
| API 호출 (fetch) | `web-ui/lib/api.js` |
| 레이아웃 (사이드바, 버튼) | `web-ui/components/StudioLayout.js` |
| 백엔드 (PATCH/저장) | `backend/api.py`, `backend/project_manager.py` |

## 즐겨찾기 (Pin)

- **클릭**: `projects.js` → `handleTogglePin()` → `toggleProjectPin(projectId, newPinned)` (api.js)
- **API**: `PATCH /api/projects/:id` body `{ pinned, isPinned }`
- **확인**: 브라우저 개발자도구 → Elements에서 `data-page="web-ui-projects"` 있는 div가 있으면 이 페이지가 로드된 것.

## 보관 (Archive)

- **클릭**: `projects.js` → `handleArchiveSelected()` → `batchArchiveProjects(ids)` 또는 `archiveProject(id)` (api.js)
- **API**: `POST /api/projects/batch-archive` 또는 `PATCH /api/projects/:id` body `{ archived: true, status: 'archived' }`
- **목록/통계**: `fetchProjects()`, `fetchProjectStats()` (api.js) → 응답에 `archived`, `pinned` 필드 있음.

## 수정 시 확인할 것

1. **프론트**: 반드시 `web-ui/` 아래만 수정 (ui-only 아님).
2. **요청 헤더**: api.js에서 `createDebugHeaders()` 사용 → `X-Client: web-ui` 로 백엔드에서 구분 가능.
3. **DOM 확인**: 프로젝트 목록 페이지에서 `data-page="web-ui-projects"`, 레이아웃에서 `data-ui="web-ui"` 가 있으면 web-ui가 적용된 상태.
