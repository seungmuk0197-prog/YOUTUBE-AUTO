import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { getDisplayTitle } from '../lib/projectUtils';
import { fetchProject } from '../lib/api';

/** 진행 단계 (1~6 플로우) */
const PROGRESS_STEPS = [
  { key: 'topic', label: '1. 주제 추천', requiresProject: false },
  { key: 'script-plan', label: '2. 대본 기획', requiresProject: false },
  { key: 'script-gen', label: '3. 대본 생성', requiresProject: true },
  { key: 'json', label: '4-1. JSON 생성', requiresProject: false },
  { key: 'images', label: '4-2. 이미지 생성', requiresProject: false },
  { key: 'tts', label: '5. TTS 생성', requiresProject: true },
  { key: 'video-security', label: '6. 영상보안', requiresProject: true },
];

/** 주제/메인 페이지용 진행 단계 2개 */
const TOPIC_STEPS = [
  { key: 'topic', label: '1. 주제/대본 입력' },
  { key: 'trend', label: '3. 주간 급상승 트렌드 TOP 20' },
];

/** 진행 단계 키 → 해당 페이지 경로 */
const getStepHref = (stepKey, projectIdParam) => {
  switch (stepKey) {
    case 'topic': return '/';
    case 'script-plan': return projectIdParam ? `/script-planning?projectId=${projectIdParam}` : '/script-planning';
    case 'script-gen': return projectIdParam ? `/script-generation?projectId=${projectIdParam}` : null;
    case 'json': return projectIdParam ? `/json-generation?projectId=${projectIdParam}` : '/json-generation';
    case 'images': return projectIdParam ? `/image-generation?projectId=${projectIdParam}` : '/image-generation';
    case 'tts': return projectIdParam ? `/project?id=${projectIdParam}&step=tts` : null;
    case 'video-security': return projectIdParam ? `/project?id=${projectIdParam}&step=render` : null;
    default: return '/';
  }
};

/**
 * HANRA STUDIO 새 UI 레이아웃
 * - 현재 프로젝트, 프로젝트 생성/목록, 진행 단계(10단계), 헤더(메인화면/안내사항)
 */
/** 프로젝트 데이터로 진행한 최대 단계 키 계산 */
function getReachedStepFromProject(project) {
  if (!project) return '';
  if (project.scenes && project.scenes.length > 0) return 'json';
  if (project.script && project.script.trim()) return 'script-gen';
  if (project.blueprint) return 'script-plan';
  return 'topic';
}

