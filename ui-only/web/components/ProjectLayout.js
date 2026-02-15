import Link from 'next/link';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { formatDate, getProjectName } from '../lib/projectUtils';

const STEPS = [
  { key: 'script', label: '1. 대본', desc: '나레이션 대본 작성' },
  { key: 'tts', label: '2. TTS', desc: 'AI 음성 생성' },
  { key: 'subtitles', label: '3. 자막', desc: '자동 자막 생성' },
  { key: 'thumbnail', label: '4. 썸네일', desc: '썸네일 이미지' },
  { key: 'bgm', label: '5. BGM', desc: '배경 음악 추가' },
  { key: 'render', label: '6. 렌더링', desc: '최종 영상 생성' },
];

export default function ProjectLayout({
  projectId,
  project,
  activeStep,
  children,
  loading = false,
}) {
  const router = useRouter();
  const projectName = getProjectName(project);

  function getStepStatus(stepKey) {
    if (!project) return 'pending';
    const scenes = project.scenes || [];
    const hasScene = scenes.length > 0;
    switch (stepKey) {
      case 'script':
        return hasScene && (scenes[0].narration_ko || scenes[0].text) ? 'done' : 'pending';
      case 'tts':
        return hasScene && scenes[0].audio_path ? 'done' : 'pending';
      case 'subtitles':
        return project.settings?.subtitles?.enabled || project.status?.subtitles === 'done' ? 'done' : 'pending';
      case 'thumbnail':
        return project.thumbnail?.path ? 'done' : 'pending';
      case 'bgm':
        return project.settings?.bgm?.path && project.settings.bgm.enabled ? 'done' : 'pending';
      case 'render':
        return project.status?.render === 'done' ? 'done' : 'pending';
      default:
        return 'pending';
    }
  }

  return (
    <>
      <Head>
        <title>{projectName} - YouTube Auto Studio</title>
      </Head>

      <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5' }}>
        {/* LEFT SIDEBAR */}
        <aside style={{
          width: '280px',
          background: 'white',
          borderRight: '1px solid #e0e0e0',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
          zIndex: 100,
        }}>
          {/* Project Header */}
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #e0e0e0',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
          }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '6px', wordBreak: 'break-word', lineHeight: 1.3 }}>
              {projectName}
            </h2>
            <p style={{ fontSize: '11px', opacity: 0.85, fontFamily: 'monospace', margin: '4px 0' }}>
              {projectId}
            </p>
            {project && (
              <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '8px', lineHeight: 1.6 }}>
                <div>생성: {formatDate(project.createdAt)}</div>
                <div>수정: {formatDate(project.updatedAt)}</div>
              </div>
            )}
          </div>

          {/* Steps Navigation */}
          <nav style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {STEPS.map((step) => {
              const isActive = step.key === activeStep;
              const status = getStepStatus(step.key);

              return (
                <button
                  key={step.key}
                  onClick={() => router.push(`/projects/${projectId}/${step.key}`)}
                  style={{
                    padding: '12px 14px',
                    border: 'none',
                    background: isActive
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderRadius: '8px',
                    transition: 'all 0.15s ease',
                    fontSize: '14px',
                    fontWeight: isActive ? '600' : '500',
                    color: isActive ? 'white' : '#555',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = '#f0f0f0';
                      e.currentTarget.style.color = '#333';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#555';
                    }
                  }}
                >
                  <span style={{ flex: 1 }}>{step.label}</span>
                  {status === 'done' && !isActive && (
                    <span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '13px' }}>&#10003;</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div style={{ padding: '12px', borderTop: '1px solid #e0e0e0' }}>
            <Link
              href="/"
              style={{
                padding: '10px 14px',
                border: '1px solid #ddd',
                background: 'white',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                width: '100%',
                color: '#555',
                display: 'inline-block',
                textAlign: 'center',
                textDecoration: 'none',
              }}
            >
              &#8592; 프로젝트 목록
            </Link>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Top Bar */}
          <header style={{
            padding: '20px 30px',
            background: 'white',
            borderBottom: '1px solid #e0e0e0',
            zIndex: 10,
          }}>
            <h1 style={{ fontSize: '22px', color: '#333', fontWeight: '700' }}>
              {STEPS.find((s) => s.key === activeStep)?.label || activeStep}
            </h1>
            <p style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>
              {STEPS.find((s) => s.key === activeStep)?.desc || ''}
            </p>
          </header>

          {/* Content Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '30px',
            display: 'flex',
            justifyContent: 'center',
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '760px',
              width: '100%',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              alignSelf: 'flex-start',
            }}>
              {children}
            </div>
          </div>
        </main>

        {/* GLOBAL LOADING MODAL */}
        {loading && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '40px 50px',
              textAlign: 'center',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            }}>
              <div className="spinner" />
              <p style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>생성 중입니다...</p>
              <p style={{ fontSize: '13px', color: '#999', marginTop: '8px' }}>
                잠시만 기다려주세요.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
