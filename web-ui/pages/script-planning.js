import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import StudioLayout from '../components/StudioLayout';
import { fetchProject, updateProject } from '../lib/api';

const DRAFT_STORAGE_KEY = 'scriptPlanningDraft';

export default function ScriptPlanning() {
    const router = useRouter();
    const { projectId } = router.query;
    const fromStep = router.query?.from || '';
    const [draftLoaded, setDraftLoaded] = useState(false);

    // Basic Info
    const [topic, setTopic] = useState('');

    // Strategic Fields (Required)
    const [coreMessage, setCoreMessage] = useState('');
    const [viewerPainPoint, setViewerPainPoint] = useState('');

    const DURATION_OPTIONS = [30, 60, 120, 150, 300, 600, 1200, 1800, 2400];
    const [duration, setDuration] = useState(60);
    const [tone, setTone] = useState('');
    const [audience, setAudience] = useState('');
    const [style, setStyle] = useState('');
    const [structure, setStructure] = useState('hook'); // Default structure
    const [additionalRequests, setAdditionalRequests] = useState('');

    // Advanced Options
    const [hookType, setHookType] = useState([]); // ['statistics', 'question'] etc.
    const [emotionIntensity, setEmotionIntensity] = useState(3);

    // UI State
    const [loading, setLoading] = useState(false);
    const [hasExistingScript, setHasExistingScript] = useState(false);

    useEffect(() => {
        if (!projectId) return;

        async function loadData() {
            try {
                const project = await fetchProject(projectId);
                if (project) {
                    setTopic(project.topic || project.title || '');

                    // Blueprint가 있으면 상태 복원
                    if (project.blueprint) {
                        try {
                            const bp = typeof project.blueprint === 'string' ? JSON.parse(project.blueprint) : project.blueprint;
                            if (bp.coreMessage) setCoreMessage(bp.coreMessage);
                            if (bp.viewerPainPoint) setViewerPainPoint(bp.viewerPainPoint);
                            if (bp.length) setDuration(bp.length);
                            if (bp.tone) setTone(bp.tone);
                            if (bp.targetAudience) setAudience(bp.targetAudience);
                            if (bp.style) setStyle(bp.style);
                            if (bp.scriptStructure) setStructure(bp.scriptStructure);
                            if (bp.hookType) setHookType(bp.hookType);
                            if (bp.emotionIntensity) setEmotionIntensity(bp.emotionIntensity);
                            if (bp.additionalRequests) setAdditionalRequests(bp.additionalRequests);
                        } catch (e) {
                            console.error("Failed to parse blueprint from project", e);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch project", e);
            }
        }
        loadData();
    }, [projectId]);

    useEffect(() => {
        if (draftLoaded) return;
        if (typeof window === 'undefined') {
            setDraftLoaded(true);
            return;
        }

        let draftData = null;
        try {
            const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
            if (!saved) {
                return;
            }
            draftData = JSON.parse(saved);
            const storedProjectId = draftData?.projectId || '';

            if (projectId) {
                if (storedProjectId && storedProjectId !== projectId) {
                    draftData = null;
                }
            } else if (storedProjectId) {
                draftData = null;
            }
        } catch (error) {
            console.warn('Failed to load script planning draft', error);
            draftData = null;
        } finally {
            setDraftLoaded(true);
        }

        if (!draftData) return;

        if (draftData.topic) setTopic(draftData.topic);
        if (draftData.coreMessage) setCoreMessage(draftData.coreMessage);
        if (draftData.viewerPainPoint) setViewerPainPoint(draftData.viewerPainPoint);
        if (draftData.duration) setDuration(draftData.duration);
        if (draftData.tone) setTone(draftData.tone);
        if (draftData.audience) setAudience(draftData.audience);
        if (draftData.style) setStyle(draftData.style);
        if (draftData.structure) setStructure(draftData.structure);
        if (draftData.additionalRequests) setAdditionalRequests(draftData.additionalRequests);
        if (Array.isArray(draftData.hookType)) setHookType(draftData.hookType);
        if (draftData.emotionIntensity !== undefined && draftData.emotionIntensity !== null) {
            setEmotionIntensity(draftData.emotionIntensity);
        }
    }, [draftLoaded, projectId]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const payload = {
            projectId: projectId || '',
            topic,
            coreMessage,
            viewerPainPoint,
            duration,
            tone,
            audience,
            style,
            structure,
            additionalRequests,
            hookType,
            emotionIntensity
        };
        try {
            window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
        } catch (error) {
            console.warn('Failed to persist script planning draft', error);
        }
    }, [
        projectId,
        topic,
        coreMessage,
        viewerPainPoint,
        duration,
        tone,
        audience,
        style,
        structure,
        additionalRequests,
        hookType,
        emotionIntensity
    ]);

    const formatDurationLabel = (seconds) => {
        if (seconds < 60) {
            return `${seconds}초`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainder = seconds % 60;
        if (remainder === 0) {
            return `${minutes}분`;
        }
        return `${minutes}분 ${remainder}초`;
    };

    const handleHookToggle = (e) => {
        const value = e.target.value;
        setHookType(prev =>
            prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]
        );
    };

    const generateDefaultValues = (t) => {
        return {
            duration: 60,
            tone: 'casual',
            audience: 'general',
            style: 'shorts',
            coreMessage: `${t}에 대한 핵심 정보를 쉽고 빠르게 알려드립니다`,
            viewerPainPoint: `${t}에 대해 궁금하지만 정보가 너무 많아 혼란스러운 분들`,
            hookType: ['question'],
            emotionIntensity: 3,
            structure: 'hook',
            additionalRequests: ''
        };
    };

    const handleAutoFill = () => {
        if (!topic.trim()) {
            alert('주제를 먼저 입력해주세요.');
            return;
        }

        if (confirm('현재 입력된 내용이 기본 설정으로 덮어씌워집니다. 계속하시겠습니까?')) {
            const defaults = generateDefaultValues(topic);

            setDuration(defaults.duration);
            setTone(defaults.tone);
            setAudience(defaults.audience);
            setStyle(defaults.style);
            setCoreMessage(defaults.coreMessage);
            setViewerPainPoint(defaults.viewerPainPoint);
            setHookType(defaults.hookType);
            setEmotionIntensity(defaults.emotionIntensity);
            setStructure(defaults.structure);
            setAdditionalRequests(defaults.additionalRequests);
        }
    };

    const validateForm = () => {
        // 주제와 영상길이만 필수
        if (!topic.trim()) {
            alert('주제를 입력해주세요.');
            return false;
        }

        if (duration <= 0) {
            alert('영상 길이를 선택해주세요.');
            return false;
        }

        return true;
    };

    const generateBlueprint = () => {
        return {
            // 기본 정보
            topic,
            length: duration,
            tone,
            targetAudience: audience,
            style,

            // 전략적 입력
            coreMessage,
            viewerPainPoint,
            hookType,
            emotionIntensity: parseInt(emotionIntensity),

            // 대본 구조
            scriptStructure: structure,
            additionalRequests, // Added

            // 생성 전략 (Internal Logic)
            generationStrategy: {
                openingStyle: hookType.length > 0 ? hookType[0] : 'direct',
                emotionalCurve: emotionIntensity >= 4 ? 'dramatic' : (emotionIntensity <= 2 ? 'steady' : 'dynamic'), // Enhanced logic
                persuasiveStyle: tone === 'educational' ? 'logical' : 'emotional',
                pacing: duration <= 60 ? 'fast' : 'moderate' // Added logic
            },

            // 메타데이터
            metadata: {
                createdAt: new Date().toISOString(),
                version: '2.1', // Version bump
                source: 'manual'
            }
        };
    };

    const handleGenerateScript = async () => {
        if (!validateForm()) return;

        // 로딩 시작
        setLoading(true);

        const blueprint = generateBlueprint();

        try {
            if (projectId) {
                // 백엔드에 저장
                await updateProject(projectId, { blueprint });
                console.log('Blueprint saved to project:', blueprint);
                router.push(`/script-generation?projectId=${projectId}`);
            } else {
                // Falback: LocalStorage
                await new Promise(resolve => setTimeout(resolve, 500));
                localStorage.setItem('step2Blueprint', JSON.stringify(blueprint));
                localStorage.removeItem('generatedScript');
                console.log('Blueprint saved to localStorage:', blueprint);
                router.push('/script-generation');
            }

        } catch (error) {
            console.error(error);
            alert('대본 생성 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveDraft = () => {
        alert('임시 저장되었습니다.');
    };

    const previousStepLabel = fromStep === 'topic' ? '주제 추천' : (projectId ? '프로젝트' : '프로젝트 목록');
    const nextStepLabel = 'AI 대본 생성';

    const goBack = () => {
        if (fromStep === 'topic') {
            router.push('/');
            return;
        }
        if (projectId) {
            router.push(`/project?id=${projectId}`);
            return;
        }
        router.push('/projects?filter=active');
    };

    // 주제와 영상길이만 선택되어 있어도 버튼 활성화
    const isFormComplete =
        topic.trim() &&
        duration > 0;

    return (
        <StudioLayout
            title="AI 대본 기획 - HANRA STUDIO"
            activeStep="script-plan" // Highlights Step 2
            projectId={projectId}
        >
            <Head>
                <title>AI 대본 기획 - HANRA STUDIO</title>
            </Head>

            <div className="script-planning-container">
                {/* 헤더 */}
            <header>
                <div className="header-top">
                    <button onClick={goBack} className="back-btn">
                        ← 이전 단계: {previousStepLabel}
                    </button>
                    <div className="step-direction-row">
                        <div className="step-direction">
                            <span className="step-label">이전 단계</span>
                            <span className="step-value">{previousStepLabel}</span>
                        </div>
                        <div className="step-direction">
                            <span className="step-label">다음 단계</span>
                            <span className="step-value next">{nextStepLabel}</span>
                        </div>
                    </div>
                </div>
                <div className="header-title-row">
                    <h1>AI 대본 기획</h1>
                    <span className="step-badge">단계 2/6</span>
                </div>
            </header>

                {/* 메인 컨텐츠 */}
                <main className="planning-content">

                    {/* 섹션 1: 선택된 주제 표시 */}
                    <section className="planning-section topic-display">
                        <div className="section-header">
                            <h2>1. 선택된 주제</h2>
                            <button
                                className="auto-fill-btn"
                                onClick={handleAutoFill}
                                title="주제를 기반으로 기획 설정을 자동으로 입력합니다"
                            >
                                ⚡ 대본기획폼 자동작성
                            </button>
                        </div>
                        <div className="topic-card">
                            <span className="topic-label">주제</span>
                            <input
                                type="text"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                className="topic-input"
                                placeholder="주제를 입력하세요"
                            />
                            <button className="edit-btn">✏️ 수정</button>
                        </div>
                    </section>

                    {/* 섹션 2: 대본 옵션 설정 */}
                    <section className="planning-section script-options">
                        <h2>2. 대본 옵션 설정</h2>

                        {/* 영상 길이 (확장됨) */}
                        <div className="option-group required">
                            <label>영상 길이 <span className="required-mark">*</span></label>
                        <div className="duration-grid">
                            {DURATION_OPTIONS.map(val => (
                                <button
                                    key={val}
                                    className={duration === val ? 'active' : ''}
                                    onClick={() => setDuration(val)}
                                >
                                        {formatDurationLabel(val)}
                                </button>
                            ))}
                        </div>
                        </div>

                        {/* 핵심 한 줄 메시지 (필수) */}
                        <div className="option-group required">
                            <label>
                                핵심 한 줄 메시지 <span className="required-mark">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="이 영상이 반드시 전달해야 할 핵심 한 문장"
                                value={coreMessage}
                                onChange={e => setCoreMessage(e.target.value)}
                                maxLength={100}
                                required
                                className="text-input"
                            />
                            <small className="hint">예: "AI로 10분 만에 유튜브 영상 만들기"</small>
                        </div>

                        {/* 시청자 문제 정의 (필수) */}
                        <div className="option-group required">
                            <label>
                                시청자 문제 정의 <span className="required-mark">*</span>
                            </label>
                            <textarea
                                rows={3}
                                placeholder="이 영상이 해결하려는 문제는?"
                                value={viewerPainPoint}
                                onChange={e => setViewerPainPoint(e.target.value)}
                                required
                                className="text-area"
                            />
                            <small className="hint">
                                예: "영상 편집에 시간이 너무 오래 걸려서 포기하는 사람들"
                            </small>
                        </div>

                        {/* 톤앤매너 (필수) */}
                        <div className="option-group required">
                            <label>톤앤매너 <span className="required-mark">*</span></label>
                            <div className="button-group">
                                {[
                                    { id: 'humor', label: '😄 유머러스' },
                                    { id: 'serious', label: '🎯 진지함' },
                                    { id: 'educational', label: '📚 교육적' },
                                    { id: 'casual', label: '💬 캐주얼' }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        className={tone === opt.id ? 'active' : ''}
                                        onClick={() => setTone(opt.id)}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 대상 청중 */}
                        <div className="option-group">
                            <label>대상 청중</label>
                            <div className="button-group">
                                {[
                                    { id: 'beginner', label: '🌱 초보자' },
                                    { id: 'intermediate', label: '🎓 중급자' },
                                    { id: 'expert', label: '🏆 전문가' },
                                    { id: 'general', label: '👥 일반 대중' }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        className={audience === opt.id ? 'active' : ''}
                                        onClick={() => setAudience(opt.id)}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 영상 스타일 */}
                        <div className="option-group">
                            <label>영상 스타일</label>
                            <div className="button-group">
                                {[
                                    { id: 'shorts', label: '📱 쇼츠' },
                                    { id: 'tutorial', label: '🎬 튜토리얼' },
                                    { id: 'vlog', label: '📹 브이로그' },
                                    { id: 'review', label: '⭐ 리뷰' }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        className={style === opt.id ? 'active' : ''}
                                        onClick={() => setStyle(opt.id)}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 클릭 유도 장치 (선택) */}
                        <div className="option-group">
                            <label>클릭 유도 장치 (선택)</label>
                            <div className="checkbox-group">
                                <label className="checkbox-item">
                                    <input
                                        type="checkbox"
                                        value="statistics"
                                        checked={hookType.includes('statistics')}
                                        onChange={handleHookToggle}
                                    />
                                    📊 통계 활용
                                </label>
                                <label className="checkbox-item">
                                    <input
                                        type="checkbox"
                                        value="shocking"
                                        checked={hookType.includes('shocking')}
                                        onChange={handleHookToggle}
                                    />
                                    ⚡ 충격적 사실
                                </label>
                                <label className="checkbox-item">
                                    <input
                                        type="checkbox"
                                        value="empathy"
                                        checked={hookType.includes('empathy')}
                                        onChange={handleHookToggle}
                                    />
                                    💭 공감 스토리
                                </label>
                                <label className="checkbox-item">
                                    <input
                                        type="checkbox"
                                        value="question"
                                        checked={hookType.includes('question')}
                                        onChange={handleHookToggle}
                                    />
                                    ❓ 질문형 도입
                                </label>
                            </div>
                        </div>

                        {/* 감정 유도 강도 (슬라이더) */}
                        <div className="option-group">
                            <label>감정 유도 강도</label>
                            <div className="slider-container">
                                <input
                                    type="range"
                                    min="1"
                                    max="5"
                                    value={emotionIntensity}
                                    onChange={e => setEmotionIntensity(e.target.value)}
                                    className="emotion-slider"
                                />
                                <div className="slider-labels">
                                    <span>차분함</span>
                                    <span className="current-value">{emotionIntensity}</span>
                                    <span>강렬함</span>
                                </div>
                            </div>
                        </div>

                        {/* 추가 요청사항 */}
                        <div className="option-group">
                            <label>추가 요청사항 (선택)</label>
                            <textarea
                                placeholder="특별히 포함하고 싶은 내용이나 피하고 싶은 내용을 입력하세요..."
                                rows={3}
                                value={additionalRequests}
                                onChange={e => setAdditionalRequests(e.target.value)}
                                className="option-textarea"
                            />
                        </div>
                    </section>

                    {/* 섹션 3: 대본 구조 선택 */}
                    <section className="planning-section script-structure">
                        <h2>3. 대본 구조</h2>
                        <div className="structure-options">
                            {[
                                { id: 'hook', title: '훅 → 본론 → 결론', desc: '시청자 관심을 즉시 끌고 핵심 전달' },
                                { id: 'story', title: '스토리텔링', desc: '문제 제시 → 과정 → 해결' },
                                { id: 'list', title: '리스트형', desc: '5가지 방법, TOP 10 등' }
                            ].map(opt => (
                                <div
                                    key={opt.id}
                                    className={`structure-card ${structure === opt.id ? 'selected' : ''}`}
                                    onClick={() => setStructure(opt.id)}
                                >
                                    <h3>{opt.title}</h3>
                                    <p>{opt.desc}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 실시간 미리보기 카드 */}
                    <div className="preview-card">
                        <h3>📋 생성 설정 미리보기</h3>
                        <div className="preview-grid">
                            <div className="preview-item">
                                <span className="label">길이:</span>
                                <span className="value">{formatDurationLabel(duration)}</span>
                            </div>
                            <div className="preview-item">
                                <span className="label">톤:</span>
                                <span className="value">{tone ? (tone === 'humor' ? '유머러스' : (tone === 'serious' ? '진지함' : (tone === 'educational' ? '교육적' : '캐주얼'))) : '선택 안 됨'}</span>
                            </div>
                            <div className="preview-item">
                                <span className="label">핵심 메시지:</span>
                                <span className="value" style={{ fontSize: '13px' }}>{coreMessage || '입력 필요'}</span>
                            </div>
                            <div className="preview-item">
                                <span className="label">타겟:</span>
                                <span className="value">{audience ? (audience === 'beginner' ? '초보자' : (audience === 'intermediate' ? '중급자' : (audience === 'expert' ? '전문가' : '일반 대중'))) : '선택 안 됨'}</span>
                            </div>
                            <div className="preview-item">
                                <span className="label">감정 강도:</span>
                                <span className="value">{emotionIntensity}/5</span>
                            </div>
                        </div>
                    </div>

                </main>

                {/* 하단 액션 버튼 */}
                <footer className="action-buttons">
                    <button className="btn-secondary" onClick={handleSaveDraft}>
                        💾 임시 저장
                    </button>
                    <button
                        className="btn-primary"
                        onClick={handleGenerateScript}
                        disabled={loading || !isFormComplete}
                        title={!isFormComplete ? "주제와 영상길이를 선택해주세요" : ""}
                    >
                        {loading ? '생성 중...' : '✨ AI 대본 생성'}
                    </button>
                </footer>
            </div>

            <style jsx>{`
        .script-planning-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          padding: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        header h1 {
            font-size: 20px;
            font-weight: 700;
            color: #2d3748;
            margin: 0;
        }
        .header-top {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            align-items: center;
            margin-bottom: 12px;
        }
        .step-direction-row {
            display: flex;
            gap: 16px;
        }
        .step-direction {
            display: flex;
            flex-direction: column;
            font-size: 12px;
            color: #6b7280;
        }
        .step-direction .step-label {
            font-weight: 600;
            letter-spacing: 0.04em;
            text-transform: uppercase;
        }
        .step-direction .step-value {
            font-size: 14px;
            font-weight: 700;
            color: #1f2937;
        }
        .step-direction .step-value.next {
            color: #8b5cf6;
        }
        .header-title-row {
            display: flex;
            align-items: baseline;
            gap: 12px;
        }

        .back-btn {
            background: none;
            border: none;
            font-size: 16px;
            color: #718096;
            cursor: pointer;
            font-weight: 600;
        }
        
        .step-badge {
            background: #EDF2F7;
            color: #4A5568;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }

        .planning-section {
          background: white;
          padding: 24px;
          border-radius: 12px;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .planning-section h2 {
            font-size: 18px;
            font-weight: 700;
            color: #2d3748;
            margin: 0;
        }
        
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .auto-fill-btn {
            background: linear-gradient(135deg, #FFD93D 0%, #FFA500 100%);
            color: #333;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(255, 165, 0, 0.2);
            transition: all 0.2s;
        }

        .auto-fill-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 10px rgba(255, 165, 0, 0.3);
        }

        /* Topic Display */
        .topic-card {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 16px;
          background: #F5F3FF;
          border-radius: 8px;
          border: 2px solid #8B7DE8;
        }
        
        .topic-label {
            font-weight: 600;
            color: #6B5DD8;
            background: white;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 13px;
        }

        .topic-input {
          flex: 1;
          font-size: 16px;
          font-weight: 600;
          border: none;
          background: transparent;
          color: #2d3748;
          outline: none;
        }
        
        .edit-btn {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 14px;
        }

        /* Options */
        .option-group {
          margin-bottom: 24px;
        }

        .option-group label {
          display: block;
          font-weight: 600;
          margin-bottom: 12px;
          color: #4a5568;
          font-size: 15px;
        }
        
        /* Required Mark */
        .required-mark {
          color: #FF6B6B;
          font-weight: 700;
          margin-left: 4px;
        }
        
        .option-group.required input:invalid,
        .option-group.required textarea:invalid {
           /* border-color: #FFE5E5;  Browser default overrides often apply, handled via logic mostly */
        }

        .text-input, .text-area, .option-textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            font-size: 15px;
            color: #2d3748;
            outline: none;
            transition: border-color 0.2s;
        }
        
        .text-input:focus, .text-area:focus, .option-textarea:focus {
            border-color: #8B7DE8;
        }
        
        .hint {
          display: block;
          margin-top: 8px;
          font-size: 12px;
          color: #999;
          font-style: italic;
        }
        
        /* Duration Grid */
        .duration-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
            gap: 10px;
        }
        
        .duration-grid button {
            padding: 10px;
            border: 1px solid #E2E8F0;
            background: white;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            color: #4a5568;
            font-weight: 500;
            font-size: 14px;
        }
        
        .duration-grid button:hover {
            border-color: #8B7DE8;
            background: #F5F3FF;
            color: #6B5DD8;
        }
        
        .duration-grid button.active {
            border-color: #8B7DE8;
            background: #8B7DE8;
            color: white;
            font-weight: 600;
        }

        .button-group {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .button-group button {
          padding: 10px 20px;
          border: 1px solid #E2E8F0;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          color: #4a5568;
          font-weight: 500;
          font-size: 14px;
        }

        .button-group button:hover {
          border-color: #8B7DE8;
          background: #F5F3FF;
          color: #6B5DD8;
        }

        .button-group button.active {
          border-color: #8B7DE8;
          background: #8B7DE8;
          color: white;
          font-weight: 600;
          box-shadow: 0 4px 6px rgba(139, 125, 232, 0.2);
        }
        
        /* Checkbox Group */
        .checkbox-group {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
        }
        .checkbox-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            color: #4a5568;
            cursor: pointer;
        }

        /* Slider */
        .slider-container {
            padding: 10px 0;
        }
        .emotion-slider {
            width: 100%;
            accent-color: #8B7DE8;
        }
        .slider-labels {
            display: flex;
            justify-content: space-between;
            margin-top: 8px;
            font-size: 12px;
            color: #718096;
        }
        .current-value {
            font-weight: 700;
            color: #8B7DE8;
            font-size: 14px;
        }

        /* Structure Options */
        .structure-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }

        .structure-card {
          padding: 20px;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
        }

        .structure-card:hover {
          border-color: #8B7DE8;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }

        .structure-card.selected {
          border-color: #8B7DE8;
          background: #F5F3FF;
          box-shadow: 0 0 0 1px #8B7DE8 inset;
        }
        
        .structure-card h3 {
            font-size: 16px;
            font-weight: 700;
            color: #2d3748;
            margin: 0 0 8px 0;
        }
        
        .structure-card p {
            font-size: 14px;
            color: #718096;
            margin: 0;
            line-height: 1.4;
        }
        
        /* Preview Card */
        .preview-card {
            background: linear-gradient(135deg, #F5F3FF 0%, #E8F5E9 100%);
            border: 2px solid #8B7DE8;
            border-radius: 12px;
            padding: 20px;
            margin-top: 24px;
        }
        .preview-card h3 {
            margin: 0 0 16px 0;
            font-size: 16px;
            color: #553C9A;
        }
        .preview-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
        }
        .preview-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: white;
            border-radius: 6px;
            font-size: 14px;
        }
        .preview-item .label {
            font-weight: 600;
            color: #666;
            margin-right: 8px;
        }
        .preview-item .value {
            color: #8B7DE8;
            font-weight: 700;
            text-align: right;
            word-break: break-word;
        }

        /* Actions */
        .action-buttons {
          display: flex;
          justify-content: center;
          gap: 16px;
          padding: 24px;
          background: white;
          border-radius: 12px;
          margin-top: 24px;
          box-shadow: 0 -2px 10px rgba(0,0,0,0.02);
        }

        .btn-primary {
          padding: 14px 40px;
          background: linear-gradient(135deg, #8B7DE8 0%, #6B5DD8 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(139, 125, 232, 0.3);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(139, 125, 232, 0.4);
        }
        
        .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            background: #cbd5e0;
            box-shadow: none;
        }

        .btn-secondary {
          padding: 14px 32px;
          background: white;
          color: #8B7DE8;
          border: 2px solid #8B7DE8;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .btn-secondary:hover {
            background: #F5F3FF;
        }
      `}</style>
        </StudioLayout>
    );
}
