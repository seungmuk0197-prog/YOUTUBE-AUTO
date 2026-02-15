import Link from 'next/link';
import { useRouter } from 'next/router';
import Head from 'next/head';
import LoadingModal from './LoadingModal';
import { formatDate, getProjectName } from '../lib/projectUtils';

/**
 * HANRA STUDIO sidebar — 진행 단계 10개 (새 UI)
 */
const SIDEBAR_MENU = [
  { key: 'topic', label: '1. 주제 추천', href: '/', group: 'pre' },
  { key: 'script-plan', label: '2. 대본 기획', href: '/', group: 'pre' },
  { key: 'script-gen', label: '3. 대본 생성', href: '/script', group: 'project' },
  { key: 'json', label: '4-1. JSON 생성', href: '/', group: 'future' },
  { key: 'images', label: '4-2. 이미지 생성', href: '/', group: 'future' },
  { key: 'tts', label: '5. TTS 생성', href: '/tts', group: 'project' },
  { key: 'video-security', label: '6. 영상보안', href: '/render', group: 'project' },
  { key: 'meta', label: '7. 제목/설명작성', href: '/', group: 'future' },
  { key: 'thumbnail', label: '8. 썸네일 생성기', href: '/thumbnail', group: 'project' },
  { key: 'shorts', label: '9. 쇼츠 쇼 제작기', href: '/', group: 'future' },
  { key: 'intro', label: '10. 인트로 생성기', href: '/', group: 'future' },
];

