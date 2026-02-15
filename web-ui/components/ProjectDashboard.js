import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { fetchProject, updateProject, deleteProject, touchProject } from '../lib/api';
import { getDisplayTitle } from '../lib/projectUtils';

/**
 * Project Dashboard 컴포넌트 (재구성)
 * 핵심 정보 중심, 진행 상태 명확화, 사용자 흐름 개선
 * Updated: 2026-02-11
 */
export default function ProjectDashboard({ projectId, project: initialProject }) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [loading, setLoading] = useState(!initialProject);
  const [editingTitle, setEditingTitle] = useState(false);
  const [projectTitle, setProjectTitle] = useState(getDisplayTitle(initialProject));
  const [originalTitle, setOriginalTitle] = useState(getDisplayTitle(initialProject));
  const [savingTitle, setSavingTitle] = useState(false);
  const [toast, setToast] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showProjectInfo, setShowProjectInfo] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connected'); // connected, error, stale

  useEffect(() => {
    if (projectId && !initialProject) {
      loadProject();
    } else if (initialProject) {
      setProject(initialProject);
      const title = getDisplayTitle(initialProject);
      setProjectTitle(title);
      setOriginalTitle(title);
    }
    
    if (projectId) {
      touchProject(projectId).catch(err => {
        console.warn('Failed to touch project (non-critical):', err);
      });
    }
  }, [projectId, initialProject]);

  async function loadProject() {
    try {
      setLoading(true);
      const data = await fetchProject(projectId);
      setProject(data);
      const title = getDisplayTitle(data);
      setProjectTitle(title);
      setOriginalTitle(title);
      setConnectionStatus('connected');
    } catch (error) {
      console.error('[Dashboard] Failed to load project:', error);
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadProject();
    setTimeout(() => setIsRefreshing(false), 500);
  }

  async function handleSave() {
    if (!projectTitle.trim()) {
      showToast('프로젝트 제목을 입력해주세요.', 'error');
      return;
    }
    
    if (projectTitle === originalTitle && !editingTitle) {
      showToast('변경된 내용이 없습니다.', 'info');
      return;
    }

    setSavingTitle(true);
    try {
      const result = await updateProject(projectId, { title: projectTitle.trim() });
      const savedTitle = getDisplayTitle(result?.project) || projectTitle.trim();
      setOriginalTitle(savedTitle);
      setProjectTitle(savedTitle);
      setEditingTitle(false);
      await loadProject();
      showToast('프로젝트 제목이 저장되었습니다.', 'success');
      
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('projectTitleUpdated', { detail: { projectId } }));
      }
    } catch (error) {
      console.error('[Dashboard] Failed to save project title:', error);
      showToast('저장 실패: ' + (error.message || '알 수 없는 오류'), 'error');
    } finally {
      setSavingTitle(false);
    }
  }

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const hasChanges = projectTitle.trim() !== originalTitle;

  // 대본 판단 함수
  function hasScript() {
    if (!project?.scenes || project.scenes.length === 0) {
      return false;
    }
    const firstScene = project.scenes[0];
    return !!(firstScene?.text || firstScene?.narration_ko || firstScene?.narration_en);
  }

  // 단계 상태 계산
  function getStepStatus(stepIndex) {
    const steps = [
      { key: 'plan', check: () => true }, // 기획 및 설정 - 항상 가능
      { key: 'script', check: () => true }, // 대본 생성 - 항상 가능
      { key: 'json', check: () => hasScript() }, // JSON 생성 - 대본 필요
      { key: 'images', check: () => hasScript() && project?.scenes?.length > 0 }, // 이미지 - 대본+JSON 필요
      { key: 'tts', check: () => !!(project?.scenes?.some(s => s.image_path) || project?.imagesCount > 0) }, // TTS - 이미지 필요
      { key: 'render', check: () => !!project?.settings?.tts?.audio_paths?.length } // 렌더링 - TTS 필요
    ];

    // 이전 단계 완료 여부 확인
    for (let i = 0; i < stepIndex; i++) {
      if (!steps[i].check()) {
        return 'LOCK';
      }
    }

    // 현재 단계 완료 여부 확인
    const currentStep = steps[stepIndex];
    if (stepIndex === 0) {
      // 기획 및 설정 - 항상 TODO (완료 여부는 blueprint 존재로 판단)
      return project?.blueprint ? 'DONE' : 'TODO';
    } else if (stepIndex === 1) {
      // 대본 생성
      return hasScript() ? 'DONE' : 'TODO';
    } else if (stepIndex === 2) {
      // JSON 생성
      return project?.scenes?.length > 0 ? 'DONE' : 'TODO';
    } else if (stepIndex === 3) {
      // 이미지 생성
      return project?.scenes?.some(s => s.image_path) ? 'DONE' : 'TODO';
    } else if (stepIndex === 4) {
      // TTS 생성
      return project?.settings?.tts?.audio_paths?.length > 0 ? 'DONE' : 'TODO';
    } else if (stepIndex === 5) {
      // 렌더링
      return project?.rendered ? 'DONE' : 'TODO';
    }

    return currentStep.check() ? 'TODO' : 'LOCK';
  }

  // 다음 단계 찾기
  function getNextStep() {
    const steps = [
      { key: 'plan', route: () => router.push(`/script-planning?projectId=${projectId}`) },
      { key: 'script', route: () => navigateToStep('script') },
      { key: 'json', route: () => navigateToStep('json') },
      { key: 'images', route: () => navigateToStep('images') },
      { key: 'tts', route: () => navigateToStep('tts') },
      { key: 'render', route: () => navigateToStep('render') }
    ];

    for (let i = 0; i < steps.length; i++) {
      const status = getStepStatus(i);
      if (status === 'TODO') {
        return steps[i];
      }
    }
    return null; // 모든 단계 완료
  }

  function navigateToStep(step) {
    if (step === 'json') {
      if (!hasScript()) {
        alert('대본이 입력되어 있지 않습니다. 먼저 대본을 편집해주세요.');
        router.push(`/project?id=${projectId}&step=script`);
        return;
      }
      router.push(`/json-generation?projectId=${projectId}`);
      return;
    }
    
    if (step === 'images') {
      if (!hasScript()) {
        alert('대본이 입력되어 있지 않습니다. 먼저 대본을 편집해주세요.');
        router.push(`/project?id=${projectId}&step=script`);
        return;
      }
      const hasJson = project?.scenes?.length > 0;
      if (!hasJson) {
        alert('JSON이 생성되어 있지 않습니다. 먼저 JSON을 생성해주세요.');
        router.push(`/json-generation?projectId=${projectId}`);
        return;
      }
    }
    
    if (step === 'tts') {
      if (!hasScript()) {
        alert('대본이 입력되어 있지 않습니다. 먼저 대본을 편집해주세요.');
        router.push(`/project?id=${projectId}&step=script`);
        return;
      }
      const hasImages = project?.scenes?.some(s => s.image_path) || project?.imagesCount > 0;
      if (!hasImages) {
        alert('이미지가 생성되어 있지 않습니다. 먼저 이미지를 생성해주세요.');
        router.push(`/project?id=${projectId}&step=images`);
        return;
      }
    }
    
    if (step === 'render') {
      const hasTts = project?.settings?.tts?.audio_paths?.length > 0;
      if (!hasTts) {
        alert('TTS가 생성되어 있지 않습니다. 먼저 TTS를 생성해주세요.');
        router.push(`/project?id=${projectId}&step=tts`);
        return;
      }
    }
    
    router.push(`/project?id=${projectId}&step=${step}`);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return '-';
    }
  }

  function formatTime(dateStr) {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '-';
    }
  }

  function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatProjectId(id) {
    if (!id) return '';
    if (id.length > 20) {
      return `${id.substring(0, 8)}...${id.substring(id.length - 4)}`;
    }
    return id;
  }

  function getTotalDuration() {
    if (!project?.scenes?.length) return 0;
    return project.scenes.reduce((sum, scene) => sum + (scene.duration || scene.durationSec || 0), 0);
  }

  function calculateProgress() {
    let completed = 0;
    const total = 6;
    
    if (project?.blueprint) completed++;
    if (hasScript()) completed++;
    if (project?.scenes?.length > 0) completed++;
    if (project?.scenes?.some(s => s.image_path)) completed++;
    if (project?.settings?.tts?.audio_paths?.length > 0) completed++;
    if (project?.rendered) completed++;
    
    return Math.round((completed / total) * 100);
  }

  function getCurrentStepName() {
    const nextStep = getNextStep();
    if (!nextStep) return '6/6 완료';
    
    const stepNames = {
      plan: '기획 및 설정',
      script: '대본 생성',
      json: '장면 구성 (JSON)',
      images: '이미지 생성',
      tts: '더빙 (TTS)',
      render: '영상 렌더링'
    };
    
    const stepIndex = ['plan', 'script', 'json', 'images', 'tts', 'render'].indexOf(nextStep.key);
    return `${stepIndex + 1}/6`;
  }

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <p>로딩 중...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <p>프로젝트를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const totalDuration = getTotalDuration();
  const sceneCount = project.scenes?.length || 0;
  const imageCount = project.scenes?.filter(s => s.image_path).length || 0;
  const progress = calculateProgress();
  const nextStep = getNextStep();
  const currentStepName = getCurrentStepName();

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* NEW UI VERSION 2026-02-11 */}
      {/* Toast 알림 */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            background: toast.type === 'error' ? '#fee' : toast.type === 'info' ? '#e3f2fd' : '#e8f5e9',
            color: toast.type === 'error' ? '#c62828' : toast.type === 'info' ? '#1565c0' : '#2e7d32',
            border: `1px solid ${toast.type === 'error' ? '#f44336' : toast.type === 'info' ? '#2196f3' : '#4caf50'}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            fontSize: '14px',
            fontWeight: '600',
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          {toast.message}
          <style jsx>{`
            @keyframes slideIn {
              from {
                transform: translateX(100%);
                opacity: 0;
              }
              to {
                transform: translateX(0);
                opacity: 1;
              }
            }
          `}</style>
        </div>
      )}

      {/* 1. 상단 헤더 - 프로젝트 카드 */}
      <div style={{ 
        background: 'white', 
        borderRadius: '16px', 
        padding: '32px', 
        marginBottom: '24px', 
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)', 
        border: '1px solid #e2e8f0' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            {editingTitle ? (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  style={{ 
                    flex: 1, 
                    padding: '12px 16px', 
                    border: '2px solid #e2e8f0', 
                    borderRadius: '10px', 
                    fontSize: '24px', 
                    fontWeight: '800',
                    background: 'white',
                    color: '#1a202c'
                  }}
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  disabled={savingTitle}
                  style={{ 
                    padding: '12px 24px', 
                    background: '#667eea', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '10px', 
                    cursor: savingTitle ? 'not-allowed' : 'pointer', 
                    fontWeight: '700',
                    fontSize: '14px',
                    opacity: savingTitle ? 0.6 : 1
                  }}
                >
                  {savingTitle ? '저장 중...' : '저장'}
                </button>
                <button
                  onClick={() => {
                    setEditingTitle(false);
                    setProjectTitle(originalTitle);
                  }}
                  style={{ 
                    padding: '12px 24px', 
                    background: '#f7fafc', 
                    color: '#4a5568', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '10px', 
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}
                >
                  취소
                </button>
              </div>
            ) : (
              <>
                <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#1a202c', margin: '0 0 12px 0' }}>
                  {projectTitle || '제목 없음'}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', color: '#718096' }}>
                    생성일: {formatDate(project.created_at)}
                  </span>
                  <span style={{ fontSize: '13px', color: '#718096' }}>·</span>
                  <span 
                    style={{ 
                      fontSize: '13px', 
                      color: '#667eea', 
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                    onClick={() => {
                      navigator.clipboard.writeText(projectId);
                      showToast('프로젝트 ID가 복사되었습니다.', 'success');
                    }}
                    title="클릭하여 전체 ID 복사"
                  >
                    ID: {formatProjectId(projectId)}
                  </span>
                  <span style={{ fontSize: '13px', color: '#718096' }}>·</span>
                  <span style={{ fontSize: '13px', color: '#718096' }}>
                    마지막 수정: {formatDate(project.updated_at)} {formatTime(project.updated_at)}
                  </span>
                  {project.folderName && (
                    <>
                      <span style={{ fontSize: '13px', color: '#718096' }}>·</span>
                      <span style={{ fontSize: '13px', color: '#718096' }}>
                        폴더: {project.folderName}
                      </span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            {/* 연결 상태 배지 */}
            <div style={{
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              background: connectionStatus === 'connected' ? '#e6ffed' : connectionStatus === 'error' ? '#fee' : '#fff4e6',
              color: connectionStatus === 'connected' ? '#2d5016' : connectionStatus === 'error' ? '#c62828' : '#8b4513',
              border: `1px solid ${connectionStatus === 'connected' ? '#c6f6d5' : connectionStatus === 'error' ? '#f44336' : '#ffd89b'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>{connectionStatus === 'connected' ? '●' : connectionStatus === 'error' ? '⚠' : '○'}</span>
              {connectionStatus === 'connected' ? '정상 연결됨' : connectionStatus === 'error' ? '연결 오류' : '이전 데이터'}
            </div>
            
            {/* 동기화 버튼 */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                padding: '8px 16px',
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                color: '#4a5568',
                fontSize: '13px',
                opacity: isRefreshing ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="데이터 새로고침"
            >
              <span style={{ 
                display: 'inline-block',
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                transformOrigin: 'center'
              }}>🔄</span>
              {isRefreshing ? '동기화 중...' : '동기화'}
              <style jsx>{`
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </button>
            
            {/* 나가기 버튼 (저강도) */}
            <button
              onClick={() => router.push('/projects')}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500',
                color: '#718096',
                fontSize: '13px',
                textDecoration: 'underline',
                textUnderlineOffset: '2px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#4a5568';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#718096';
              }}
            >
              나가기
            </button>
          </div>
        </div>

        {/* 우측 상단 주요 CTA */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
          {nextStep && (
            <button
              onClick={nextStep.route}
              style={{
                padding: '14px 28px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '15px',
                boxShadow: '0 4px 16px rgba(102,126,234,0.3)',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(102,126,234,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(102,126,234,0.3)';
              }}
            >
              계속 진행하기 →
            </button>
          )}
          <button
            onClick={() => router.push(`/script-planning?projectId=${projectId}`)}
            style={{
              padding: '14px 28px',
              background: 'white',
              border: '2px solid #e2e8f0',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: '700',
              color: '#4a5568',
              fontSize: '15px',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#667eea';
              e.currentTarget.style.color = '#667eea';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.color = '#4a5568';
            }}
          >
            프로젝트 설정
          </button>
        </div>
      </div>

      {/* 2. 현재 진행상태 Status Bar */}
      <div style={{ 
        background: 'white', 
        borderRadius: '12px', 
        padding: '20px 24px', 
        marginBottom: '24px', 
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', 
        border: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#1a202c' }}>
            진행: {currentStepName}
          </span>
          <span style={{ fontSize: '13px', color: '#718096' }}>·</span>
          <span style={{ fontSize: '13px', color: '#4a5568' }}>
            씬 {sceneCount}개
          </span>
          <span style={{ fontSize: '13px', color: '#718096' }}>·</span>
          <span style={{ fontSize: '13px', color: '#4a5568' }}>
            예상 {formatDuration(totalDuration)}
          </span>
          <span style={{ fontSize: '13px', color: '#718096' }}>·</span>
          <span style={{ fontSize: '13px', color: '#4a5568' }}>
            이미지 {imageCount}개
          </span>
          <span style={{ fontSize: '13px', color: '#718096' }}>·</span>
          <span style={{ fontSize: '13px', color: '#4a5568' }}>
            TTS {project?.settings?.tts?.audio_paths?.length || 0}개
          </span>
          <span style={{ fontSize: '13px', color: '#718096' }}>·</span>
          <span style={{ fontSize: '13px', color: '#4a5568' }}>
            렌더 {project?.rendered ? '1' : '0'}개
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '200px' }}>
          <div style={{ 
            flex: 1, 
            height: '8px', 
            background: '#e2e8f0', 
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '4px',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#667eea', minWidth: '40px' }}>
            {progress}%
          </span>
        </div>
      </div>

      {/* 3. 작업 단계 - 탭형 스텝퍼 */}
      <div style={{ 
        background: 'white', 
        borderRadius: '16px', 
        padding: '32px', 
        marginBottom: '24px', 
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)', 
        border: '1px solid #e2e8f0' 
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1a202c', marginBottom: '24px' }}>
          작업 단계
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
          {[
            { key: 'plan', label: '기획 및 설정', icon: '🚀', route: () => router.push(`/script-planning?projectId=${projectId}`) },
            { key: 'script', label: '대본 생성', icon: '✍️', route: () => navigateToStep('script') },
            { key: 'json', label: '장면 구성', icon: '📋', route: () => navigateToStep('json') },
            { key: 'images', label: '이미지 생성', icon: '🖼️', route: () => navigateToStep('images') },
            { key: 'tts', label: '더빙 (TTS)', icon: '🎙️', route: () => navigateToStep('tts') },
            { key: 'render', label: '영상 렌더링', icon: '🎬', route: () => navigateToStep('render') }
          ].map((step, index) => {
            const status = getStepStatus(index);
            return (
              <StepStepperButton
                key={step.key}
                label={step.label}
                icon={step.icon}
                status={status}
                stepNumber={index + 1}
                onClick={step.route}
                lockedMessage={index > 0 ? `${index}단계 완료 후 가능` : ''}
              />
            );
          })}
        </div>
      </div>

      {/* 4. 자산 현황 - 카운터 카드 6개 */}
      <div style={{ 
        background: 'white', 
        borderRadius: '16px', 
        padding: '28px', 
        marginBottom: '24px', 
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)', 
        border: '1px solid #e2e8f0' 
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1a202c', marginBottom: '20px' }}>
          자산 현황
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
          <AssetCounterCard
            label="대본"
            count={hasScript() ? 1 : 0}
            total={1}
            onClick={() => navigateToStep('script')}
          />
          <AssetCounterCard
            label="장면(JSON)"
            count={sceneCount}
            total={sceneCount}
            onClick={() => navigateToStep('json')}
          />
          <AssetCounterCard
            label="캐릭터"
            count={project.characters?.length || 0}
            total={project.characters?.length || 0}
          />
          <AssetCounterCard
            label="나레이션"
            count={project?.settings?.tts?.audio_paths?.length || 0}
            total={project?.settings?.tts?.audio_paths?.length || 0}
            onClick={() => navigateToStep('tts')}
          />
          <AssetCounterCard
            label="이미지"
            count={imageCount}
            total={sceneCount}
            onClick={() => navigateToStep('images')}
          />
          <AssetCounterCard
            label="렌더 결과"
            count={project?.rendered ? 1 : 0}
            total={1}
            onClick={() => navigateToStep('render')}
          />
        </div>
      </div>

      {/* 5. 프로젝트 정보 - Accordion */}
      <div style={{ 
        background: 'white', 
        borderRadius: '16px', 
        padding: '20px 28px', 
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)', 
        border: '1px solid #e2e8f0' 
      }}>
        <button
          onClick={() => setShowProjectInfo(!showProjectInfo)}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '8px 0'
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1a202c', margin: 0 }}>
            프로젝트 정보
          </h2>
          <span style={{ fontSize: '20px', color: '#718096' }}>
            {showProjectInfo ? '▼' : '▶'}
          </span>
        </button>
        
        {showProjectInfo && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <InfoItem label="총 장면" value={`${sceneCount}개`} />
              <InfoItem label="예상 길이" value={formatDuration(totalDuration)} />
              <InfoItem label="생성일" value={formatDate(project.created_at)} />
              <InfoItem label="수정일" value={`${formatDate(project.updated_at)} ${formatTime(project.updated_at)}`} />
              {project.provider && <InfoItem label="이미지 제공자" value={project.provider} />}
              {project.aspectRatio && <InfoItem label="화면 비율" value={project.aspectRatio} />}
              {project.settings?.tts?.voice && <InfoItem label="TTS 보이스" value={project.settings.tts.voice} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 단계 스텝퍼 버튼 컴포넌트
function StepStepperButton({ label, icon, status, stepNumber, onClick, lockedMessage }) {
  const getStatusConfig = () => {
    switch (status) {
      case 'DONE':
        return {
          bg: 'linear-gradient(135deg, #e6ffed 0%, #c6f6d5 100%)',
          border: '#38a169',
          text: '다시보기',
          color: '#2d5016',
          badge: '✓ 완료'
        };
      case 'TODO':
        return {
          bg: 'linear-gradient(135deg, #fff4e6 0%, #ffe0b2 100%)',
          border: '#f59e0b',
          text: '시작하기',
          color: '#92400e',
          badge: '▶ 진행 필요'
        };
      case 'LOCK':
        return {
          bg: '#f7fafc',
          border: '#cbd5e0',
          text: '잠김',
          color: '#a0aec0',
          badge: '🔒 잠금'
        };
      case 'ERROR':
        return {
          bg: 'linear-gradient(135deg, #fee 0%, #fcc 100%)',
          border: '#f44336',
          text: '재시도',
          color: '#c62828',
          badge: '⚠ 오류'
        };
      default:
        return {
          bg: '#f7fafc',
          border: '#e2e8f0',
          text: '',
          color: '#718096',
          badge: ''
        };
    }
  };

  const config = getStatusConfig();
  const isLocked = status === 'LOCK';

  return (
    <button
      onClick={!isLocked ? onClick : () => {}}
      disabled={isLocked}
      style={{
        padding: '20px',
        background: config.bg,
        border: `2px solid ${config.border}`,
        borderRadius: '12px',
        cursor: isLocked ? 'not-allowed' : 'pointer',
        transition: 'all 0.3s',
        textAlign: 'left',
        position: 'relative',
        opacity: isLocked ? 0.6 : 1
      }}
      onMouseEnter={(e) => {
        if (!isLocked) {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isLocked) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
      title={isLocked ? lockedMessage : ''}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px' }}>{icon}</span>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#718096', marginBottom: '4px' }}>
                {stepNumber}단계
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: config.color }}>
                {label}
              </div>
            </div>
          </div>
          <div style={{
            padding: '4px 8px',
            borderRadius: '12px',
            background: status === 'DONE' ? '#c6f6d5' : status === 'TODO' ? '#ffe0b2' : status === 'ERROR' ? '#fcc' : '#e2e8f0',
            fontSize: '10px',
            fontWeight: '700',
            color: config.color
          }}>
            {config.badge}
          </div>
        </div>
        {config.text && (
          <div style={{ 
            fontSize: '13px', 
            fontWeight: '700', 
            color: config.color,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {config.text} {!isLocked && <span>→</span>}
          </div>
        )}
      </div>
    </button>
  );
}

// 자산 카운터 카드 컴포넌트
function AssetCounterCard({ label, count, total, onClick }) {
  const hasValue = count > 0;
  
  return (
    <div
      style={{
        padding: '20px',
        border: `2px solid ${hasValue ? '#c6f6d5' : '#e2e8f0'}`,
        borderRadius: '12px',
        background: hasValue 
          ? 'linear-gradient(135deg, #f0fff4 0%, #e6ffed 100%)' 
          : '#f7fafc',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s',
        textAlign: 'center'
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = '#667eea';
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(102,126,234,0.2)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = hasValue ? '#c6f6d5' : '#e2e8f0';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: '600', color: '#718096', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '32px', fontWeight: '800', color: hasValue ? '#2d5016' : '#a0aec0' }}>
        {count}
      </div>
      {total !== undefined && total !== count && (
        <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
          / {total}
        </div>
      )}
    </div>
  );
}

// 정보 아이템 컴포넌트
function InfoItem({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px', fontWeight: '600' }}>
        {label}
      </div>
      <div style={{ fontSize: '15px', fontWeight: '700', color: '#2d3748' }}>
        {value}
      </div>
    </div>
  );
}