export default function StudioLayout({
  title = 'HANRA STUDIO',
  project = null,
  projectId = null,
  activeStep = '',
  reachedStep: reachedStepProp = '', // 부모에서 넘긴 진행 최대 단계 (없으면 project로 계산)
  onStepClick = () => { },
  stepsMode = 'project', // 'project' | 'topic' (메인 페이지에서 3단계 표시)
  children,
}) {
  useEffect(() => {
    console.log('[StudioLayout] Layout mounted', { title, activeStep, pathname: typeof window !== 'undefined' ? window.location.pathname : 'SSR' });
    return () => {
      console.log('[StudioLayout] Layout unmounted', { title, activeStep });
    };
  }, [title, activeStep]);

  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [user, setUser] = useState(null);
  const [fetchedReachedStep, setFetchedReachedStep] = useState('');
  const [fetchedProject, setFetchedProject] = useState(null);

  // AUTH CHECK
  useEffect(() => {
    setIsClient(true);
    const loggedIn = localStorage.getItem('isLoggedIn');
    const userId = localStorage.getItem('userId');

    if (router.pathname !== '/login') {
      if (!loggedIn) {
        router.push('/login');
      } else {
        setUser(userId);
      }
    }
  }, [router.pathname]);

  const projectIdForNav = projectId || router.query.projectId;
  useEffect(() => {
    if (stepsMode !== 'project' || !projectIdForNav || project || reachedStepProp) return;
    let cancelled = false;
    fetchProject(projectIdForNav)
      .then((p) => {
        if (!cancelled && p) {
          setFetchedReachedStep(getReachedStepFromProject(p));
          setFetchedProject(p);
        }
      })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [stepsMode, projectIdForNav, project, reachedStepProp]);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  const steps = stepsMode === 'topic' ? TOPIC_STEPS : PROGRESS_STEPS;
  const effectiveProject = project || fetchedProject;
  const projectName = getDisplayTitle(effectiveProject);
  const displayTitle = effectiveProject ? `${projectName} - HANRA STUDIO` : title;

  const reachedStep = reachedStepProp || (effectiveProject ? getReachedStepFromProject(effectiveProject) : '') || fetchedReachedStep;
  const isProjectPage = router.pathname === '/project';

  const handleStepClick = (stepKey) => {
    if (isProjectPage && typeof onStepClick === 'function') {
      onStepClick(stepKey);
      return;
    }
    const href = getStepHref(stepKey, projectIdForNav);
    if (href) {
      router.push(href);
      return;
    }
    if (typeof onStepClick === 'function') onStepClick(stepKey);
  };

  if (!isClient) return null;

  function formatDate(d) {
    if (!d) return '-';
    try {
      const date = new Date(d);
      return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '-';
    }
  }

  return (
    <>
      <Head>
        <title>{displayTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="studio-layout" data-ui="web-ui">
        <aside className="studio-sidebar">
          <Link href="/" className="studio-logo">
            HANRA STUDIO
          </Link>

          <div className="studio-current-project">
            <div className="studio-current-label">현재 프로젝트</div>
            <div className="studio-project-name-row">
              <span className="studio-project-name">{projectName}</span>
              <span className="studio-project-edit" title="이름 수정">✎</span>
            </div>
            {effectiveProject && (
              <div className="studio-project-dates">
                <span>생성: {formatDate(effectiveProject.created_at || effectiveProject.createdAt)}</span>
                <span>수정: {formatDate(effectiveProject.updated_at || effectiveProject.updatedAt)}</span>
              </div>
            )}
            <div className="studio-project-actions-row">
              <Link
                href="/"
                className="studio-btn-create"
                style={{ cursor: 'pointer', border: 'none', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', lineHeight: 1.4 }}
              >
                <span className="studio-btn-icon">📄</span> 프로젝트 생성
              </Link>
              <Link
                href="/projects?filter=active"
                className="studio-btn-list"
                style={{ cursor: 'pointer', border: 'none', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', lineHeight: 1.4, textDecoration: 'none' }}
              >
                <span className="studio-btn-icon">📁</span> 프로젝트 목록
              </Link>
            </div>
          </div>

          <div className="studio-menu-card studio-progress-panel">
            <div className="studio-progress-bar" />
            <div className="studio-menu-title">진행 단계</div>
            <ul className="studio-menu-list">
              {steps.map((step, index) => {
                const activeIndex = steps.findIndex(s => s.key === activeStep);
                const reachedIndex = steps.findIndex(s => s.key === reachedStep);
                const maxIndex = Math.max(
                  activeIndex >= 0 ? activeIndex : 0,
                  reachedIndex >= 0 ? reachedIndex : 0
                );
                const isActive = step.key === activeStep;
                const isCompleted = index < activeIndex;
                const isWorkedOn = index <= maxIndex;
                const isBlocked = step.requiresProject && !projectIdForNav;

                let itemStyle = {};
                let icon = '';

                if (isActive) {
                  itemStyle = {
                    background: '#fff',
                    borderLeft: '4px solid #6b7280',
                    fontWeight: 700,
                    color: '#1f2937',
                    borderTop: 'none', borderRight: 'none', borderBottom: 'none',
                    borderRadius: '0 6px 6px 0',
                    paddingLeft: '10px'
                  };
                } else if (isCompleted) {
                  icon = '✓ ';
                  itemStyle = {
                    color: '#374151',
                    background: '#f5f5f5',
                    fontWeight: 700
                  };
                } else if (isWorkedOn) {
                  itemStyle = {
                    color: '#374151',
                    background: '#f5f5f5',
                    fontWeight: 700
                  };
                } else {
                  itemStyle = {
                    opacity: 0.7,
                    color: '#6b7280'
                  };
                }
                if (isBlocked) {
                  itemStyle = {
                    ...itemStyle,
                    opacity: 0.55,
                    cursor: 'not-allowed'
                  };
                }

                return (
                  <li key={step.key}>
                    <button
                      type="button"
                      className={`studio-menu-item${isActive ? ' active' : ''}`}
                      onClick={() => !isBlocked && handleStepClick(step.key)}
                      style={itemStyle}
                    >
                      {icon}{step.label}{isBlocked && <span className="studio-menu-sub"> 프로젝트 필요</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <div className="studio-main">
          <header className="studio-header">
            <div className="studio-header-left">
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#2d3748' }}>
                {displayTitle}
              </span>
            </div>
            <div className="studio-header-right">
              {user && (
                <span style={{ fontSize: '13px', color: '#4a5568', marginRight: '12px' }}>
                  안녕하세요, <strong>{user}</strong>님
                </span>
              )}
              <Link href="/" className="studio-header-link">🏠 메인화면</Link>
              <button type="button" className="studio-header-link">ℹ️ 안내사항</button>
              <button
                type="button"
                onClick={handleLogout}
                className="studio-header-login"
                style={{ marginLeft: '8px', background: '#feb2b2', border: '1px solid #e53e3e', color: '#c53030' }}
              >
                로그아웃
              </button>
            </div>
          </header>

          <main className="studio-content">
            {children}
          </main>
        </div>
      </div>

      <style jsx global>{`
        .studio-layout { display: flex; min-height: 100vh; background: #f0f0f0; }
        .studio-sidebar {
          width: 300px;
          background: #e8e8e8;
          border-right: 1px solid #d4d4d4;
          padding: 20px 16px 24px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
          height: 100vh;
          overflow-y: auto;
          position: relative;
          z-index: 30;
        }
        .studio-logo {
          display: block;
          font-weight: 700;
          font-size: 1.4rem;
          letter-spacing: 0.05em;
          color: #2d3748;
          padding: 4px 0;
          cursor: pointer;
          text-decoration: none;
        }
        .studio-logo:hover { color: #553c9a; }
        .studio-current-project {
          background: #fff;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          border: 1px solid #e2e8f0;
        }
        .studio-current-label { font-size: 12px; color: #718096; margin-bottom: 6px; }
        .studio-project-name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .studio-project-name { font-size: 15px; font-weight: 700; color: #1a202c; word-break: break-word; }
        .studio-project-edit { color: #718096; cursor: pointer; font-size: 14px; }
        .studio-project-edit:hover { color: #3182ce; }
        .studio-project-dates { font-size: 11px; color: #718096; margin-bottom: 12px; display: flex; flex-direction: column; gap: 2px; }
        .studio-project-actions-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .studio-btn-create, .studio-btn-list {
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
          font-family: inherit;
          line-height: 1.4;
          cursor: pointer;
          text-align: center;
          text-decoration: none;
          transition: all 0.2s;
          white-space: nowrap;
          -webkit-appearance: none;
          appearance: none;
        }
        .studio-btn-create { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }
        .studio-btn-create:hover { opacity: 0.9; }
        .studio-btn-list {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
        }
        .studio-btn-list:hover { opacity: 0.9; }
        .studio-btn-icon { font-size: 14px; }
        .studio-menu-card {
          border-radius: 12px;
          padding: 16px;
          flex: 1;
          overflow-y: auto;
        }
        .studio-progress-panel {
          background: #f0f0f0;
          border: 1px solid #d4d4d4;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }
        .studio-progress-bar {
          height: 4px;
          background: #f6e05e;
          border-radius: 2px;
          margin-bottom: 12px;
        }
        .studio-menu-title {
          font-size: 14px;
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 12px;
          padding: 0 2px;
        }
        .studio-menu-list { list-style: none; padding: 0; margin: 0; }
        .studio-menu-item {
          display: block;
          width: 100%;
          padding: 12px 14px;
          margin-bottom: 6px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          background: #fff;
          border: 1px solid #d4d4d4;
          box-shadow: none;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s;
          position: relative;
        }
        .studio-menu-sub {
          margin-left: 6px;
          font-size: 11px;
          color: #6b7280;
          font-weight: 500;
        }
        .studio-menu-item:hover:not(.active) {
          border-color: #9ca3af;
          background: #f5f5f5;
          color: #1f2937;
        }
        .studio-menu-item.active {
          background: #fff;
          border-color: #6b7280;
          color: #1f2937;
          font-weight: 600;
          box-shadow: 0 1px 2px rgba(0,0,0,0.06);
        }
        .studio-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
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
        .studio-header-left { display: flex; align-items: center; gap: 8px; }
        .studio-header-label { font-size: 12px; font-weight: 600; color: #718096; }
        .studio-header-input {
          width: 100px;
          padding: 6px 10px;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          font-size: 13px;
        }
        .studio-header-admin, .studio-header-login {
          padding: 6px 12px;
          border: 1px solid #c0c0c0;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 600;
          background: #e0e0e0;
          color: #333;
          cursor: pointer;
        }
        .studio-header-admin:hover, .studio-header-login:hover { background: #d5d5d5; }
        .studio-header-right { display: flex; align-items: center; gap: 10px; }
        .studio-header-link {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          background: transparent;
          color: #4a5568;
          cursor: pointer;
          text-decoration: none;
        }
        .studio-header-link:hover { color: #553c9a; background: #f7fafc; }
        .studio-content { flex: 1; overflow-y: auto; padding: 24px 32px 40px; }
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 22px 26px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
          margin-bottom: 16px;
        }
        .page-header h1 { font-size: 24px; margin: 0 0 4px; color: #1f2937; }
        .page-header p { margin: 0; font-size: 14px; color: #718096; }
        .reset-button { padding: 8px 18px; border-radius: 8px; border: 1px solid #e2e8f0; background: transparent; font-weight: 600; color: #4a5568; cursor: pointer; transition: all 0.2s; }
        .reset-button:disabled { opacity: 0.4; cursor: not-allowed; }
        .section-card { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 24px; margin-bottom: 16px; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06); }
        .section-card header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px; }
        .section-label { font-weight: 700; margin: 0; color: #1f2937; font-size: 16px; }
        .section-desc { margin: 4px 0 0; color: #64748b; font-size: 13px; line-height: 1.4; }
        .input-row { display: flex; gap: 12px; flex-wrap: wrap; }
        .topic-input { flex: 1; min-width: 0; padding: 14px 16px; border-radius: 12px; border: 1px solid #cbd5e0; font-size: 15px; transition: border 0.2s; }
        .topic-input:focus { border-color: #667eea; outline: none; }
        .primary-button { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 12px; padding: 0 28px; font-weight: 600; cursor: pointer; }
        .ghost-button { border: 1px solid #e2e8f0; background: white; border-radius: 10px; padding: 8px 14px; font-weight: 600; cursor: pointer; }
        .category-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
        .tab-button { border-radius: 999px; padding: 8px 16px; border: 1px solid #e2e8f0; background: #fff; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .tab-button.active { background: #eef2ff; border-color: #c7d2fe; color: #4338ca; }
        .category-grid { margin-top: 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
        .category-card { border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; padding: 14px; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 14px; font-weight: 500; color: #1f2937; cursor: pointer; transition: border 0.2s, box-shadow 0.2s; }
        .category-card.selected { border-color: #ff6b6b; box-shadow: 0 2px 14px rgba(255, 107, 107, 0.15); }
        .category-icon { font-size: 22px; }
        .trending-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
        .trend-card { border-radius: 16px; border: 1px solid #e2e8f0; padding: 16px; text-align: left; background: #fff; display: flex; flex-direction: column; gap: 10px; transition: border 0.2s, transform 0.2s; }
        .trend-card.selected { border-color: #f97316; transform: translateY(-2px); }
        .trend-card-header { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #64748b; }
        .rank { width: 28px; height: 28px; border-radius: 50%; background: #eef2ff; color: #4338ca; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; }
        .views { font-weight: 600; }
        .trend-title { font-size: 15px; font-weight: 700; color: #1f2937; margin: 0; line-height: 1.4; }
        .trend-meta { display: flex; flex-wrap: wrap; gap: 6px; }
        .trend-tag { padding: 3px 10px; border-radius: 999px; background: #f5f5f5; font-size: 11px; font-weight: 600; }
        .trend-tag.light { background: #edf2ff; color: #4338ca; }
      `}</style>
    </>
  );
}