export default function StudioLayout({
  projectId,
  project,
  activeStep,
  children,
  loading = false,
  loadingText,
}) {
  const router = useRouter();
  const projectName = getProjectName(project);
  const title = project ? `${projectName} - HANRA STUDIO` : 'HANRA STUDIO';

  function handleMenuClick(item) {
    if (item.group === 'project' && projectId) {
      router.push(`/projects/${projectId}${item.href}`);
    } else if (item.group === 'pre' || item.group === 'future') {
      router.push(item.href);
    }
  }

  return (
    <>
      <Head><title>{title}</title></Head>

      <div className="studio-layout">
        {/* LEFT SIDEBAR */}
        <aside className="studio-sidebar">
          <Link href="/" className="studio-logo">HANRA STUDIO</Link>

          {/* 현재 프로젝트 */}
          <div className="studio-current-project">
            <div className="studio-current-label">현재 프로젝트</div>
            <div className="studio-project-name-row">
              <span className="studio-project-name">{project ? projectName : '새로운 프로젝트'}</span>
              <span className="studio-project-edit" title="이름 수정">✎</span>
            </div>
            <div className="studio-project-actions-row">
              <button type="button" className="studio-btn-create" onClick={() => router.push('/')}>
                <span className="studio-btn-icon">📄</span> 프로젝트 생성
              </button>
              <Link href="/" className="studio-btn-list">
                <span className="studio-btn-icon">📁</span> 프로젝트 목록
              </Link>
            </div>
          </div>

          {/* 진행 단계 */}
          <div className="studio-menu-card">
            <div className="studio-menu-title">진행 단계</div>
            <ul className="studio-menu-list">
              {SIDEBAR_MENU.map((item) => {
                const isActive = item.key === activeStep;
                const isDisabled = item.group === 'future' && !projectId;
                const isProjectStep = item.group === 'project';

                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      className={`studio-menu-item${isActive ? ' active' : ''}${isDisabled ? ' disabled' : ''}`}
                      onClick={() => !isDisabled && handleMenuClick(item)}
                      disabled={isDisabled}
                    >
                      {item.label}
                      {isProjectStep && !projectId && (
                        <span className="studio-menu-badge">프로젝트 필요</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* MAIN AREA */}
        <div className="studio-main">
          {/* TOP HEADER */}
          <header className="studio-header">
            <div className="studio-header-left">
              <span className="studio-header-label">ID</span>
              <input type="text" className="studio-header-input" placeholder="ID" />
              <span className="studio-header-label">PW</span>
              <input type="password" className="studio-header-input" placeholder="Password" />
              <button type="button" className="studio-header-admin">관리</button>
              <button type="button" className="studio-header-login">로그온</button>
            </div>
            <div className="studio-header-right">
              <button type="button" className="studio-header-link">🏠 메인화면</button>
              <button type="button" className="studio-header-link">ℹ️ 안내사항</button>
            </div>
          </header>

          {/* CONTENT */}
          <main className="studio-content">
            {children}
          </main>
        </div>
      </div>

      <LoadingModal visible={loading} text={loadingText} />

      <style jsx global>{`
        /* ========== STUDIO LAYOUT ========== */
        .studio-layout {
          display: flex;
          min-height: 100vh;
          background: #f5f5f5;
        }

        /* ========== SIDEBAR ========== */
        .studio-sidebar {
          width: 300px;
          background: linear-gradient(180deg, #fafbff 0%, #f2f4f8 100%);
          border-right: 1px solid #e8ecf4;
          padding: 20px 16px 24px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
          height: 100vh;
          overflow-y: auto;
          position: sticky;
          top: 0;
        }
        .studio-logo {
          display: block;
          font-weight: 700;
          font-size: 1.4rem;
          letter-spacing: 0.05em;
          color: #2d3748;
          padding: 4px 4px 0;
          cursor: pointer;
          text-decoration: none;
        }
        .studio-logo:hover { color: #553c9a; }

        /* 현재 프로젝트 */
        .studio-current-project {
          background: #fff;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          border: 1px solid rgba(0,0,0,0.04);
        }
        .studio-current-label {
          font-size: 12px;
          color: #718096;
          margin-bottom: 6px;
        }
        .studio-project-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .studio-project-name {
          font-size: 15px;
          font-weight: 700;
          color: #1a202c;
          word-break: break-word;
        }
        .studio-project-edit {
          color: #718096;
          cursor: pointer;
          font-size: 14px;
        }
        .studio-project-edit:hover { color: #3182ce; }
        .studio-project-actions-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .studio-btn-create {
          flex: 1;
          min-width: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 12px;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
          text-align: center;
          transition: all 0.2s;
        }
        .studio-btn-create:hover { opacity: 0.9; filter: brightness(1.05); }
        .studio-btn-list {
          flex: 1;
          min-width: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 12px;
          border: none;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          background: #f6e05e;
          color: #1a202c;
          text-align: center;
          text-decoration: none;
          transition: all 0.2s;
        }
        .studio-btn-list:hover { background: #ecc94b; }
        .studio-btn-icon { font-size: 14px; }

        /* Menu card */
        .studio-menu-card {
          background: #fff;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          border: 1px solid rgba(0,0,0,0.04);
          flex: 1;
          overflow-y: auto;
        }
        .studio-menu-title {
          font-size: 13px;
          font-weight: 700;
          color: #4a5568;
          margin-bottom: 12px;
          padding: 0 4px;
        }
        .studio-menu-list {
          list-style: none;
          padding: 0;
        }
        .studio-menu-item {
          display: block;
          width: 100%;
          padding: 11px 14px;
          margin-bottom: 5px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          color: #4a5568;
          background: #fff;
          border: 1px solid #e2e8f0;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
        }
        .studio-menu-item:hover:not(.disabled):not(.active) {
          border-color: #b794f4;
          background: #faf5ff;
          color: #553c9a;
        }
        .studio-menu-item.active {
          background: linear-gradient(135deg, #e9d8fd 0%, #e2e8f0 100%);
          border-color: #b794f4;
          color: #553c9a;
          font-weight: 600;
        }
        .studio-menu-item.disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .studio-menu-badge {
          font-size: 10px;
          color: #a0aec0;
          margin-left: 6px;
        }

        /* ========== TOP HEADER ========== */
        .studio-header {
          background: #fff;
          border-bottom: 1px solid #e8ecf4;
          padding: 10px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-shrink: 0;
        }
        .studio-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .studio-header-label {
          font-size: 12px;
          font-weight: 600;
          color: #718096;
        }
        .studio-header-input {
          width: 100px;
          padding: 6px 10px;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          font-size: 13px;
          background: #fff;
          color: #333;
        }
        .studio-header-admin,
        .studio-header-login {
          padding: 6px 12px;
          border: 1px solid #c0c0c0;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 600;
          background: #e0e0e0;
          color: #333;
          cursor: pointer;
        }
        .studio-header-admin:hover,
        .studio-header-login:hover { background: #d5d5d5; }
        .studio-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .studio-header-link {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          background: transparent;
          color: #4a5568;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .studio-header-link:hover { color: #553c9a; background: #f7fafc; }

        /* ========== MAIN CONTENT ========== */
        .studio-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }
        .studio-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px 32px 40px;
        }

        /* ========== PAGE COMPONENTS ========== */
        .page-header {
          margin-bottom: 20px;
        }
        .page-header h1 {
          font-size: 22px;
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 4px;
        }
        .page-header .page-desc {
          font-size: 14px;
          color: #718096;
        }

        .content-card {
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          margin-bottom: 20px;
        }

        .field-label {
          font-size: 14px;
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 8px;
        }

        .section-desc {
          font-size: 13px;
          color: #718096;
          margin-bottom: 12px;
          line-height: 1.5;
        }
      `}</style>
    </>
  );
}
