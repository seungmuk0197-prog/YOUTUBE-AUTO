import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import StudioLayout from '../components/StudioLayout';
import { fetchProject, updateProject } from '../lib/api';

const ScriptGeneration = () => {
    const router = useRouter();
    const projectIdFromQuery = Array.isArray(router.query.projectId)
        ? router.query.projectId[0]
        : router.query.projectId;
    const [blueprint, setBlueprint] = useState(null);
    const [generatedScript, setGeneratedScript] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);
    const [manualInputModalOpen, setManualInputModalOpen] = useState(false);
    const [manualInputText, setManualInputText] = useState('');
    const [isVariating, setIsVariating] = useState(false);
    const [variationModalOpen, setVariationModalOpen] = useState(false);
    const [variatedScript, setVariatedScript] = useState('');
    const [scriptStats, setScriptStats] = useState({
        charCount: 0,
        estimatedTime: 0,
        targetChars: 0,
        completionPercent: 0,
        feedback: { status: 'good', message: '', color: '#4CAF50' }
    });

    // 한국어 TTS 기준: 1초당 약 4-5자
    const calculateReadingTime = (text) => {
        const chars = text.replace(/\s/g, '').length; // 공백 제외
        const seconds = Math.ceil(chars / 4); // 1초당 4자
        return seconds;
    };

    // 목표 글자수 계산
    const getTargetCharCount = (duration) => {
        return duration * 4; // 정확한 목표
    };

    // 글자수 피드백
    const getCharCountFeedback = (current, target) => {
        const diff = current - target;
        const percentage = (current / target) * 100;

        if (percentage < 70) {
            return {
                status: 'short',
                message: `너무 짧습니다. 약 ${Math.abs(diff)}자 추가 필요`,
                color: '#FF9800'
            };
        } else if (percentage > 120) {
            return {
                status: 'long',
                message: `너무 깁니다. 약 ${diff}자 줄이기 권장`,
                color: '#FF6B6B'
            };
        } else {
            return {
                status: 'good',
                message: '적절한 길이입니다',
                color: '#4CAF50'
            };
        }
    };

    const updateScriptStats = (text, duration) => {
        const charCount = text.replace(/\s/g, '').length;
        const estimatedTime = calculateReadingTime(text);
        const targetChars = getTargetCharCount(duration);
        const completionPercent = (charCount / targetChars) * 100;
        const feedback = getCharCountFeedback(charCount, targetChars);

        setScriptStats({
            charCount,
            estimatedTime,
            targetChars,
            completionPercent,
            feedback
        });
    };

    const validateBlueprint = (blueprint) => {
        // 주제와 영상길이만 필수
        if (!blueprint || !blueprint.topic || !blueprint.topic.trim()) {
            console.error('Missing required field: topic');
            return false;
        }

        if (!blueprint.length || blueprint.length <= 0) {
            console.error('Missing required field: length');
            return false;
        }

        return true;
    };

    useEffect(() => {
        const projectId = projectIdFromQuery;

        async function loadData() {
            if (projectId) {
                // Backend Mode
                try {
                    const project = await fetchProject(projectId);
                    if (!project) {
                        alert('프로젝트를 찾을 수 없습니다.');
                        router.push('/project');
                        return;
                    }

                    // Blueprint 로드 (없으면 "3. 대본생성부터 시작" 흐름: 직접 입력용 최소 blueprint)
                    const isDirectScriptStart = !project.blueprint;
                    const rawBp = project.blueprint
                        ? (typeof project.blueprint === 'string' ? JSON.parse(project.blueprint) : project.blueprint)
                        : { topic: '직접 입력', length: 60 };

                    if (rawBp && (rawBp.topic || isDirectScriptStart)) {
                        const normalizedBp = {
                            ...rawBp,
                            topic: rawBp.topic || '직접 입력',
                            length: rawBp.length || 60,
                            tone: rawBp.tone || 'casual',
                            coreMessage: rawBp.coreMessage || `${rawBp.topic}에 대한 핵심 정보를 전달합니다`,
                            viewerPainPoint: rawBp.viewerPainPoint || `${rawBp.topic}에 대해 궁금한 분들`,
                            targetAudience: rawBp.targetAudience || 'general',
                            style: rawBp.style || 'shorts',
                            scriptStructure: rawBp.scriptStructure || 'hook',
                            hookType: rawBp.hookType || ['question'],
                            emotionIntensity: rawBp.emotionIntensity || 3,
                            additionalRequests: rawBp.additionalRequests || ''
                        };
                        setBlueprint(normalizedBp);

                        if (project.script && project.script.trim()) {
                            setGeneratedScript(project.script);
                            updateScriptStats(project.script, normalizedBp.length);
                        } else if (normalizedBp.topic === '직접 입력' || isDirectScriptStart) {
                            // 직접 입력 흐름: AI 자동 생성 없이 빈 대본으로 시작 (대본 직접 입력 사용)
                            setGeneratedScript('');
                            updateScriptStats('', normalizedBp.length);
                            if (isDirectScriptStart) {
                                updateProject(projectId, { blueprint: normalizedBp }).catch(() => {});
                            }
                        } else {
                            generateScript(normalizedBp);
                        }
                    } else {
                        alert('대본 기획 데이터가 없습니다. 기획 단계로 이동합니다.');
                        router.push(`/script-planning?projectId=${projectId}`);
                    }
                } catch (e) {
                    console.error("Failed to load project", e);
                }
            } else {
                // Legacy LocalStorage Mode
                const savedBlueprint = localStorage.getItem('step2Blueprint');
                if (!savedBlueprint) {
                    // alert('대본 기획 정보가 없습니다. 이전 단계로 돌아갑니다.');
                    // router.push('/script-planning');
                    return;
                }
                try {
                    const data = JSON.parse(savedBlueprint);
                    if (!validateBlueprint(data)) {
                        alert('대본 기획 정보가 불완전합니다. 이전 단계로 돌아갑니다.');
                        router.push('/script-planning');
                        return;
                    }
                    setBlueprint(data);
                    const savedScript = localStorage.getItem('generatedScript');
                    if (savedScript) {
                        setGeneratedScript(savedScript);
                        updateScriptStats(savedScript, data.length);
                    } else {
                        generateScript(data);
                    }
                } catch (e) {
                    console.error("Failed to load blueprint", e);
                    router.push('/script-planning');
                }
            }
        }

        if (router.isReady) {
            loadData();
        }
    }, [router.isReady, projectIdFromQuery]);

    const createEnhancedPrompt = (blueprint) => {
        // 기본값 설정
        const tone = blueprint.tone || 'casual';
        const coreMessage = blueprint.coreMessage || `${blueprint.topic}에 대한 핵심 정보를 전달합니다`;
        const viewerPainPoint = blueprint.viewerPainPoint || `${blueprint.topic}에 대해 궁금한 분들`;
        const targetAudience = blueprint.targetAudience || 'general';
        const style = blueprint.style || 'shorts';
        const scriptStructure = blueprint.scriptStructure || 'hook';
        const hookType = blueprint.hookType || ['question'];
        const emotionIntensity = blueprint.emotionIntensity || 3;
        const additionalRequests = blueprint.additionalRequests || '';

        // 길이별 단어 수 계산 (한국어 기준: 1초당 약 4-5자)
        const targetCharCount = blueprint.length * 4.5;

        // 톤 상세 설명
        const toneGuide = {
            humor: '재치있고 유머러스한 표현 사용. 이모티콘이나 재미있는 비유 활용',
            serious: '진지하고 신뢰감 있는 톤. 전문적이고 명확한 표현',
            educational: '교육적이고 설명적인 톤. 단계별로 명확하게 설명',
            casual: '친근하고 편안한 말투. 반말 또는 존댓말 혼용 자연스럽게'
        };

        // 구조 상세 가이드
        const structureGuide = {
            hook: `
1부 (처음 3초): 강력한 훅 - ${hookType.join(', ')} 활용
2부 (중간): 핵심 내용 전달 - "${coreMessage}"
3부 (마지막): 명확한 CTA와 정리`,
            story: `
1부: 문제 상황 제시 - "${viewerPainPoint}"
2부: 해결 과정 스토리
3부: 결과와 교훈`,
            list: `
도입: 주목 끌기
본론: 항목별 설명 (3-5가지)
결론: 핵심 요약`
        };

        return `
당신은 한국 유튜브 쇼츠 전문 대본 작가입니다.
다음 조건을 **정확히** 지켜서 대본을 작성하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 절대 준수 사항
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 총 ${blueprint.length}초 분량 (약 ${Math.round(targetCharCount)}자)
2. 이 메시지를 반드시 포함: "${coreMessage}"
3. 자연스러운 구어체로 작성 (읽는 대본이 아니라 말하는 대본)
4. 첫 문장은 3초 안에 끝나야 함

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 주제 및 목적
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
주제: ${blueprint.topic}
해결할 문제: ${viewerPainPoint}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎭 톤앤매너
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${toneGuide[tone]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 타겟 청중
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${targetAudience === 'beginner' ? '완전 초보자도 이해할 수 있게 쉽게' :
                targetAudience === 'intermediate' ? '어느 정도 아는 사람 대상으로' :
                    targetAudience === 'expert' ? '전문 용어 사용 가능, 깊이 있게' :
                        '누구나 이해할 수 있게'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💥 감정 강도: ${emotionIntensity}/5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${emotionIntensity >= 4
                ? '강렬하고 임팩트 있게! 감탄사, 강조 표현 적극 사용'
                : emotionIntensity >= 3
                    ? '적당히 감정을 담아서, 흥미롭게'
                    : '차분하고 신뢰감 있게'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📐 대본 구조
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${structureGuide[scriptStructure]}

${hookType && hookType.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎣 도입 장치 활용
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${hookType.map(hook => {
                        const hookGuides = {
                            statistics: '충격적인 통계나 숫자로 시작 (예: "90%의 사람들이...")',
                            shocking: '놀라운 사실로 시작 (예: "여러분은 절대 모를 거예요...")',
                            empathy: '공감 가는 상황 제시 (예: "이런 경험 있으신가요?")',
                            question: '질문으로 시작 (예: "혹시 ~해보신 적 있나요?")'
                        };
                        return hookGuides[hook] || hook;
                    }).join('\n')}
` : ''}

