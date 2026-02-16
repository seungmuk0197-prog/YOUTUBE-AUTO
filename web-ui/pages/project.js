import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import StudioLayout from '../components/StudioLayout';
import ProjectDashboard from '../components/ProjectDashboard';
import { fetchProject, saveScript, generateTTS, generateSubtitles, generateThumbnail, uploadBGM, startRender } from '../lib/api';
import { saveProjectData, loadProjectData, PROJECT_DATA_KEYS } from '../lib/projectStorage';
import { getDisplayTitle } from '../lib/projectUtils';

// JSONGeneration 컴포넌트 동적 import (SSR 방지)
const JSONGeneration = dynamic(() => import('./json-generation'), { ssr: false });

// ImageGeneration 컴포넌트 동적 import (SSR 방지)
const ImageGeneration = dynamic(() => import('./image-generation'), { ssr: false });

/** 프로젝트 페이지 콘텐츠용 단계 라벨 */
const PROJECT_STEPS = [
  { key: 'script', label: '대본' },
  { key: 'tts', label: 'TTS' },
  { key: 'subtitles', label: '자막' },
  { key: 'thumbnail', label: '썸네일' },
  { key: 'bgm', label: 'BGM' },
  { key: 'render', label: '렌더링' },
];
/** URL step -> 진행 단계 패널 activeStep 키 */
const STEP_TO_PROGRESS = {
  script: 'script-gen',
  json: 'json',
  images: 'images',
  tts: 'tts',
  subtitles: 'tts',
  thumbnail: 'video-security',
  bgm: 'video-security',
  render: 'video-security',
};
export default function ProjectPage() {
  const router = useRouter();
  const projectId = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
  const currentStep = Array.isArray(router.query.step) ? router.query.step[0] : router.query.step; // step이 없으면 undefined (Dashboard 표시)
  const activeProgressStep = currentStep ? (STEP_TO_PROGRESS[currentStep] || 'script-gen') : null;

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAction, setIsAction] = useState(false);
  const [message, setMessage] = useState(null);

  // Form states
  const [scriptText, setScriptText] = useState('');
  const [voice, setVoice] = useState('ko-KR-SunHiNeural');
  const [speed, setSpeed] = useState(1.0);
  const [thumbnailTitle, setThumbnailTitle] = useState('');
  const [thumbnailColor, setThumbnailColor] = useState('#667eea');
  const [bgmVolume, setBgmVolume] = useState(50);

  // loadProject 함수를 useEffect 위에 정의 (호이스팅 문제 해결)
  const loadProject = useCallback(async () => {
    if (!projectId) {
      console.warn('[ProjectPage] loadProject called without projectId');
      return;
    }

    try {
      console.log('[ProjectPage] Loading project', { projectId });
      const data = await fetchProject(projectId);
      console.log('[ProjectPage] Project loaded', {
        projectId,
        projectTitle: getDisplayTitle(data),
        title: data?.title,
        topic: data?.topic,
        name: data?.name,
        scenesCount: data?.scenes?.length || 0,
        imagesCount: data?.imagesCount || 0,
        previewImageUrl: data?.previewImageUrl || 'none'
      });
      setProject(data);
      if (data.scenes?.[0]) {
        setScriptText(data.scenes[0].text || '');
      }
      if (data.settings?.tts?.voice) {
        setVoice(data.settings.tts.voice);
      }
      if (data.settings?.thumbnail) {
        setThumbnailTitle(data.settings.thumbnail.title || '');
        setThumbnailColor(data.settings.thumbnail.bg_color || '#667eea');
      }
    } catch (error) {
      console.error('Failed to load project:', error);
      showMessage('프로젝트 로드 실패', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // 디버그: projectId 변경 감지
    console.log('[ProjectPage] useEffect triggered', { projectId, currentUrl: typeof window !== 'undefined' ? window.location.href : 'SSR' });

    // projectId가 변경되면 state 초기화 (중요: 이전 프로젝트 데이터가 남지 않도록)
    if (projectId) {
      // State reset
      setProject(null);
      setLoading(true);
      setScriptText('');
      setVoice('ko-KR-SunHiNeural');
      setSpeed(1.0);
      setThumbnailTitle('');
      setThumbnailColor('#667eea');
      setBgmVolume(50);

      loadProject();
    }

    // 이미지 생성 완료 이벤트 리스너 추가
    const handleProjectDataRefresh = (event) => {
      const { projectId: refreshedId } = event.detail;
      if (refreshedId === projectId) {
        console.log(`Project ${projectId} data refreshed after image generation`);
        loadProject();
      }
    };

    window.addEventListener('projectDataRefresh', handleProjectDataRefresh);

    return () => {
      window.removeEventListener('projectDataRefresh', handleProjectDataRefresh);
    };
  }, [projectId, loadProject]); // projectId가 변경될 때마다 실행

  // Handle redirects for 'json' step (Moved from conditional block)
  useEffect(() => {
    if (projectId && currentStep === 'json' && project && hasScript()) {
      router.replace(`/json-generation?projectId=${projectId}`);
    }
  }, [projectId, currentStep, project, router]);

  function showMessage(text, type = 'success') {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }

  function navigateToStep(stepKey) {
    router.push(`/project?id=${projectId}&step=${stepKey}`);
  }

  function handleProgressStepClick(progressKey) {
    switch (progressKey) {
      case 'topic':
        router.push('/');
        return;
      case 'script-plan':
        router.push(`/script-planning?projectId=${projectId}`);
        return;
      case 'script-gen':
        router.push(`/script-generation?projectId=${projectId}`);
        return;
      case 'json':
        router.push(`/json-generation?projectId=${projectId}`);
        return;
      case 'images':
        router.push(`/image-generation?projectId=${projectId}`);
        return;
      case 'tts':
        router.push(`/project?id=${projectId}&step=tts`);
        return;
      case 'video-security':
        router.push(`/project?id=${projectId}&step=render`);
        return;
      default:
        return;
    }
  }

  // Action handlers
  async function handleSaveScript() {
    if (!scriptText.trim()) {
      showMessage('대본을 입력해주세요.', 'error');
      return;
    }

    try {
      setIsAction(true);
      await saveScript(projectId, scriptText);
      showMessage('대본이 저장되었습니다.');
      await loadProject();
    } catch (error) {
      console.error('Save script error:', error);
      showMessage('대본 저장 실패: Not connected yet', 'error');
    } finally {
      setIsAction(false);
    }
  }

  async function handleGenerateTTS() {
    if (!project?.scenes?.length) {
      showMessage('대본을 먼저 저장해주세요.', 'error');
      return;
    }

    try {
      setIsAction(true);
      const sceneId = project.scenes[0].id;
      await generateTTS(projectId, sceneId, voice, speed);
      showMessage('TTS 생성이 완료되었습니다.');
      await loadProject();
    } catch (error) {
      console.error('Generate TTS error:', error);
      showMessage('TTS 생성 실패: Not connected yet', 'error');
    } finally {
      setIsAction(false);
    }
  }

  async function handleGenerateSubtitles() {
    if (!project?.settings?.tts?.audio_paths?.length) {
      showMessage('TTS를 먼저 생성해주세요.', 'error');
      return;
    }

    try {
      setIsAction(true);
      await generateSubtitles(projectId);
      showMessage('자막 생성 완료');
      await loadProject();
    } catch (error) {
      console.error('Generate subtitles error:', error);
      showMessage('자막 생성 실패: Not connected yet', 'error');
    } finally {
      setIsAction(false);
    }
  }

  async function handleGenerateThumbnail() {
    try {
      setIsAction(true);
      await generateThumbnail(projectId, thumbnailTitle, thumbnailColor);
      showMessage('썸네일이 생성되었습니다.');
      await loadProject();
    } catch (error) {
      console.error('Generate thumbnail error:', error);
      showMessage('썸네일 생성 실패: Not connected yet', 'error');
    } finally {
      setIsAction(false);
    }
  }

  async function handleUploadBGM(file) {
    if (!file) return;

    try {
      setIsAction(true);
      await uploadBGM(projectId, file);
      showMessage('BGM이 업로드되었습니다.');
      await loadProject();
    } catch (error) {
      console.error('Upload BGM error:', error);
      showMessage('BGM 업로드 실패: Not connected yet', 'error');
    } finally {
      setIsAction(false);
    }
  }

  async function handleStartRender() {
    try {
      setIsAction(true);
      await startRender(projectId);
      showMessage('영상 렌더링이 완료되었습니다!');
      await loadProject();
    } catch (error) {
      console.error('Start render error:', error);
      showMessage('렌더링 실패: Not connected yet', 'error');
    } finally {
      setIsAction(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
        <p>로딩 중...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
        <p>프로젝트를 찾을 수 없습니다.</p>
      </div>
    );
  }

  // step이 없으면 Dashboard 표시
  if (!currentStep) {
    return (
      <StudioLayout
        project={project}
        projectId={projectId}
        activeStep={null}
        onStepClick={handleProgressStepClick}
      >
        <ProjectDashboard projectId={projectId} project={project} />
      </StudioLayout>
    );
  }

  // step=images일 때 ImageGeneration 컴포넌트 렌더링
    if (currentStep === 'images') {
      // 대본과 JSON이 있는지 확인
      const hasJson = project?.scenes?.length > 0; // scenes.json이 있다는 의미
      if (!hasScript()) {
        return (
          <StudioLayout
            project={project}
            projectId={projectId}
            activeStep={activeProgressStep}
            onStepClick={handleProgressStepClick}
          >
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <p style={{ fontSize: '18px', color: '#718096', marginBottom: '20px' }}>대본이 입력되어 있지 않습니다.</p>
              <button
                onClick={() => router.push(`/project?id=${projectId}&step=script`)}
                style={{ padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginRight: '10px' }}
              >
                대본 편집으로 이동
              </button>
              <button
                onClick={() => router.push(`/project?id=${projectId}`)}
                style={{ padding: '10px 20px', background: 'white', color: '#4a5568', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}
              >
                대시보드로 돌아가기
              </button>
            </div>
          </StudioLayout>
        );
      }
      if (!hasJson) {
        return (
          <StudioLayout
            project={project}
            projectId={projectId}
            activeStep={activeProgressStep}
            onStepClick={handleProgressStepClick}
          >
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <p style={{ fontSize: '18px', color: '#718096', marginBottom: '20px' }}>JSON이 생성되어 있지 않습니다.</p>
              <button
                onClick={() => router.push(`/json-generation?projectId=${projectId}`)}
                style={{ padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginRight: '10px' }}
              >
                JSON 생성으로 이동
              </button>
              <button
                onClick={() => router.push(`/project?id=${projectId}`)}
                style={{ padding: '10px 20px', background: 'white', color: '#4a5568', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}
              >
                대시보드로 돌아가기
              </button>
            </div>
          </StudioLayout>
        );
      }
      return (
        <StudioLayout
          project={project}
          projectId={projectId}
          activeStep={activeProgressStep}
          onStepClick={handleProgressStepClick}
        >
          <ImageGeneration projectId={projectId} />
        </StudioLayout>
      );
    }

  // 대본 판단 함수: 작업단계-대본 편집에 내용이 있으면 접근 가능
  function hasScript() {
    if (!project?.scenes || project.scenes.length === 0) {
      return false;
    }
    // 첫 번째 씬에 text 또는 narration_ko가 있으면 대본이 있다고 판단
    const firstScene = project.scenes[0];
    return !!(firstScene?.text || firstScene?.narration_ko || firstScene?.narration_en);
  }

  // step=json일 때 json-generation 페이지로 리다이렉트
  if (currentStep === 'json') {
    // 대본이 있는지 확인
    if (!hasScript()) {
      return (
        <StudioLayout
          project={project}
          projectId={projectId}
          activeStep={activeProgressStep}
          onStepClick={handleProgressStepClick}
        >
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <p style={{ fontSize: '18px', color: '#718096', marginBottom: '20px' }}>대본이 입력되어 있지 않습니다.</p>
            <button
              onClick={() => router.push(`/project?id=${projectId}&step=script`)}
              style={{ padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginRight: '10px' }}
            >
              대본 편집으로 이동
            </button>
            <button
              onClick={() => router.push(`/project?id=${projectId}`)}
              style={{ padding: '10px 20px', background: 'white', color: '#4a5568', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}
            >
              대시보드로 돌아가기
            </button>
          </div>
        </StudioLayout>
      );
    }
    // 대본이 있으면 json-generation 페이지로 리다이렉트
    // (useEffect is moved to top-level to avoid "Rendered more hooks" error)
    return null;
  }

  const stepInfo = PROJECT_STEPS.find(s => s.key === currentStep) || PROJECT_STEPS[0];

  return (
    <StudioLayout
      project={project}
      projectId={projectId}
      activeStep={activeProgressStep}
      onStepClick={handleProgressStepClick}
    >
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '800',
          color: '#1a202c',
          marginBottom: '8px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          {stepInfo.label}
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#718096',
          fontWeight: '500',
          lineHeight: '1.6'
        }}>
          {stepInfo.key === 'script' ? '영상의 나레이션 대본을 작성하고 저장하세요.' : ''}
          {stepInfo.key === 'tts' ? 'AI 음성으로 대본을 읽게 합니다.' : ''}
          {stepInfo.key === 'subtitles' ? 'TTS 오디오로부터 자동 자막을 생성합니다.' : ''}
          {stepInfo.key === 'thumbnail' ? 'AI가 생성한 썸네일 이미지입니다.' : ''}
          {stepInfo.key === 'bgm' ? '배경 음악을 추가합니다.' : ''}
          {stepInfo.key === 'render' ? '최종 영상을 생성합니다.' : ''}
        </p>
      </div>

      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '800px',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0'
      }}>
        {/* Messages */}
        {message && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '6px',
            marginBottom: '20px',
            fontSize: '13px',
            background: message.type === 'error' ? '#ffebee' : '#e8f5e9',
            color: message.type === 'error' ? '#c62828' : '#2e7d32',
            border: `1px solid ${message.type === 'error' ? '#f44336' : '#4caf50'}`
          }}>
            {message.text}
          </div>
        )}

        {/* SCRIPT STEP */}
        {currentStep === 'script' && (
          <>
            {/* 이전 단계로 돌아가기 버튼 */}
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => router.push(`/project?id=${projectId}`)}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  color: '#4a5568',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.3s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.color = '#667eea';
                  e.currentTarget.style.transform = 'translateX(-4px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102,126,234,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.color = '#4a5568';
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                }}
              >
                <span style={{ fontSize: '18px' }}>←</span> 대시보드로
              </button>
            </div>
            <div style={{
              marginBottom: '24px',
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              border: '1px solid #e2e8f0'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
                color: '#1a202c',
                fontWeight: '700',
                fontSize: '16px'
              }}>
                <span style={{ fontSize: '20px' }}>📝</span>
                영상 대본
              </label>
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="영상의 나레이션 대본을 입력하세요..."
                style={{
                  width: '100%',
                  padding: '16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontFamily: 'inherit',
                  minHeight: '200px',
                  resize: 'vertical',
                  transition: 'all 0.3s',
                  lineHeight: '1.6'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102,126,234,0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <p style={{
                color: '#718096',
                fontSize: '13px',
                marginTop: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>💡</span> 한국어 또는 영어로 입력하세요. 자동으로 TTS 음성으로 변환됩니다.
              </p>
            </div>
            <button
              onClick={handleSaveScript}
              disabled={isAction}
              style={{
                width: '100%',
                padding: '16px 24px',
                background: isAction
                  ? '#cbd5e0'
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: isAction ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                boxShadow: isAction
                  ? 'none'
                  : '0 4px 16px rgba(102,126,234,0.3)',
                opacity: isAction ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!isAction) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(102,126,234,0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isAction) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(102,126,234,0.3)';
                }
              }}
            >
              {isAction ? '⏳ 저장 중...' : '💾 대본 저장'}
            </button>
          </>
        )}

        {/* TTS STEP */}
        {currentStep === 'tts' && (
          <>
            <div style={{
              marginBottom: '24px',
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              border: '1px solid #e2e8f0'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
                color: '#1a202c',
                fontWeight: '700',
                fontSize: '16px'
              }}>
                <span style={{ fontSize: '20px' }}>🎙️</span>
                음성 선택
              </label>
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: '600',
                  color: '#2d3748',
                  background: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102,126,234,0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <option value="ko-KR-SunHiNeural">한국어 - 여성 (Sun Hi)</option>
                <option value="ko-KR-InJoonNeural">한국어 - 남성 (In Joon)</option>
                <option value="en-US-AriaNeural">English - Female (Aria)</option>
                <option value="en-US-GuyNeural">English - Male (Guy)</option>
              </select>
            </div>

            <div style={{
              marginBottom: '24px',
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              border: '1px solid #e2e8f0'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
                color: '#1a202c',
                fontWeight: '700',
                fontSize: '16px'
              }}>
                <span style={{ fontSize: '20px' }}>⚡</span>
                재생 속도 (배속)
              </label>
              <select
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: '600',
                  color: '#2d3748',
                  background: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102,126,234,0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <option value="0.8">0.8배 (느림)</option>
                <option value="0.9">0.9배</option>
                <option value="1.0">1.0배 (기본)</option>
                <option value="1.1">1.1배</option>
                <option value="1.2">1.2배 (빠름)</option>
              </select>
              <p style={{
                color: '#718096',
                fontSize: '13px',
                marginTop: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>💡</span> 선택한 속도로 TTS를 생성합니다.
              </p>
            </div>

            <button
              onClick={handleGenerateTTS}
              disabled={isAction}
              style={{
                width: '100%',
                padding: '16px 24px',
                background: isAction
                  ? '#cbd5e0'
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: isAction ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                boxShadow: isAction
                  ? 'none'
                  : '0 4px 16px rgba(102,126,234,0.3)',
                opacity: isAction ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!isAction) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(102,126,234,0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isAction) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(102,126,234,0.3)';
                }
              }}
            >
              {isAction ? '⏳ 생성 중...' : '🔊 TTS 생성'}
            </button>

            {project.settings?.tts?.audio_paths?.length > 0 && (
              <div style={{ marginTop: '20px', padding: '20px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                <h3 style={{ marginBottom: '10px', fontSize: '14px' }}>🔊 결과</h3>
                <p style={{ fontSize: '13px', color: '#666' }}>오디오가 생성되었습니다.</p>
                <button
                  onClick={() => router.push(`/project?id=${projectId}&step=render`)}
                  style={{
                    marginTop: '12px',
                    padding: '10px 16px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  다음 단계: 영상보안(렌더) →
                </button>
              </div>
            )}
          </>
        )}

        {/* SUBTITLES STEP */}
        {currentStep === 'subtitles' && (
          <>
            <p style={{ color: '#999', fontSize: '12px', marginBottom: '15px' }}>
              💡 TTS 오디오로부터 자동으로 자막을 생성합니다.
            </p>
            <button
              onClick={handleGenerateSubtitles}
              disabled={isAction || !project.settings?.tts?.audio_paths?.length}
              style={{
                width: '100%',
                padding: '12px 24px',
                background: isAction || !project.settings?.tts?.audio_paths?.length ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isAction || !project.settings?.tts?.audio_paths?.length ? 'not-allowed' : 'pointer'
              }}
            >
              {isAction ? '생성 중...' : '자막 생성'}
            </button>
            {!project.settings?.tts?.audio_paths?.length && (
              <p style={{ marginTop: '12px', color: '#ff9800', fontSize: '12px' }}>
                ⚠️ TTS를 먼저 생성해주세요.
              </p>
            )}
          </>
        )}

        {/* THUMBNAIL STEP */}
        {currentStep === 'thumbnail' && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '600', fontSize: '14px' }}>
                썸네일 제목
              </label>
              <input
                type="text"
                value={thumbnailTitle}
                onChange={(e) => setThumbnailTitle(e.target.value)}
                placeholder="예: 새로운 기술 설명"
                style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '600', fontSize: '14px' }}>
                배경색
              </label>
              <input
                type="text"
                value={thumbnailColor}
                onChange={(e) => setThumbnailColor(e.target.value)}
                placeholder="#667eea"
                style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}
              />
              <p style={{ color: '#999', fontSize: '12px', marginTop: '6px' }}>색상 코드 형식: #RRGGBB</p>
            </div>

            <button
              onClick={handleGenerateThumbnail}
              disabled={isAction}
              style={{
                width: '100%',
                padding: '12px 24px',
                background: isAction ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isAction ? 'not-allowed' : 'pointer'
              }}
            >
              {isAction ? '생성 중...' : '썸네일 생성'}
            </button>
          </>
        )}

        {/* BGM STEP */}
        {currentStep === 'bgm' && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <label>
                <input type="checkbox" style={{ marginRight: '8px' }} defaultChecked={project.settings?.bgm?.enabled} />
                <span style={{ color: '#333', fontWeight: '600' }}>BGM 사용 여부</span>
              </label>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '600', fontSize: '14px' }}>
                BGM 볼륨: <span style={{ color: '#667eea', fontWeight: 'bold' }}>{bgmVolume}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={bgmVolume}
                onChange={(e) => setBgmVolume(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '600', fontSize: '14px' }}>
                BGM 파일
              </label>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => e.target.files?.[0] && handleUploadBGM(e.target.files[0])}
                style={{ display: 'none' }}
                id="bgm-file-input"
              />
              <label
                htmlFor="bgm-file-input"
                style={{
                  display: 'block',
                  padding: '12px',
                  background: '#f0f0f0',
                  border: '2px dashed #ddd',
                  borderRadius: '8px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.background = '#f9f9ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#ddd';
                  e.currentTarget.style.background = '#f0f0f0';
                }}
              >
                📤 음악 파일 업로드 (MP3/WAV)
              </label>
            </div>
          </>
        )}

        {/* RENDER STEP */}
        {currentStep === 'render' && (
          <>
            <button
              onClick={handleStartRender}
              disabled={isAction}
              style={{
                width: '100%',
                padding: '12px 24px',
                background: isAction ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isAction ? 'not-allowed' : 'pointer'
              }}
            >
              {isAction ? '렌더링 중...' : '최종 영상 렌더링'}
            </button>
            <p style={{ color: '#999', fontSize: '12px', marginTop: '15px' }}>
              ⏱️ 렌더링에 시간이 걸릴 수 있습니다. 완료될 때까지 대기해주세요.
            </p>
          </>
        )}
      </div>
    </StudioLayout>
  );
}