${additionalRequests ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 추가 요청사항
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${additionalRequests}
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 작성 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 문장은 짧게 (한 문장 15자 내외)
2. 어려운 단어 피하기
3. "~입니다", "~습니다" 같은 딱딱한 표현보다 자연스러운 구어체
4. 마지막에 행동 유도 포함 (좋아요, 구독, 댓글 등)
5. 이모티콘이나 특수문자는 사용하지 말 것 (순수 텍스트만)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 대본 작성 시작
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
아래에 ${blueprint.length}초 분량의 대본을 작성하세요.
[시작]과 [끝] 사이에만 대본을 작성하고, 다른 설명은 넣지 마세요.

[시작]

`;
    };

    const parseAIResponse = (rawResponse) => {
        // [시작]과 [끝] 사이만 추출
        const startMarker = '[시작]';
        const endMarker = '[끝]';

        let script = rawResponse;

        if (rawResponse.includes(startMarker)) {
            const startIndex = rawResponse.indexOf(startMarker) + startMarker.length;
            const endIndex = rawResponse.includes(endMarker) ? rawResponse.indexOf(endMarker) : rawResponse.length;

            script = rawResponse.substring(startIndex, endIndex);
        }

        // 불필요한 마크다운 제거
        script = script
            .replace(/```[\s\S]*?```/g, '') // 코드 블록 제거
            .replace(/\*\*/g, '') // 볼드 제거
            .replace(/\*/g, '') // 이탤릭 제거
            .replace(/#{1,6}\s/g, '') // 헤더 제거
            .replace(/\[시작\]/g, '') // [시작] 마커 제거
            .replace(/\[끝\]/g, '') // [끝] 마커 제거
            .replace(/\[시작\]/gi, '') // 대소문자 구분 없이 [시작] 제거
            .replace(/\[끝\]/gi, '') // 대소문자 구분 없이 [끝] 제거
            .replace(/^\s*\[끝\]\s*$/gm, '') // 줄 전체가 [끝]인 경우 제거
            .replace(/^\s*\[시작\]\s*$/gm, '') // 줄 전체가 [시작]인 경우 제거
            .trim();

        return script;
    };

    const generateScript = async (data) => {
        setIsGenerating(true);
        setGenerationProgress(10);

        // Generate a random runId for cache busting
        const runId = Date.now().toString();
        console.log("Starting script generation. runId:", runId);

        try {
            // 프롬프트 생성
            const prompt = createEnhancedPrompt(data);
            console.log("Enhanced Prompt length:", prompt.length);
            setGenerationProgress(20);

            // API 호출 (Real OpenAI)
            const response = await fetch(`/api/script?nonce=${runId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store'
                },
                body: JSON.stringify({ prompt, runId }),
                cache: 'no-store'
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Error (${response.status}): ${errText}`);
            }

            setGenerationProgress(70);

            const result = await response.json();
            const rawResponse = result.script;

            if (!rawResponse || rawResponse.trim() === '') {
                throw new Error('서버에서 빈 응답을 받았습니다.');
            }

            // 파싱
            const script = parseAIResponse(rawResponse);
            setGenerationProgress(90);

            if (!script || script.trim() === '') {
                throw new Error('대본이 생성되지 않았습니다. 다시 시도해주세요.');
            }

            setGeneratedScript(script);
            updateScriptStats(script, data.length);

            // 백엔드에 저장 (projectId가 있는 경우)
            const projectId = projectIdFromQuery;
            if (projectId) {
                try {
                    await updateProject(projectId, { script });
                    console.log('Script saved to project:', projectId);
                } catch (saveError) {
                    console.error('Failed to save script to project:', saveError);
                    // 저장 실패해도 계속 진행
                }
            }

            // LocalStorage에도 저장 (백업)
            localStorage.setItem('generatedScript', script);
            setGenerationProgress(100);

        } catch (error) {
            console.error("Script generation failed:", error);
            // 오류가 나도 그때까지 작업한 대본은 저장해 복구 가능하게
            const pid = router.query.projectId;
            if (pid && generatedScript && String(generatedScript).trim()) {
                try { await updateProject(pid, { script: generatedScript }); } catch (e) { console.error('Save on error failed:', e); }
            }
            alert("대본 생성 중 오류가 발생했습니다: " + error.message);
            setGenerationProgress(0);
        } finally {
            setIsGenerating(false);
        }
    };



    const handleScriptChange = (e) => {
        const text = e.target.value;
        setGeneratedScript(text);

        // 실시간 통계 업데이트
        if (blueprint) {
            updateScriptStats(text, blueprint.length);
        }
    };

    const handleRegenerate = () => {
        if (confirm('대본을 다시 생성하시겠습니까? 기존 내용은 사라집니다.')) {
            generateScript(blueprint);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            alert('대본이 복사되었습니다.');
        });
    };

    const handleProceedToJSON = async () => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📤 Proceeding to JSON Generation');
        console.log('━━━━━━━━━━━━━━━━━━━━━━');

        if (!generatedScript || generatedScript.trim() === '') {
            alert('생성된 대본이 없습니다.');
            return;
        }

        const projectId = projectIdFromQuery;

        if (projectId) {
            try {
                // 백엔드 저장
                await updateProject(projectId, {
                    script: generatedScript,
                    // 진행상태 업데이트 등도 필요하면 추가
                });
                console.log('✓ Script saved to backend');
                router.push(`/json-generation?projectId=${projectId}`);
            } catch (e) {
                console.error("Failed to save script to project", e);
                alert("프로젝트 저장에 실패했습니다.");
            }
        } else {
            // LocalStorage 저장
            localStorage.setItem('generatedScript', generatedScript);
            console.log('✓ Script saved:', generatedScript.substring(0, 100));
            if (blueprint) {
                const blueprintStr = JSON.stringify(blueprint);
                localStorage.setItem('step2Blueprint', blueprintStr);
            }
            router.push('/json-generation');
        }
    };

    const handleSaveDraft = () => {
        localStorage.setItem('generatedScript', generatedScript);
        alert('임시 저장되었습니다.');
    };

    const handleOpenManualInput = () => {
        setManualInputText(generatedScript); // 현재 대본을 기본값으로 설정
        setManualInputModalOpen(true);
    };

    const handleCloseManualInput = () => {
        setManualInputModalOpen(false);
        setManualInputText('');
    };

    const handleApplyManualInput = () => {
        if (!manualInputText.trim()) {
            alert('대본을 입력해주세요.');
            return;
        }
        setGeneratedScript(manualInputText.trim());
        if (blueprint) {
            updateScriptStats(manualInputText.trim(), blueprint.length);
        }
        handleCloseManualInput();
    };

    const handleVariation = async () => {
        if (!generatedScript || !generatedScript.trim()) {
            alert('변형할 대본이 없습니다. 먼저 대본을 생성하거나 입력해주세요.');
            return;
        }

        setIsVariating(true);
        setVariationModalOpen(true);
        setVariatedScript('');

        try {
            const variationPrompt = `당신은 창의적인 대본 변형 전문가입니다. 다음 대본을 저작권에 위배되지 않게 유사하지만 더 재미있고 흥미롭게 변형해주세요.

**원본 대본:**
${generatedScript}

**변형 요구사항:**
1. 핵심 메시지와 구조는 유사하게 유지
2. 표현과 문장을 창의적으로 재구성하여 더 재미있게 만들기
3. 저작권 문제가 없도록 완전히 새로운 표현으로 작성
4. 원본과 같은 톤과 스타일 유지
5. 길이는 원본과 비슷하게 유지

변형된 대본만 작성하고, [시작]과 [끝] 마커 없이 순수 텍스트만 반환해주세요.`;

            const runId = Date.now().toString();
            const response = await fetch(`/api/script?nonce=${runId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store'
                },
                body: JSON.stringify({ prompt: variationPrompt, runId }),
                cache: 'no-store'
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Error (${response.status}): ${errText}`);
            }

            const result = await response.json();
            const rawResponse = result.script || '';

            // 마커 제거 및 정리
            let variated = rawResponse
                .replace(/\[시작\]/gi, '')
                .replace(/\[끝\]/gi, '')
                .replace(/```[\s\S]*?```/g, '')
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/#{1,6}\s/g, '')
                .trim();

            if (!variated || variated.trim() === '') {
                throw new Error('변형된 대본이 생성되지 않았습니다.');
            }

            setVariatedScript(variated);
        } catch (error) {
            console.error("Script variation failed:", error);
            alert("대본 변형 중 오류가 발생했습니다: " + error.message);
            setVariationModalOpen(false);
        } finally {
            setIsVariating(false);
        }
    };

    const handleApplyVariation = () => {
        if (!variatedScript.trim()) {
            alert('변형된 대본이 없습니다.');
            return;
        }
        setGeneratedScript(variatedScript.trim());
        if (blueprint) {
            updateScriptStats(variatedScript.trim(), blueprint.length);
        }
        setVariationModalOpen(false);
        setVariatedScript('');
    };

    const handleCloseVariation = () => {
        setVariationModalOpen(false);
        setVariatedScript('');
        setIsVariating(false);
    };

    const getToneLabel = (tone) => {
        const labels = { humor: '😄 유머러스', serious: '🎯 진지함', educational: '📚 교육적', casual: '💬 캐주얼' };
        return labels[tone] || tone;
    };
    const getAudienceLabel = (audience) => {
        const labels = { beginner: '🌱 초보자', intermediate: '🎓 중급자', expert: '🏆 전문가', general: '👥 일반 대중' };
        return labels[audience] || audience;
    };
    const getStyleLabel = (style) => {
        const labels = { shorts: '📱 쇼츠', tutorial: '🎬 튜토리얼', vlog: '📹 브이로그', review: '⭐ 리뷰' };
        return labels[style] || style;
    };
    const getHookLabel = (hook) => {
        const labels = { statistics: '📊 통계', shocking: '⚡ 충격', empathy: '💭 공감', question: '❓ 질문' };
        return labels[hook] || hook;
    };

    return (
        <StudioLayout
            title="AI 대본 생성 - HANRA STUDIO"
            activeStep="script-gen"
            projectId={projectIdFromQuery}
        >
            <Head>
                <title>AI 대본 생성 - HANRA STUDIO</title>
            </Head>

            <div className="script-generation-container">
                {/* 헤더 */}
                <header className="generation-header">
                    <button onClick={() => router.push(router.query.projectId ? `/script-planning?projectId=${router.query.projectId}` : '/script-planning')} className="back-btn">
                        ← 뒤로
                    </button>
                    <h1>3. 대본 생성</h1>
                    <span className="step-badge">단계 3/6</span>
                    {projectIdFromQuery && (
                        <button
                            type="button"
                            className="header-next-step"
                            onClick={handleProceedToJSON}
                            disabled={!generatedScript || !generatedScript.trim()}
                        >
                            4-1. JSON 생성으로 →
                        </button>
                    )}
                </header>

                <div className="generation-content">

                    {/* 좌측: 설정 요약 (개선됨) */}
                    <aside className="settings-summary">
                        <div className="summary-header">
                            <h2>📋 설정 요약</h2>
                            <button
                                className="btn-mini"
                                onClick={() => router.push(router.query.projectId ? `/script-planning?projectId=${router.query.projectId}` : '/script-planning')}
                            >
                                수정
                            </button>
                        </div>

                        {/* 핵심 정보 강조 */}
                        <div className="core-info">
                            <div className="info-card highlight">
                                <span className="icon">🎯</span>
                                <div>
                                    <label>핵심 메시지</label>
                                    <p>{blueprint?.coreMessage}</p>
                                </div>
                            </div>

                            <div className="info-card">
                                <span className="icon">😓</span>
                                <div>
                                    <label>해결할 문제</label>
                                    <p>{blueprint?.viewerPainPoint}</p>
                                </div>
                            </div>
                        </div>

                        {/* 기본 설정 */}
                        <div className="settings-grid">
                            <div className="setting-item">
                                <span className="label">⏱️ 길이</span>
                                <span className="value">{blueprint?.length < 60 ? `${blueprint?.length} 초` : `${blueprint?.length / 60} 분`}</span>
                            </div>
                            <div className="setting-item">
                                <span className="label">🎭 톤</span>
                                <span className="value">{getToneLabel(blueprint?.tone)}</span>
                            </div>
                            <div className="setting-item">
                                <span className="label">👥 타겟</span>
                                <span className="value">{getAudienceLabel(blueprint?.targetAudience)}</span>
                            </div>
                            <div className="setting-item">
                                <span className="label">📱 스타일</span>
                                <span className="value">{getStyleLabel(blueprint?.style)}</span>
                            </div>
                            <div className="setting-item">
                                <span className="label">💥 감정 강도</span>
                                <div className="emotion-indicator">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <span
                                            key={i}
                                            className={`dot ${i <= blueprint?.emotionIntensity ? 'active' : ''} `}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 도입 장치 */}
                        {blueprint?.hookType?.length > 0 && (
                            <div className="hooks-section">
                                <label>🎣 도입 장치</label>
                                <div className="hooks-list">
                                    {blueprint.hookType.map(hook => (
                                        <span key={hook} className="hook-badge">
                                            {getHookLabel(hook)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </aside>

                    {/* 우측: 대본 영역 (개선됨) */}
                    <main className="script-editor-area">

                        {isGenerating ? (
                            <div className="generating-view">
                                <div className="generation-animation">
                                    <div className="pulse-circle"></div>
                                    <div className="ai-icon">✨</div>
                                </div>

                                <h2>AI가 맞춤 대본을 생성하고 있습니다</h2>

                                <div className="progress-container">
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{ width: `${generationProgress}% ` }}
                                        >
                                            <span className="progress-text">{generationProgress}%</span>
                                        </div>
                                    </div>

                                    <div className="generation-steps">
                                        <div className={`step ${generationProgress >= 20 ? 'active' : ''} `}>
                                            1. 전략 분석 중...
                                        </div>
                                        <div className={`step ${generationProgress >= 40 ? 'active' : ''} `}>
                                            2. 구조 설계 중...
                                        </div>
                                        <div className={`step ${generationProgress >= 60 ? 'active' : ''} `}>
                                            3. 대본 작성 중...
                                        </div>
                                        <div className={`step ${generationProgress >= 80 ? 'active' : ''} `}>
                                            4. 품질 검증 중...
                                        </div>
                                        <div className={`step ${generationProgress >= 100 ? 'active' : ''} `}>
                                            ✅ 완료!
                                        </div>
                                    </div>
                                </div>

                                <div className="generation-tips">
                                    <p>💡 생성된 대본은 자유롭게 수정할 수 있습니다</p>
                                    <p>⏱️ 평균 생성 시간: 10-15초</p>
                                </div>
                            </div>
                        ) : (
                            <div className="editor-view">

                                {/* 에디터 헤더 */}
                                <div className="editor-toolbar">
                                    <div className="toolbar-left">
                                        <h2>생성된 대본</h2>
                                        <span className="generation-status">
                                            ✓ 생성 완료
                                        </span>
                                    </div>
                                    <div className="toolbar-right">
                                        <button
                                            className="btn-tool"
                                            onClick={handleOpenManualInput}
                                            title="대본 직접 입력"
                                        >
                                            ✏️ 대본 직접 입력
                                        </button>
                                        <button
                                            className="btn-tool"
                                            onClick={handleVariation}
                                            disabled={!generatedScript || !generatedScript.trim() || isVariating}
                                            title="대본을 유사하지만 더 재미있게 변형"
                                            style={{
                                                opacity: (!generatedScript || !generatedScript.trim() || isVariating) ? 0.5 : 1,
                                                cursor: (!generatedScript || !generatedScript.trim() || isVariating) ? 'not-allowed' : 'pointer',
                                            }}
                                        >
                                            {isVariating ? '🔄 변형 중...' : '✨ 유사 변형'}
                                        </button>
                                        <button
                                            className="btn-tool"
                                            onClick={() => copyToClipboard(generatedScript)}
                                            title="복사"
                                        >
                                            📋 복사
                                        </button>
                                        <button
                                            className="btn-tool"
                                            onClick={handleRegenerate}
                                            title="재생성"
                                        >
                                            🔄 재생성
                                        </button>
                                    </div>
                                </div>

                                {/* 대본 텍스트 영역 */}
                                <textarea
                                    className="script-textarea"
                                    value={generatedScript}
                                    onChange={handleScriptChange}
                                    placeholder="대본이 생성됩니다..."
                                    spellCheck={false}
                                />

                                {/* 실시간 통계 */}
                                <div className="script-analytics">
                                    <div className="analytics-grid">
                                        <div className="stat-card">
                                            <span className="stat-icon">📝</span>
                                            <div className="stat-content">
                                                <span className="stat-value">{scriptStats.charCount}</span>
                                                <span className="stat-label">글자 수</span>
                                            </div>
                                        </div>

                                        <div className="stat-card">
                                            <span className="stat-icon">⏱️</span>
                                            <div className="stat-content">
                                                <span className="stat-value">{scriptStats.estimatedTime}초</span>
                                                <span className="stat-label">예상 시간</span>
                                            </div>
                                        </div>

                                        <div className="stat-card">
                                            <span className="stat-icon">🎯</span>
                                            <div className="stat-content">
                                                <span className="stat-value">{scriptStats.targetChars}</span>
                                                <span className="stat-label">목표 글자</span>
                                            </div>
                                        </div>

                                        <div className={`stat - card status - ${scriptStats.feedback.status} `}>
                                            <span className="stat-icon">
                                                {scriptStats.feedback.status === 'good' ? '✅' :
                                                    scriptStats.feedback.status === 'short' ? '⚠️' : '🔴'}
                                            </span>
                                            <div className="stat-content">
                                                <span className="stat-label">{scriptStats.feedback.message}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 진행률 바 */}
                                    <div className="completion-bar">
                                        <div className="bar-label">
                                            <span>길이 적절성</span>
                                            <span>{Math.round(scriptStats.completionPercent)}%</span>
                                        </div>
                                        <div className="bar-track">
                                            <div
                                                className="bar-fill"
                                                style={{
                                                    width: `${Math.min(scriptStats.completionPercent, 100)}% `,
                                                    background: scriptStats.feedback.color
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* 하단 액션 버튼 */}
                                <div className="editor-actions">
                                    <button
                                        className="btn-back"
                                        onClick={() => router.push(projectIdFromQuery ? `/script-planning?projectId=${projectIdFromQuery}` : '/script-planning')}
                                    >
                                        ← 이전 단계
                                    </button>

                                    <div className="action-group">
                                        <button
                                            className="btn-save"
                                            onClick={handleSaveDraft}
                                        >
                                            💾 임시 저장
                                        </button>
                                        <button
                                            className="btn-next"
                                            onClick={handleProceedToJSON}
                                            disabled={!generatedScript || !generatedScript.trim()}
                                        >
                                            다음 단계: JSON 생성 →
                                        </button>
                                    </div>
                                </div>

                            </div>
                        )}

                    </main>
                </div>

                {/* 대본 직접 입력 모달 */}
                {manualInputModalOpen && (
                    <div
                        role="dialog"
                        aria-modal="true"
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10000,
                            padding: '24px',
                        }}
                        onClick={handleCloseManualInput}
                    >
                        <div
                            style={{
                                background: '#fff',
                                borderRadius: '16px',
                                padding: '32px',
                                maxWidth: '800px',
                                width: '100%',
                                maxHeight: '90vh',
                                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{
                                    fontSize: '20px',
                                    fontWeight: 700,
                                    color: '#1a202c',
                                    margin: '0 0 8px 0',
                                }}>
                                    ✏️ 대본 직접 입력
                                </h3>
                                <p style={{
                                    fontSize: '14px',
                                    color: '#718096',
                                    margin: 0,
                                }}>
                                    대본을 직접 입력하거나 붙여넣어주세요.
                                </p>
                            </div>

                            <textarea
                                value={manualInputText}
                                onChange={(e) => setManualInputText(e.target.value)}
                                placeholder="대본을 입력하거나 붙여넣어주세요..."
                                style={{
                                    width: '100%',
                                    flex: 1,
                                    minHeight: '400px',
                                    padding: '16px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    fontSize: '15px',
                                    lineHeight: '1.8',
                                    fontFamily: 'Pretendard, sans-serif',
                                    resize: 'vertical',
                                    color: '#2d3748',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    wordWrap: 'break-word',
                                    overflowWrap: 'break-word',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'pre-wrap',
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = '#8B7DE8';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                }}
                            />

                            <div style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '12px',
                                marginTop: '20px',
                            }}>
                                <button
                                    onClick={handleCloseManualInput}
                                    style={{
                                        padding: '12px 24px',
                                        background: 'white',
                                        color: '#4a5568',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#f7fafc';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'white';
                                    }}
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleApplyManualInput}
                                    style={{
                                        padding: '12px 24px',
                                        background: 'linear-gradient(135deg, #8B7DE8 0%, #6B5DD8 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(139, 125, 232, 0.3)',
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 125, 232, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 125, 232, 0.3)';
                                    }}
                                >
                                    적용하기
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 유사 변형 모달 */}
                {variationModalOpen && (
                    <div
                        role="dialog"
                        aria-modal="true"
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10001,
                            padding: '24px',
                        }}
                        onClick={handleCloseVariation}
                    >
                        <div
                            style={{
                                background: '#fff',
                                borderRadius: '16px',
                                padding: '32px',
                                maxWidth: '900px',
                                width: '100%',
                                maxHeight: '90vh',
                                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{
                                    fontSize: '20px',
                                    fontWeight: 700,
                                    color: '#1a202c',
                                    margin: '0 0 8px 0',
                                }}>
                                    ✨ 유사 변형
                                </h3>
                                <p style={{
                                    fontSize: '14px',
                                    color: '#718096',
                                    margin: 0,
                                }}>
                                    대본을 저작권에 위배되지 않게 유사하지만 더 재미있게 변형합니다.
                                </p>
                            </div>

                            {isVariating ? (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '60px 20px',
                                    minHeight: '400px',
                                }}>
                                    <div 
                                        className="variation-pulse-animation"
                                        style={{
                                            fontSize: '48px',
                                            marginBottom: '20px',
                                        }}
                                    >
                                        ✨
                                    </div>
                                    <h4 style={{
                                        fontSize: '18px',
                                        fontWeight: 600,
                                        color: '#2d3748',
                                        marginBottom: '12px',
                                    }}>
                                        대본을 변형하고 있습니다...
                                    </h4>
                                    <p style={{
                                        fontSize: '14px',
                                        color: '#718096',
                                    }}>
                                        더 재미있고 창의적인 표현으로 재구성 중입니다.
                                    </p>
                                </div>
                            ) : variatedScript ? (
                                <>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '16px',
                                        marginBottom: '20px',
                                        flex: 1,
                                        minHeight: '400px',
                                    }}>
                                        {/* 원본 대본 */}
                                        <div>
                                            <label style={{
                                                display: 'block',
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                color: '#4a5568',
                                                marginBottom: '8px',
                                            }}>
                                                원본 대본
                                            </label>
                                            <div style={{
                                                width: '100%',
                                                height: '400px',
                                                padding: '16px',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                lineHeight: '1.8',
                                                overflowY: 'auto',
                                                background: '#f7fafc',
                                                color: '#4a5568',
                                                wordWrap: 'break-word',
                                                overflowWrap: 'break-word',
                                                whiteSpace: 'pre-wrap',
                                            }}>
                                                {generatedScript}
                                            </div>
                                        </div>

                                        {/* 변형된 대본 */}
                                        <div>
                                            <label style={{
                                                display: 'block',
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                color: '#4a5568',
                                                marginBottom: '8px',
                                            }}>
                                                변형된 대본
                                            </label>
                                            <textarea
                                                value={variatedScript}
                                                onChange={(e) => setVariatedScript(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    height: '400px',
                                                    padding: '16px',
                                                    border: '1px solid #8B7DE8',
                                                    borderRadius: '8px',
                                                    fontSize: '14px',
                                                    lineHeight: '1.8',
                                                    fontFamily: 'Pretendard, sans-serif',
                                                    resize: 'none',
                                                    color: '#2d3748',
                                                    outline: 'none',
                                                    boxSizing: 'border-box',
                                                    wordWrap: 'break-word',
                                                    overflowWrap: 'break-word',
                                                    wordBreak: 'break-word',
                                                    whiteSpace: 'pre-wrap',
                                                }}
                                                placeholder="변형된 대본이 여기에 표시됩니다..."
                                            />
                                        </div>
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        gap: '12px',
                                        marginTop: '20px',
                                    }}>
                                        <button
                                            onClick={handleCloseVariation}
                                            style={{
                                                padding: '12px 24px',
                                                background: 'white',
                                                color: '#4a5568',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = '#f7fafc';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'white';
                                            }}
                                        >
                                            취소
                                        </button>
                                        <button
                                            onClick={handleVariation}
                                            style={{
                                                padding: '12px 24px',
                                                background: 'white',
                                                color: '#8B7DE8',
                                                border: '1px solid #8B7DE8',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = '#F5F3FF';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'white';
                                            }}
                                        >
                                            🔄 다시 변형
                                        </button>
                                        <button
                                            onClick={handleApplyVariation}
                                            style={{
                                                padding: '12px 24px',
                                                background: 'linear-gradient(135deg, #8B7DE8 0%, #6B5DD8 100%)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                boxShadow: '0 4px 12px rgba(139, 125, 232, 0.3)',
                                                transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 125, 232, 0.4)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 125, 232, 0.3)';
                                            }}
                                        >
                                            적용하기
                                        </button>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
        @keyframes variation-pulse-animation {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.1); }
        }
        
        .variation-pulse-animation {
            animation: variation-pulse-animation 2s ease-in-out infinite;
        }
        
        .script-generation-container {
            min-height: 100vh;
        }

        .generation-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            background: white;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
            border-radius: 12px;
            margin-bottom: 24px;
        }
        
        .generation-header h1 {
            font-size: 20px;
            font-weight: 700;
            color: #2d3748;
            margin: 0;
        }
        
        .step-badge {
            background: #EDF2F7;
            color: #4A5568;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .back-btn {
            background: none;
            border: none;
            font-size: 16px;
            color: #718096;
            cursor: pointer;
            font-weight: 600;
        }

        .header-next-step {
            margin-left: auto;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 600;
            color: white;
            background: #8B7DE8;
            border: none;
            border-radius: 8px;
            cursor: pointer;
        }
        .header-next-step:hover:not(:disabled) {
            background: #7B6AD6;
        }
        .header-next-step:disabled {
            background: #CBD5E0;
            cursor: not-allowed;
        }

        .generation-content {
            display: grid;
            grid-template-columns: 320px 1fr;
            gap: 24px;
            padding-bottom: 40px;
            max-width: 100%;
            box-sizing: border-box;
            overflow-x: hidden;
        }

        /* 좌측 설정 요약 */
        .settings-summary {
            background: white;
            border-radius: 12px;
            padding: 20px;
            height: fit-content;
            position: sticky;
            top: 24px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .summary-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .summary-header h2 {
            font-size: 16px;
            font-weight: 700;
            color: #2d3748;
            margin: 0;
        }
        
        .btn-mini {
            padding: 4px 10px;
            font-size: 11px;
            background: #EDF2F7;
            border: none;
            border-radius: 4px;
            color: #718096;
            cursor: pointer;
        }

        .core-info {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 24px;
        }

        .info-card {
            background: #F7FAFC;
            padding: 12px;
            border-radius: 8px;
            display: flex;
            gap: 10px;
        }
        
        .info-card.highlight {
            background: #F5F3FF;
            border: 1px solid #E9D8FD;
        }
        
        .info-card.icon {
            font-size: 18px;
        }
        
        .info-card label {
            display: block;
            font-size: 11px;
            color: #718096;
            margin-bottom: 4px;
            font-weight: 600;
        }
        
        .info-card p {
            margin: 0;
            font-size: 13px;
            line-height: 1.4;
            color: #2d3748;
            font-weight: 500;
        }

        .settings-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 24px;
        }

        .setting-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .setting-item.label {
            font-size: 11px;
            color: #A0AEC0;
        }

        .setting-item.value {
            font-size: 13px;
            color: #4A5568;
            font-weight: 600;
        }

        .emotion-indicator {
            display: flex;
            gap: 4px;
        }
        
        .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #E2E8F0;
        }
        
        .dot.active {
            background: #FC8181;
        }
        
        .hooks-section {
            border-top: 1px solid #EDF2F7;
            padding-top: 16px;
        }
        
        .hooks-section label {
            display: block;
            font-size: 11px;
            color: #A0AEC0;
            margin-bottom: 8px;
        }
        
        .hooks-list {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        
        .hook-badge {
            font-size: 11px;
            padding: 4px 8px;
            background: #F0FFF4;
            color: #38A169;
            border: 1px solid #C6F6D5;
            border-radius: 12px;
        }

        /* 우측 에디터 영역 */
        .script-editor-area {
            background: white;
            border-radius: 12px;
            min-height: 600px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            max-width: 100%;
            box-sizing: border-box;
        }
        
        .generating-view {
            padding: 60px 40px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
        }
        
        .generation-animation {
            width: 80px;
            height: 80px;
            background: #E9D8FD;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 24px;
            position: relative;
        }
        
        .pulse-circle {
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            border: 2px solid #9F7AEA;
            animation: pulse 2s infinite;
        }
        
        .ai-icon {
            font-size: 32px;
        }

        @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            100% { transform: scale(1.5); opacity: 0; }
        }
        
        .generating-view h2 {
            font-size: 20px;
            color: #2d3748;
            margin-bottom: 32px;
        }
        
        .progress-container {
            width: 100%;
            max-width: 400px;
            margin-bottom: 40px;
        }
        
        .progress-bar {
            height: 12px;
            background: #EDF2F7;
            border-radius: 6px;
            overflow: hidden;
            margin-bottom: 16px;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #8B7DE8, #6B5DD8);
            transition: width 0.3s;
            display: flex;
            align-items: center;
            justify-content: flex-end;
        }
        
        .progress-text {
            color: white;
            font-size: 10px;
            font-weight: 700;
            padding-right: 6px;
        }
        
        .generation-steps {
            display: flex;
            justify-content: space-between;
        }
        
        .step {
            font-size: 11px;
            color: #CBD5E0;
            font-weight: 500;
        }
        
        .step.active {
            color: #8B7DE8;
            font-weight: 700;
        }
        
        .generation-tips {
            background: #FFFBEB;
            padding: 16px;
            border-radius: 8px;
            color: #B7791F;
            font-size: 13px;
        }
        .generation-tips p { margin: 4px 0; }

        /* 에디터 뷰 */
        .editor-view {
            padding: 0;
            display: flex;
            flex-direction: column;
            height: 100%;
            max-width: 100%;
            box-sizing: border-box;
            overflow: hidden;
        }
        
        .editor-toolbar {
            padding: 16px 24px;
            border-bottom: 1px solid #E2E8F0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #FAFAFA;
        }
        
        .toolbar-left h2 {
            font-size: 16px;
            font-weight: 700;
            color: #2d3748;
            margin: 0 0 4px 0;
        }
        
        .generation-status {
            font-size: 12px;
            color: #48BB78;
            font-weight: 500;
        }
        
        .toolbar-right {
            display: flex;
            gap: 8px;
        }
        
        .btn-tool {
            padding: 6px 12px;
            font-size: 13px;
            font-weight: 500;
            background: white;
            border: 1px solid #CBD5E0;
            border-radius: 6px;
            cursor: pointer;
            color: #4A5568;
            transition: all 0.2s;
        }
        
        .btn-tool:hover {
            background: #EDF2F7;
        }
        
        .script-textarea {
            width: 100%;
            height: 400px;
            padding: 24px;
            border: none;
            font-size: 15px;
            line-height: 1.8;
            font-family: 'Pretendard', sans-serif;
            resize: none;
            color: #2d3748;
            outline: none;
            box-sizing: border-box;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: break-word;
            white-space: pre-wrap;
            overflow-x: hidden;
            overflow-y: auto;
        }
        
        .script-analytics {
            padding: 16px 24px;
            background: #F8F9FA;
            border-top: 1px solid #E2E8F0;
        }
        
        .analytics-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 16px;
        }
        
        .stat-card {
            background: white;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #E2E8F0;
            display: flex;
            gap: 12px;
            align-items: center;
        }
        
        .stat-card.status-short { border-color: #FF9800; background: #FFF3E0; }
        .stat-card.status-long { border-color: #FF6B6B; background: #FFF5F5; }
        .stat-card.status-good { border-color: #4CAF50; background: #F0FFF4; }
        
        .stat-icon { font-size: 18px; }
        
        .stat-content {
            display: flex;
            flex-direction: column;
        }
        
        .stat-value { font-size: 15px; font-weight: 700; color: #2d3748; }
        .stat-label { font-size: 11px; color: #718096; }
        
        .completion-bar {
            background: white;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #E2E8F0;
        }
        
        .bar-label {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: 600;
            color: #4A5568;
            margin-bottom: 6px;
        }
        
        .bar-track {
            height: 8px;
            background: #EDF2F7;
            border-radius: 4px;
            overflow: hidden;
        }
        
        .bar-fill {
            height: 100%;
            transition: width 0.3s, background 0.3s;
        }
        
        .editor-actions {
            padding: 20px 24px;
            background: white;
            border-top: 1px solid #E2E8F0;
            display: flex;
            justify-content: space-between;
        }
        
        .action-group {
            display: flex;
            gap: 12px;
        }
        
        .btn-back {
            padding: 10px 20px;
            background: white;
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            color: #718096;
            font-weight: 600;
            cursor: pointer;
        }
        
        .btn-save {
            padding: 10px 20px;
            background: #EDF2F7;
            border: none;
            border-radius: 8px;
            color: #4A5568;
            font-weight: 600;
            cursor: pointer;
        }
        
        .btn-next {
            padding: 10px 24px;
            background: linear-gradient(135deg, #8B7DE8 0%, #6B5DD8 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 10px rgba(139, 125, 232, 0.3);
        }
        
        .btn-next:disabled {
            background: #cbd5e0;
            cursor: not-allowed;
            box-shadow: none;
        }
        .page-nav {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            padding: 12px 0;
        }
        .btn-nav {
            padding: 8px 16px;
            border: 1px solid #cbd5e0;
            background: #fff;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
        }
        .btn-nav.primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            border-color: transparent;
        }
            `}</style>
            <div className="page-nav">
                <button className="btn-nav" onClick={() => router.push(router.query.projectId ? `/script-planning?projectId=${router.query.projectId}` : '/script-planning')}>← 이전 페이지</button>
                <button className="btn-nav primary" onClick={() => router.push(router.query.projectId ? `/json-generation?projectId=${router.query.projectId}` : '/json-generation')}>다음 페이지 →</button>
            </div>
        </StudioLayout>
    );
};

export default ScriptGeneration;
