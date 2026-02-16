import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import StudioLayout from '../components/StudioLayout';
import { saveProjectData, loadProjectData, PROJECT_DATA_KEYS, migrateProjectData } from '../lib/projectStorage';
import { fetchProject } from '../lib/api';
import { clampAndLogPrompt } from '../lib/promptClamp';

// 이미지 스타일 정의
const IMAGE_STYLES = [
    { id: 'basic', name: '기본 설정', desc: '자연스럽고 기본 스타일', bg: 'linear-gradient(135deg, #e8f0fe 0%, #d4e4fc 100%)', color: '#1a3a5c' },
    { id: '50s-movie', name: '50년대 영화', desc: '테크니컬러, 편안한 조명', bg: 'linear-gradient(135deg, #f5e6d3 0%, #e8d5b7 100%)', color: '#5a3e1b' },
    { id: 'joseon-drama', name: '조선시대 사극', desc: '전통적 건축/의복, 자연광 활용', bg: 'linear-gradient(135deg, #f0e8d0 0%, #d4c9a8 100%)', color: '#4a3b1f' },
    { id: 'north-drama', name: '북국 드라마', desc: '영화 스케일, 장엄한 디자인과 구도', bg: 'linear-gradient(135deg, #d6e8f0 0%, #b8d4e3 100%)', color: '#1c3d52' },
    { id: 'mystery', name: '미스테리 스릴러', desc: '저조도, 명암비, 짙은 그림자', bg: 'linear-gradient(135deg, #2d2d3d 0%, #1a1a2e 100%)', color: '#e0e0e0' },
    { id: 'noir', name: '느와르/서스펜스', desc: '어두운 조명, 음산한 분위기', bg: 'linear-gradient(135deg, #1f1f2e 0%, #0d0d1a 100%)', color: '#c8c8d0' },
    { id: 'silent-film', name: '20년대 무성영화', desc: '흑백, 콘트라스트, 빈티지 필름', bg: 'linear-gradient(135deg, #d0d0d0 0%, #a0a0a0 100%)', color: '#1a1a1a' },
    { id: 'romcom', name: '90년대 롬코디', desc: 'VHS 화질, 단색 및 원색 톤', bg: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%)', color: '#6d1b3a' },
    { id: 'modern', name: '현대 드라마', desc: '비비드한 색감, 부드러운 조명', bg: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)', color: '#0d47a1' },
    { id: 'melo', name: '멜로 드라마', desc: '부드러운 콘트라스트, 따스하고 화사한 스타일', bg: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)', color: '#6d3a00' },
    { id: 'documentary', name: '다큐멘터리', desc: '사실적인 묘사와 실제 사진, 현장감', bg: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', color: '#1b5e20' },
    { id: 'cyberpunk', name: '사이버펑크 네온', desc: '네온 색상, 미래적인 분위기', bg: 'linear-gradient(135deg, #1a0033 0%, #0d0026 100%)', color: '#e040fb' },
    { id: 'webtoon', name: '디지털 웹툰', desc: '셀쉐이딩 라인과 화려한 디자인', bg: 'linear-gradient(135deg, #ede7f6 0%, #d1c4e9 100%)', color: '#4a148c' },
    { id: 'sketch', name: '흑백 스케치북', desc: '연필 드로잉이 살아있는 스케치', bg: 'linear-gradient(135deg, #fafafa 0%, #e0e0e0 100%)', color: '#333333' },
    { id: 'oriental-painting', name: '동양 수묵화', desc: '여백의 미가 살아있는 먹물 그림', bg: 'linear-gradient(135deg, #f5f0e8 0%, #e8dcc8 100%)', color: '#3e3428' },
    { id: 'neon-city', name: '네온시티팝', desc: '80년대 레트로 퓨처, 화려한 야경', bg: 'linear-gradient(135deg, #1a1040 0%, #2d1b69 100%)', color: '#ff80ab' },
    { id: 'illustration', name: '그냥 삽화', desc: '성경 삽화풍, 고대 인물론 실사풍', bg: 'linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%)', color: '#5d4037' },
    { id: 'cute-character', name: '귀여운 동물 캐릭터', desc: '3D 애니메이션 스타일', bg: 'linear-gradient(135deg, #e8f5e9 0%, #f3e5f5 100%)', color: '#2e7d32' }
];

const ImageGeneration = ({ projectId: propProjectId }) => {
    const router = useRouter();
    const projectIdParam = Array.isArray(router.query.projectId)
        ? router.query.projectId[0]
        : router.query.projectId;
    const idParam = Array.isArray(router.query.id)
        ? router.query.id[0]
        : router.query.id;
    const projectId = propProjectId || projectIdParam || idParam;

    // 이전 단계 데이터
    const [blueprint, setBlueprint] = useState(null);
    const [generatedScript, setGeneratedScript] = useState('');
    const [scenes, setScenes] = useState([]);
    const [characters, setCharacters] = useState([]);
    const [selectedCharacterIds, setSelectedCharacterIds] = useState(new Set());

    // Generated Images State
    const [generatedImages, setGeneratedImages] = useState({}); // Scenes
    const [generatedCharacterImages, setGeneratedCharacterImages] = useState({}); // Characters
    const [successCount, setSuccessCount] = useState(0);
    const [failCount, setFailCount] = useState(0);
    const [generating, setGenerating] = useState(false);
    const [generatingIndex, setGeneratingIndex] = useState(null);
    const [targetScenesCount, setTargetScenesCount] = useState(0);
    const [errors, setErrors] = useState({});
    const [characterErrors, setCharacterErrors] = useState({});
    const [generationStartTime, setGenerationStartTime] = useState(null);
    const [averageSceneDurationMs, setAverageSceneDurationMs] = useState(12000);
    const [estimatedRemainingSeconds, setEstimatedRemainingSeconds] = useState(0);

    // Image Settings
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [selectedStyle, setSelectedStyle] = useState(IMAGE_STYLES[0]);

    // 이미지 생성 상태 (Scenes)
    const [generationStatus, setGenerationStatus] = useState('idle'); // idle, generating, completed, error

    // 이미지 생성 상태 (Characters)
    const [charGenerationStatus, setCharGenerationStatus] = useState('idle'); // idle, generating, completed, error
    const [currentCharIndex, setCurrentCharIndex] = useState(-1);
    const [charModalOpen, setCharModalOpen] = useState(false);
    const [charEstimatedRemainingSeconds, setCharEstimatedRemainingSeconds] = useState(0);
    const [charGenerationStartTime, setCharGenerationStartTime] = useState(null);
    const [charSuccessCount, setCharSuccessCount] = useState(0);
    const [charTargetCount, setCharTargetCount] = useState(0);

    // UI 상태
    const [selectedScene, setSelectedScene] = useState(null);
    const [viewMode, setViewMode] = useState('grid'); // grid, timeline
    const [activeCharacterId, setActiveCharacterId] = useState(null); // 현재 활성 캐릭터 (썸네일 일관성 적용용)

    // 초기 로딩 추적 (Strict Mode 중복 방지 + ID 변경 시 리셋)
    const initRef = useRef({ projectId: null, started: false, finished: false });
    const lastGoodScenesRef = useRef([]);

    useEffect(() => {
        if (!router.isReady) return;

        // 1. projectId 없으면 리다이렉트
        if (!projectId) {
            console.warn('[ImageGeneration] No projectId found');
            alert('프로젝트 ID가 필요합니다.');
            router.push('/projects');
            return;
        }

        // 2. 이미 로딩 시작/완료된 프로젝트면 스킵 (StrictMode 2회 호출 방어)
        if (initRef.current.projectId === projectId && initRef.current.started) {
            console.log('[IG] Already started/finished for', projectId, initRef.current);
            return;
        }

        // 3. 새 프로젝트 로딩 시작
        console.log('[IG] INIT LOAD start', projectId);
        initRef.current = { projectId, started: true, finished: false };

        // 상태 초기화 (새 프로젝트 진입 시에만) — scenes는 초기화하지 않음 (덮어쓰기 방지)
        setBlueprint(null);
        setGeneratedScript('');
        setCharacters([]);
        setGeneratedImages({});
        setGeneratedCharacterImages({});
        setErrors({});
        setCharacterErrors({});
        setGenerationStatus('idle');
        setCharGenerationStatus('idle');

        loadAllData(projectId).then(() => {
            if (initRef.current.projectId === projectId) {
                initRef.current.finished = true;
            }
        });

    }, [projectId, router.isReady]);

    const loadAllData = async (pid) => {
        try {
            console.log('━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📍 Loading Image Generation Page');
            console.log(`📌 Project ID: ${pid}`);

            // 기존 전역 데이터 마이그레이션 (한 번만)
            migrateProjectData(pid, [
                PROJECT_DATA_KEYS.BLUEPRINT,
                PROJECT_DATA_KEYS.SCRIPT,
                PROJECT_DATA_KEYS.SCENES,
                PROJECT_DATA_KEYS.CHARACTERS,
                PROJECT_DATA_KEYS.GENERATED_IMAGES,
                PROJECT_DATA_KEYS.GENERATED_CHARACTER_IMAGES,
            ]);

            // 1. 프로젝트 데이터 가져오기 (API)
            let projectData = null;
            try {
                projectData = await fetchProject(pid);
                console.log('📦 Project loaded from API:', {
                    hasScenes: !!projectData?.scenes?.length,
                    scenesCount: projectData?.scenes?.length
                });
            } catch (error) {
                console.warn('⚠️ Failed to load project from API, fallback to localStorage:', error);
            }

            // 2. 씬 데이터 결정 (우선순위: API > LocalStorage)
            const apiScenes = Array.isArray(projectData?.scenes) ? projectData.scenes : [];
            const savedScenes = loadProjectData(pid, PROJECT_DATA_KEYS.SCENES, []);
            const lsScenes = Array.isArray(savedScenes) ? savedScenes : [];

            const nextScenes = apiScenes.length > 0 ? apiScenes : lsScenes;

            console.log('[IG] projectId', pid);
            console.log('[IG] apiScenes', apiScenes.length);
            console.log('[IG] lsScenes', lsScenes.length);
            console.log('[IG] nextScenes', nextScenes.length);

            // 3. 상태 업데이트 (덮어쓰기 방지 로직 적용)
            setScenes(prev => {
                const prevArr = Array.isArray(prev) ? prev : [];
                const nextArr = Array.isArray(nextScenes) ? nextScenes : [];

                console.log('[IG] setScenes prev=', prevArr.length, 'api=', apiScenes.length, 'next=', nextArr.length);

                // 1) API에서 유효한 scenes가 왔으면 무조건 채택
                if (apiScenes.length > 0) {
                    lastGoodScenesRef.current = apiScenes;
                    return apiScenes;
                }
                // 2) API가 비었을 때만 fallback 허용, 단 prev가 이미 있으면 덮어쓰지 않음
                if (nextArr.length === 0 && prevArr.length > 0) return prevArr;
                if (nextArr.length === 0 && lastGoodScenesRef.current.length > 0) return lastGoodScenesRef.current;
                if (nextArr.length > 0) lastGoodScenesRef.current = nextArr;
                return nextArr;
            });

            // 4. 나머지 데이터 로드
            // Blueprint
            if (projectData?.blueprint) {
                try {
                    const bp = typeof projectData.blueprint === 'string' ? JSON.parse(projectData.blueprint) : projectData.blueprint;
                    setBlueprint(bp);
                } catch (e) { console.error(e); }
            } else {
                const savedBP = loadProjectData(pid, PROJECT_DATA_KEYS.BLUEPRINT);
                if (savedBP) setBlueprint(savedBP);
            }

            // Script
            if (projectData?.script) setGeneratedScript(projectData.script);
            else {
                const savedScript = loadProjectData(pid, PROJECT_DATA_KEYS.SCRIPT, '');
                if (savedScript) setGeneratedScript(savedScript);
            }

            // Characters
            // API Characters > LS Characters
            const apiChars = Array.isArray(projectData?.characters) ? projectData.characters : [];
            const lsChars = loadProjectData(pid, PROJECT_DATA_KEYS.CHARACTERS, []);
            const nextChars = apiChars.length > 0 ? apiChars : lsChars;

            setCharacters(prev => {
                if (nextChars.length === 0 && Array.isArray(prev) && prev.length > 0) {
                    return prev;
                }
                return nextChars;
            });

            // Images (API -> LS)
            if (projectData?.images && Object.keys(projectData.images).length > 0) {
                setGeneratedImages(projectData.images);
            } else {
                const savedImages = loadProjectData(pid, PROJECT_DATA_KEYS.GENERATED_IMAGES, {});
                if (savedImages) setGeneratedImages(savedImages);
            }

            // Character Images (LS only usually, or API if synced)
            const savedCharImages = loadProjectData(pid, PROJECT_DATA_KEYS.GENERATED_CHARACTER_IMAGES, {});
            if (savedCharImages) setGeneratedCharacterImages(savedCharImages);

            console.log('✅ loadAllData sequence completed');

        } catch (error) {
            console.error('❌ Error inside loadAllData:', error);
            // alert('데이터 로드 중 오류가 발생했습니다.'); // 반복 팝업 방지를 위해 로그만
        }
    };



    const getTotalDuration = (scenes) => {
        if (!scenes || scenes.length === 0) return 0;
        return scenes.reduce((total, scene) => total + (scene.duration || 0), 0);
    };

    // 캐릭터 이미지 생성 (단일)
    const generateCharacterImage = async (character) => {
        const pid = projectId || blueprint?.id;
        if (!pid) {
            throw new Error('Project ID가 필요합니다.');
        }

        // 캐릭터 설명과 역할을 조합하여 프롬프트 생성
        const styleFlavor = selectedStyle ? `${selectedStyle.name} style with ${selectedStyle.desc}` : 'Realistic portrait style';
        const personaNotes = [
            `Name: ${character.name}`,
            character.role ? `Role: ${character.role}` : '',
            character.description ? `Description: ${character.description}` : ''
        ].filter(Boolean).join(' | ');
        const rawPrompt = `Portrait of a real human being. ${personaNotes}. Style directive: ${styleFlavor}. Keep lighting natural, focus on facial expression and body language, include props only if relevant.`;
        const prompt = clampAndLogPrompt(rawPrompt, `char_${character.id}`, character.name || character.role);

        const response = await fetch(`/api/projects/${pid}/generate/image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                sceneId: `char_${character.id}`,
                sequence: 1,
                aspectRatio: '1:1',
                styleId: selectedStyle.id
            })
        });

        if (!response.ok) {
            let errMsg = 'Character image generation failed';
            try {
                const errBody = await response.json();
                errMsg = errBody.error || errBody.message || errMsg;
            } catch (_) {
                errMsg = response.statusText || errMsg;
            }
            if (/too long/i.test(errMsg)) {
                errMsg += ` (rawLen=${rawPrompt.length}, sendLen=${prompt.length})`;
            }
            console.error('[PROMPT_ERROR]', { charId: character.id, errMsg, rawLen: rawPrompt.length, sendLen: prompt.length });
            throw new Error(errMsg);
        }

        const data = await response.json();
        if (!data.ok) {
            throw new Error(data.error || 'Character image generation failed');
        }
        const imageUrl = data.imageUrl;
        if (!imageUrl) {
            throw new Error('Image URL missing in response');
        }

            return {
                url: imageUrl.startsWith('http') ? imageUrl : `${window.location.origin}${imageUrl}`,
                metadata: {
                    createdAt: new Date().toISOString(),
                    prompt: prompt,
                    model: 'dall-e-3',
                    type: 'character'
                }
            };
        };

    // 캐릭터 전체 이미지 생성 (순차 처리)
    const handleGenerateCharacters = async (forceRegenerate = false) => {
        if (characters.length === 0) return;

        console.log('🚀 Starting character image generation');
        setCharGenerationStatus('generating');
        setCharModalOpen(true);
        setCharGenerationStartTime(Date.now());
        setCharTargetCount(characters.length);
        setCharSuccessCount(0);

        const newImages = forceRegenerate ? {} : { ...generatedCharacterImages };
        const newErrors = {};
        if (forceRegenerate) {
            setGeneratedCharacterImages({});
            setCharacterErrors({});
        }
        let charCompletedDurationsMs = 0;
        let charCompletedCount = 0;

        for (let i = 0; i < characters.length; i++) {
            const char = characters[i];
            const iterationStart = Date.now();

            if (!forceRegenerate && newImages[char.id]) {
                console.log(`⏭️ Character ${char.name}: Already generated, skipping`);
                continue;
            }

            setCurrentCharIndex(i);
            console.log(`🎨 Generating image for character ${char.name} (${i + 1}/${characters.length})`);

            try {
                const imageData = await generateCharacterImage(char);
                newImages[char.id] = imageData;
                setGeneratedCharacterImages({ ...newImages });
                charCompletedCount++;
                setCharSuccessCount(prev => prev + 1);

                if (projectId) {
                    saveProjectData(projectId, PROJECT_DATA_KEYS.GENERATED_CHARACTER_IMAGES, newImages);
                }

                console.log(`✅ Character ${char.name}: Success`);

            } catch (error) {
                console.error(`❌ Character ${char.name}: Failed`, error);
                newErrors[char.id] = error.message;
                setCharacterErrors({ ...newErrors });
                setCharGenerationStatus('error');
            } finally {
                const duration = Date.now() - iterationStart;
                charCompletedDurationsMs += duration;
                const avgDuration = charCompletedCount > 0 ? charCompletedDurationsMs / charCompletedCount : 12000;
                const remaining = Math.max(characters.length - charCompletedCount, 0);
                setCharEstimatedRemainingSeconds(Math.ceil((avgDuration * remaining) / 1000));
            }

            if (i < characters.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        if (characters.length > 0) {
            setSelectedCharacterIds(new Set(characters.map(char => char.id)));
            setActiveCharacterId(characters[0]?.id || null);
        }
        setCharGenerationStatus('completed');
        setCurrentCharIndex(-1);
        setCharModalOpen(false);
        setCharEstimatedRemainingSeconds(0);

        alert(`✅ 캐릭터 이미지 생성 완료!\n성공: ${Object.keys(newImages).length}개`);
    };

    // 전체 이미지 생성
    const handleGenerateAll = async (forceRegenerate = false) => {
        if (generating || !scenes.length) return;

        const targetScenes = forceRegenerate ? scenes : scenes.filter(scene => !generatedImages[scene.id]);
        if (targetScenes.length === 0) {
            setTargetScenesCount(0);
            alert(forceRegenerate ? '재생성할 씬이 없습니다.' : '모든 씬 이미지가 이미 생성되었습니다.');
            return;
        }
        if (forceRegenerate) {
            setGeneratedImages({});
        }

        setTargetScenesCount(targetScenes.length);
        setSuccessCount(0);
        setFailCount(0);
        setErrors({});
        setGenerationStatus('generating');
        setGenerating(true);
        setGenerationStartTime(Date.now());
        setAverageSceneDurationMs(12000);
        setEstimatedRemainingSeconds(Math.ceil((targetScenes.length * 12000) / 1000));

        const updatedImages = { ...generatedImages };
        const updatedErrors = { ...errors };
        let success = 0;
        let failure = 0;
        let completedDurationsMs = 0;

        try {
            for (let idx = 0; idx < targetScenes.length; idx++) {
                const scene = targetScenes[idx];
                const sceneIndex = scene.index ?? scene.sequence ?? (idx + 1);
                const iterationStart = Date.now();

                try {
                    const imageData = await generateSingleImage(scene, sceneIndex);
                    success++;
                    updatedImages[scene.id] = imageData;
                    delete updatedErrors[scene.id];
                } catch (error) {
                    console.error(`[ImageGeneration] Scene ${idx + 1} failed`, error);
                    failure++;
                    updatedErrors[scene.id] = error.message || '이미지 생성 실패';
                } finally {
                    const duration = Date.now() - iterationStart;
                    completedDurationsMs += duration;
                    const completedCount = success + failure;
                    const avgDuration = completedDurationsMs / completedCount;
                    setAverageSceneDurationMs(avgDuration);
                const remainingScenes = Math.max(targetScenes.length - completedCount, 0);
                    const remainingSeconds = Math.ceil((avgDuration * remainingScenes) / 1000);
                    setEstimatedRemainingSeconds(remainingSeconds);

                    setGeneratedImages({ ...updatedImages });
                    setErrors({ ...updatedErrors });
                    setSuccessCount(success);
                    setFailCount(failure);
                }
            }

            if (projectId) {
                saveProjectData(projectId, PROJECT_DATA_KEYS.GENERATED_IMAGES, updatedImages);
            }

            setGenerationStatus('completed');
            setTargetScenesCount(0);
            setEstimatedRemainingSeconds(0);

            const totalSuccessCount = Object.keys(updatedImages).length;
            alert(`✅ 이미지 생성 완료!\n성공: ${success}개\n실패: ${failure}개`);

            if (typeof window !== 'undefined' && projectId) {
                window.dispatchEvent(new CustomEvent('projectImagesUpdated', {
                    detail: { projectId, imagesCount: totalSuccessCount }
                }));
                if (window.location.pathname.includes('/project')) {
                    window.dispatchEvent(new CustomEvent('projectDataRefresh', {
                        detail: { projectId }
                    }));
                }
            }
        } catch (error) {
            console.error('[ImageGeneration] handleGenerateAll fatal error', error);
            setGenerationStatus('error');
            setTargetScenesCount(0);
            setEstimatedRemainingSeconds(0);
            alert('이미지 생성 중 오류가 발생했습니다. 콘솔을 확인하세요.');
        } finally {
            setGenerating(false);
            setGeneratingIndex(null);
        }
    };

    const formatDurationLabel = (seconds) => {
        if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '00:00';
        const safeSeconds = Math.max(0, Math.floor(seconds));
        const mins = Math.floor(safeSeconds / 60);
        const secs = safeSeconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    // 개별 이미지 생성
    const generateSingleImage = async (scene, sceneIndex) => {
        const pid = projectId || blueprint?.id || 'p_20260210_155249_6d2c';
        if (sceneIndex !== undefined && sceneIndex !== null) {
            setGeneratingIndex(sceneIndex);
        }

        let charactersPayload = [];
        const protagonistChars = characters.filter(c => c.id !== 'narrator_default');
        const selectedChars = protagonistChars.filter(c => selectedCharacterIds.has(c.id));
        if (selectedChars.length > 0) {
            charactersPayload = selectedChars;
        } else if (activeCharacterId) {
            const activeChar = protagonistChars.find(c => c.id === activeCharacterId);
            if (activeChar) {
                charactersPayload.push(activeChar);
            }
        } else if (scene.characterId) {
            const linkedChar = protagonistChars.find(c => c.id === scene.characterId);
            if (linkedChar) {
                charactersPayload.push(linkedChar);
            }
        } else if (protagonistChars.length > 0) {
            charactersPayload.push(protagonistChars[0]);
        }

        const styleContext = selectedStyle ? `${selectedStyle.name} style - ${selectedStyle.desc}` : '실사 스타일 중심의 분위기';
        const charDescriptions = charactersPayload.map(c => {
            const role = c.role ? ` (${c.role})` : '';
            const desc = c.description ? `: ${c.description}` : '';
            return `${c.name}${role}${desc}`;
        }).join('; ');
        const combinedPrompt = `
            ${styleContext}
            ${charDescriptions ? `Characters: ${charDescriptions}` : 'Characters: realistic humans'}
            Scene: ${scene.imagePrompt}
            ${scene.summary ? `Summary: ${scene.summary}` : ''}
            Use cinematic lighting, clear human figures, no abstract backgrounds unless the scene specifically requires it.
        `;
        const sendPrompt = clampAndLogPrompt(combinedPrompt, scene.id, scene.text);
        const sequenceValue = scene.sequence ?? (scenes.indexOf(scene) + 1);

        const response = await fetch(`/api/projects/${pid}/generate/image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: sendPrompt,
                sceneId: scene.id,
                sequence: sequenceValue,
                sceneIndex: sceneIndex ?? sequenceValue,
                aspectRatio: aspectRatio,
                styleId: selectedStyle.id,
                characters: charactersPayload,
                styleName: selectedStyle?.name,
                styleDescription: selectedStyle?.desc
            })
        });

        if (!response.ok) {
            let errMsg = 'Image generation failed';
            try {
                const errBody = await response.json();
                errMsg = errBody.error || errBody.message || errMsg;
            } catch (_) {
                errMsg = response.statusText || errMsg;
            }
            if (/too long/i.test(errMsg)) {
                errMsg += ` (rawLen=${(scene.imagePrompt||'').length}, sendLen=${sendPrompt.length})`;
            }
            console.error('[PROMPT_ERROR]', { sceneId: scene.id, errMsg, rawLen: (scene.imagePrompt||'').length, sendLen: sendPrompt.length });
            throw new Error(errMsg);
        }

        const data = await response.json();
        if (!data.ok) {
            throw new Error(data.error || 'Image generation failed');
        }

        const imageUrl = data.imageUrl;
        if (!imageUrl) {
            throw new Error('Image URL missing in response');
        }

        return {
            url: imageUrl.startsWith('http') ? imageUrl : `${window.location.origin}${imageUrl}`,
            metadata: {
                createdAt: new Date().toISOString(),
                prompt: scene.imagePrompt,
                model: 'dall-e-3'
            }
        };
    };

    // 개별 씬 재생성
    const handleRegenerateScene = async (sceneId) => {
        const scene = scenes.find(s => s.id === sceneId);
        if (!scene) return;

        const confirmed = confirm(`씬 ${scenes.indexOf(scene) + 1}의 이미지를 다시 생성하시겠습니까?`);
        if (!confirmed) return;

        const sceneIndex = scene.sequence ?? scenes.indexOf(scene);
        setGenerationStatus('generating');
        setGenerating(true);
        setGeneratingIndex(sceneIndex);

        try {
            const imageData = await generateSingleImage(scene, sceneIndex);

            const newImages = {
                ...generatedImages,
                [sceneId]: imageData
            };

            setGeneratedImages(newImages);
            if (projectId) {
                saveProjectData(projectId, PROJECT_DATA_KEYS.GENERATED_IMAGES, newImages);
            }

            // 에러 제거
            const newErrors = { ...errors };
            delete newErrors[sceneId];
            setErrors(newErrors);

            alert('✅ 이미지가 재생성되었습니다!');

        } catch (error) {
            alert('❌ 이미지 생성 실패: ' + error.message);
            setErrors({
                ...errors,
                [sceneId]: error.message
            });
        } finally {
            setGenerationStatus('idle');
            setGenerating(false);
            setGeneratingIndex(null);
        }
    };

    // 이미지 다운로드
    const handleDownloadImage = (imageUrl, filename) => {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename;
        link.click();
    };

    // 이미지 파일로 교체
    const handleReplaceImage = async (sceneId, file) => {
        if (!file) return;

        // 파일을 base64로 변환
        const reader = new FileReader();
        reader.onload = (e) => {
            const newImages = {
                ...generatedImages,
                [sceneId]: {
                    url: e.target.result,
                    metadata: {
                        createdAt: new Date().toISOString(),
                        source: 'user-upload',
                        filename: file.name
                    }
                }
            };

            setGeneratedImages(newImages);
            if (projectId) {
                saveProjectData(projectId, PROJECT_DATA_KEYS.GENERATED_IMAGES, newImages);
            }
            setSelectedScene(null);

            alert('✅ 이미지가 교체되었습니다!');
        };

        reader.readAsDataURL(file);
    };

    const handleProceedToTTS = () => {
        // 모든 데이터를 통합하여 저장
        const projectData = {
            blueprint,
            script: generatedScript,
            scenes,
            images: generatedImages,
            metadata: {
                completedAt: new Date().toISOString(),
                totalScenes: scenes.length,
                generatedImages: Object.keys(generatedImages).length
            }
        };

        if (projectId) {
            saveProjectData(projectId, PROJECT_DATA_KEYS.PROJECT_DATA, projectData);
        }

        if (projectId) {
            router.push(`/project?id=${projectId}&step=tts`);
        } else {
            router.push('/tts-generation');
        }
    };

    // 선택된 씬 관리
    const [selectedSceneIds, setSelectedSceneIds] = useState(new Set());

    const toggleSceneSelection = (sceneId) => {
        const newSelected = new Set(selectedSceneIds);
        if (newSelected.has(sceneId)) {
            newSelected.delete(sceneId);
        } else {
            newSelected.add(sceneId);
        }
        setSelectedSceneIds(newSelected);
    };

    const handleSelectAllScenes = () => {
        if (selectedSceneIds.size === scenes.length) {
            setSelectedSceneIds(new Set());
        } else {
            const allIds = new Set(scenes.map(s => s.id));
            setSelectedSceneIds(allIds);
        }
    };

    const handleDownloadSelected = () => {
        if (selectedSceneIds.size === 0) {
            alert('다운로드할 이미지를 선택해주세요.');
            return;
        }

        selectedSceneIds.forEach(sceneId => {
            const scene = scenes.find(s => s.id === sceneId);
            const image = generatedImages[sceneId];
            if (image) {
                handleDownloadImage(image.url, `scene_${scene.sequence || scenes.indexOf(scene) + 1}.png`);
            }
        });
    };

    const handleDownloadCharacters = () => {
        const entries = Object.entries(generatedCharacterImages);
        if (entries.length === 0) {
            alert('다운로드할 캐릭터 이미지가 없습니다.');
            return;
        }

        entries.forEach(([charId, image], idx) => {
            if (!image || !image.url) return;
            const char = characters.find(c => c.id === charId);
            const filename = `character_${char?.name?.replace(/\s+/g, '_') || charId}_${idx + 1}.png`;
            handleDownloadImage(image.url, filename);
        });
    };

    // 캐릭터 선택 로직
    const toggleCharacterSelection = (charId) => {
        const newSelected = new Set(selectedCharacterIds);
        if (newSelected.has(charId)) {
            newSelected.delete(charId);
        } else {
            newSelected.add(charId);
        }
        setSelectedCharacterIds(newSelected);
    };

    const handleSelectAllCharacters = () => {
        if (selectedCharacterIds.size === characters.length) {
            setSelectedCharacterIds(new Set());
        } else {
            const allIds = new Set(characters.map(c => c.id));
            setSelectedCharacterIds(allIds);
        }
    };

    // 캐릭터 활성화 (썸네일에 일관성 적용)
    const handleApplyCharacter = (charId) => {
        const newId = activeCharacterId === charId ? null : charId;
        setActiveCharacterId(newId);
        if (newId) {
            const char = characters.find(c => c.id === charId);
            alert(`"${char?.name}" 캐릭터가 활성화되었습니다.\n이후 생성되는 썸네일에 이 캐릭터의 스타일이 반영됩니다.`);
        }
    };

    // 캐릭터 개별 재생성
    const handleRegenerateCharacter = async (charId) => {
        const char = characters.find(c => c.id === charId);
        if (!char) return;
        const confirmed = confirm(`"${char.name}" 이미지를 다시 생성하시겠습니까?`);
        if (!confirmed) return;

        setCharGenerationStatus('generating');
        try {
            const imageData = await generateCharacterImage(char);
            const newImages = { ...generatedCharacterImages, [charId]: imageData };
            setGeneratedCharacterImages(newImages);
            if (projectId) {
                saveProjectData(projectId, PROJECT_DATA_KEYS.GENERATED_CHARACTER_IMAGES, newImages);
            }
            alert('이미지가 재생성되었습니다.');
        } catch (error) {
            alert('이미지 생성 실패: ' + error.message);
        } finally {
            setCharGenerationStatus('idle');
        }
    };

    // 캐릭터 커스텀 이미지 업로드 (로컬 파일)
    const handleCustomCharacterImage = (charId) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const imageData = { url: ev.target.result, metadata: { createdAt: new Date().toISOString(), source: 'custom', fileName: file.name } };
                const newImages = { ...generatedCharacterImages, [charId]: imageData };
                setGeneratedCharacterImages(newImages);
                if (projectId) {
                    saveProjectData(projectId, PROJECT_DATA_KEYS.GENERATED_CHARACTER_IMAGES, newImages);
                }
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    const renderCharacterGrid = () => {
        if (characters.length === 0) return null;

        const generatedCount = Object.keys(generatedCharacterImages).length;
        const isGenerating = charGenerationStatus === 'generating';

        return (
            <div className="char-box">
                <div className="char-box-header">
                    <div className="char-box-title">
                        <h3>캐릭터</h3>
                        <span className="char-box-count">{generatedCount}/{characters.length}</span>
                    </div>
                    <div className="char-box-actions">
                       <button
                           className="btn-char-generate"
                           onClick={handleGenerateCharacters}
                           disabled={isGenerating}
                       >
                           {isGenerating ? '생성 중...' : '전체 생성'}
                       </button>
                        <button
                            className="btn-char-regenerate"
                            onClick={() => handleGenerateCharacters(true)}
                            disabled={isGenerating}
                        >
                            🔁 캐릭터 재생성
                        </button>
                        <button
                            className="btn-download-all"
                            onClick={handleDownloadCharacters}
                            disabled={Object.keys(generatedCharacterImages).length === 0}
                        >
                            ⬇ 캐릭터 전체 다운로드
                        </button>
                    </div>
                </div>

                <div className="char-list character-grid">
                    {characters.map((char, index) => {
                        const image = generatedCharacterImages[char.id];
                        const isCurrent = isGenerating && currentCharIndex === index;
                        const isActive = activeCharacterId === char.id;

                        return (
                            <div
                                key={char.id}
                                className={`char-item ${isActive ? 'active' : ''}`}
                            >
                                <div className="char-thumb">
                                    {image ? (
                                        <img src={image.url} alt={char.name} />
                                    ) : isCurrent ? (
                                        <div className="char-loading">...</div>
                                    ) : (
                                        <div className="char-empty">{char.name.charAt(0)}</div>
                                    )}
                                </div>
                                <div className="char-meta">
                                    <div className="char-meta-name">{char.name}</div>
                                    <div className="char-meta-role">{char.role}</div>
                                </div>
                                <div className="char-actions">
                                    <button
                                        className={`btn-char-apply ${isActive ? 'active' : ''}`}
                                        onClick={() => handleApplyCharacter(char.id)}
                                        title="이 캐릭터를 썸네일에 적용"
                                    >
                                        {isActive ? '적용중' : '적용'}
                                    </button>
                                    <button
                                        className="btn-char-regen"
                                        onClick={() => handleRegenerateCharacter(char.id)}
                                        disabled={isGenerating}
                                        title="이미지 재생성"
                                    >
                                        변경
                                    </button>
                                    <button
                                        className="btn-char-custom"
                                        onClick={() => handleCustomCharacterImage(char.id)}
                                        title="내 이미지 파일 선택"
                                    >
                                        직접<br />선택
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderCharacterProgressModal = () => {
        if (!charModalOpen) return null;

        const total = charTargetCount || 1;
        const pending = Math.max(total - charSuccessCount, 0);
        const progress = Math.min(100, Math.round((charSuccessCount / total) * 100));
        const remainingLabel = formatDurationLabel(charEstimatedRemainingSeconds);

        return (
            <div className="modal-overlay">
                <div className="modal-content generation-progress-modal" style={{ width: '420px', textAlign: 'center' }}>
                    <div className="progress-animation">
                        <div className="rotating-icon">🧑‍🎨</div>
                    </div>
                    <h2>캐릭터 이미지를 생성 중입니다</h2>
                    <p className="current-scene">
                        생성: {charSuccessCount} / {total}
                    </p>
                    <div className="progress-bar-container">
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${progress}%` }}>
                                <span className="progress-text">{progress}%</span>
                            </div>
                        </div>
                    </div>
                    <div className="progress-stats">
                        <div className="stat-item pending">
                            <span className="stat-icon">⏳</span>
                            <span className="stat-count">{pending}</span>
                            <span className="stat-label">남은</span>
                        </div>
                    </div>
                    <div className="generation-tips">
                        <p>⏱️ 예측 남은 시간: {remainingLabel}</p>
                    </div>
                    <button
                        className="btn-close-modal"
                        onClick={() => setCharModalOpen(false)}
                    >
                        닫기 (백그라운드 진행)
                    </button>
                </div>
            </div>
        );
    };

    const renderGridView = () => {
        const isAllSelected = scenes.length > 0 && selectedSceneIds.size === scenes.length;

        return (
            <div className="full-grid-view">

                <div className="grid-view-container section-thumbnail thumbnail-box">
                    {/* 씬 이미지 헤더 */}
                    <div className="section-header-bar">
                        <div className="generate-actions">
                            <button
                                className="btn-generate-all"
                                onClick={() => handleGenerateAll(false)}
                                disabled={scenes.length === 0 || generationStatus === 'generating' || generating}
                                title={characters.length > 0 && charGenerationStatus !== 'completed' ? '캐릭터 생성을 먼저 완료해주세요' : ''}
                            >
                                🎬 씬 전체 생성
                            </button>
                            <button
                                className="btn-regenerate-all"
                                onClick={() => handleGenerateAll(true)}
                                disabled={scenes.length === 0 || generationStatus === 'generating' || generating}
                            >
                                🔄 스타일 재생성
                            </button>
                        </div>
                        <div className="header-title">
                            <h3>▌씬 이미지</h3>
                            <span className="info-badge" style={{ marginLeft: '10px', fontSize: '14px' }}>
                                {Object.keys(generatedImages).length} / {scenes.length}
                            </span>
                        </div>
                        <div className="header-actions">
                            <button
                                className={`btn-select-all ${isAllSelected ? 'active' : ''}`}
                                onClick={handleSelectAllScenes}
                            >
                                {isAllSelected ? '씬 이미지 전체 해제' : '씬 이미지 전체 선택'}
                            </button>

                            <button
                                className="btn-download-all"
                                onClick={handleDownloadSelected}
                                disabled={selectedSceneIds.size === 0}
                            >
                                ⬇ 씬 이미지 전체 다운로드
                            </button>
                        </div>
                    </div>

                    <div className="scenes-grid scenes-grid-compact">
                        {scenes.map((scene, index) => {
                            const image = generatedImages[scene.id];
                            const error = errors[scene.id];
                            const status = error ? 'error' : image ? 'completed' : 'pending';
                            const isSelected = selectedSceneIds.has(scene.id);
                            const sceneIndex = scene.index ?? scene.sequence ?? index;
                            const isGeneratingScene = generating && generatingIndex === sceneIndex;

                            return (
                                <div
                                    key={scene.id}
                                    className={`image-card-new ${status} ${isSelected ? 'selected' : ''}`}
                                    onClick={() => toggleSceneSelection(scene.id)}
                                >
                                    {/* 이미지 영역 (상단) - 선택한 비율 적용 */}
                                    <div className={`card-image-area ratio-${aspectRatio.replace(':', '-')}`}>
                                        {/* 뱃지 & 체크박스 오버레이 */}
                                        <div className="card-overlay-top">
                                            <div className="scene-number-badge-new">
                                                제{index + 1}장
                                            </div>
                                            <div className={`checkbox-custom ${isSelected ? 'checked' : ''}`}>
                                                {isSelected && '✓'}
                                            </div>
                                        </div>

                                        {isGeneratingScene && (
                                            <div className="spinner-overlay">
                                                <span className="spinner-icon">⏳</span>
                                            </div>
                                        )}

                                        {/* 이미지 또는 플레이스홀더 */}
                                        {status === 'completed' ? (
                                            <img
                                                src={image.url}
                                                alt={`Scene ${index + 1}`}
                                                className="generated-image-new"
                                            />
                                        ) : status === 'error' ? (
                                            <div className="placeholder-error">
                                                <span>⚠️</span>
                                                <p>Error</p>
                                            </div>
                                        ) : (
                                            <div className="placeholder-pending">
                                                <span>GEN</span>
                                            </div>
                                        )}

                                        {/* 호버 액션 오버레이 (이미지 있을 때만) */}
                                        {status === 'completed' && (
                                            <div className="hover-actions">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedScene(scene);
                                                    }}
                                                    className="btn-action-icon"
                                                    title="자세히 보기"
                                                >
                                                    👁️
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRegenerateScene(scene.id);
                                                    }}
                                                    className="btn-action-icon"
                                                    title="재생성"
                                                >
                                                    🔄
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* 텍스트 영역 (하단) */}
                                    <div className="scene-caption">
                                        <div className="scene-header">
                                            <span className="scene-number">Scene {index + 1}</span>
                                            <span className="scene-time">
                                                {scene.startTime !== undefined && scene.endTime !== undefined
                                                    ? `${scene.startTime.toFixed(1)}s · ${scene.endTime.toFixed(1)}s`
                                                    : `${scene.duration ? `${scene.duration}s` : '시간 정보 없음'}`
                                                }
                                            </span>
                                        </div>
                                        <p>{scene.text}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const renderTimelineView = () => {
        if (scenes.length === 0) {
            return (
                <div className="timeline-empty">
                    <p>아직 생성할 씬이 없습니다.</p>
                </div>
            );
        }

        const getSceneCharacter = (scene) => {
            if (!scene.characterId) return null;
            return characters.find(c => c.id === scene.characterId);
        };

        return (
            <div className="timeline-grid">
                {scenes.map((scene, index) => {
                    const image = generatedImages[scene.id];
                    const status = image ? 'completed' : errors[scene.id] ? 'error' : 'pending';
                    const sceneIndex = scene.index ?? scene.sequence ?? index;
                    const summary = scene.summary || scene.text?.slice(0, 100) || '설명 없음';
                    const char = getSceneCharacter(scene);

                    return (
                        <div key={scene.id} className={`timeline-card ${status}`}>
                            <div className="timeline-card-header">
                                <span>Scene {sceneIndex}</span>
                                <span className="timeline-time">
                                    {scene.duration ? `${scene.duration}s` :
                                        scene.startTime !== undefined && scene.endTime !== undefined
                                        ? `${scene.startTime.toFixed(1)}s · ${scene.endTime.toFixed(1)}s`
                                        : '시간 정보 없음'}
                                </span>
                            </div>
                            <div className="timeline-card-image">
                                {image ? (
                                    <img src={image.url} alt={`Scene ${index + 1}`} />
                                ) : (
                                    <div className="timeline-placeholder-card">
                                        {status === 'error' ? '⚠ 이미지 실패' : '이미지 준비 중'}
                                    </div>
                                )}
                            </div>
                            <div className="timeline-card-body">
                                <div className="timeline-card-character">
                                    <strong>{char?.name || activeCharacterId ? characters.find(c => c.id === activeCharacterId)?.name : '캐릭터 미지정'}</strong>
                                    {char?.role && <span className="character-role">{char.role}</span>}
                                </div>
                                <p>{summary}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderGenerationProgress = () => {
        if (generationStatus !== 'generating') return null;

        const totalTargets = targetScenesCount || scenes.length;
        const completed = Math.min(successCount, totalTargets);
        const failed = Math.min(failCount, Math.max(totalTargets - completed, 0));
        const attempted = Math.min(totalTargets, completed + failed);
        const pending = Math.max(totalTargets - attempted, 0);
        const progress = totalTargets > 0 ? Math.min(100, (attempted / totalTargets) * 100) : 0;
        const remainingTimeLabel = formatDurationLabel(estimatedRemainingSeconds);

        return (
            <div className="modal-overlay">
                <div className="modal-content generation-progress-modal" style={{ width: '500px', textAlign: 'center' }}>
                    <div className="progress-animation">
                        <div className="rotating-icon">🎨</div>
                        <div className="pulse-rings">
                            <div className="pulse-ring"></div>
                            <div className="pulse-ring"></div>
                            <div className="pulse-ring"></div>
                        </div>
                    </div>

                    <h2>AI가 씬 이미지를 생성하고 있습니다</h2>
                    <p className="current-scene">
                        시도: {attempted} / {totalTargets} (완료 {completed}, 실패 {failed})
                    </p>
                    {generatingIndex !== null && (
                        <p className="current-scene">
                            현재: 씬 {Math.min(generatingIndex + 1, scenes.length)}
                        </p>
                    )}

                    <div className="progress-bar-container">
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${progress}%` }}>
                                <span className="progress-text">{Math.round(progress)}%</span>
                            </div>
                        </div>
                    </div>

                    <div className="progress-stats">
                        <div className="stat-item success">
                            <span className="stat-icon">✓</span>
                            <span className="stat-count">{completed}</span>
                            <span className="stat-label">완료</span>
                        </div>
                        <div className="stat-item pending">
                            <span className="stat-icon">⏳</span>
                            <span className="stat-count">{pending}</span>
                            <span className="stat-label">대기</span>
                        </div>
                        {failed > 0 && (
                            <div className="stat-item error">
                                <span className="stat-icon">✗</span>
                                <span className="stat-count">{failed}</span>
                                <span className="stat-label">실패</span>
                            </div>
                        )}
                    </div>

                    <div className="generation-tips">
                        <p>💡 평균 생성 시간: 씬당 약 {Math.max(1, Math.round(averageSceneDurationMs / 1000))}초</p>
                        <p>⏱️ 예측 남은 시간: {remainingTimeLabel} ({pending} 씬)</p>
                    </div>

                    <button
                        className="btn-close-modal"
                        onClick={() => setGenerationStatus('idle')}
                        style={{ marginTop: '20px', padding: '8px 16px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        닫기 (백그라운드 진행)
                    </button>
                </div>
            </div>
        );
    };

    const renderImageDetailModal = () => {
        if (!selectedScene) return null;
        const image = generatedImages[selectedScene.id];
        if (!image) return null;

        return (
            <div className="modal-overlay" onClick={() => setSelectedScene(null)}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <button className="modal-close" onClick={() => setSelectedScene(null)}>✕</button>
                    <div className="modal-header">
                        <h2>씬 {selectedScene.sequence || '상세'} 상세보기</h2>
                        <span className="time-badge">
                            {selectedScene.startTime?.toFixed(1)}s - {selectedScene.endTime?.toFixed(1)}s
                        </span>
                    </div>
                    <div className="modal-body">
                        <div className="modal-image-area">
                            <img src={image.url} alt={`Scene ${selectedScene.sequence}`} className="modal-image" />
                        </div>
                        <div className="modal-section">
                            <h3>📝 대본</h3>
                            <p className="modal-text">{selectedScene.text}</p>
                        </div>
                        <div className="modal-section">
                            <h3>🎨 이미지 프롬프트</h3>
                            <p className="modal-prompt">{selectedScene.imagePrompt}</p>
                        </div>
                        {image.metadata && (
                            <div className="modal-section">
                                <h3>ℹ️ 생성 정보</h3>
                                <div className="metadata-grid">
                                    <div className="metadata-item">
                                        <span className="label">생성 시각:</span>
                                        <span className="value">{new Date(image.metadata.createdAt).toLocaleString('ko-KR')}</span>
                                    </div>
                                    <div className="metadata-item">
                                        <span className="label">모델:</span>
                                        <span className="value">DALL-E 3</span>
                                    </div>
                                    <div className="metadata-item">
                                        <span className="label">크기:</span>
                                        <span className="value">1024x1024</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="modal-actions">
                        <button className="btn-modal" onClick={() => handleRegenerateScene(selectedScene.id)}>🔄 재생성</button>
                        <button className="btn-modal" onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e) => handleReplaceImage(selectedScene.id, e.target.files[0]);
                            input.click();
                        }}>📁 파일로 교체</button>
                        <button className="btn-modal primary" onClick={() => {
                            const link = document.createElement('a');
                            link.href = image.url;
                            link.download = `scene_${selectedScene.sequence || 'image'}.png`;
                            link.click();
                        }}>💾 다운로드</button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <StudioLayout
            title="이미지 생성 - HANRA STUDIO"
            activeStep="images"
            reachedStep="images"
            projectId={projectId}
        >
            <div className="container">
                <div className="section-card">
                    <div className="image-generation-container">

            {/* 컨트롤 바 */}
            <div className="control-bar">
                <div className="project-info">
                    <h3>제목 : {blueprint?.topic || '프로젝트'}</h3>
                    <span className="info-badge">
                        {scenes.length}개 장면 • {getTotalDuration(scenes)}초
                    </span>
                </div>

                <div className="control-actions">
                    <button
                        className="btn-control"
                        onClick={() => setViewMode(viewMode === 'grid' ? 'timeline' : 'grid')}
                    >
                        {viewMode === 'grid' ? '📽️ 타임라인 뷰' : '🎨 그리드 뷰'}
                    </button>
                    <button
                        className="btn-control primary"
                        onClick={handleGenerateAll}
                        disabled={generationStatus === 'generating' || generating}
                    >
                        {generationStatus === 'generating'
                            ? '⏳ 생성 중...'
                            : Object.keys(generatedImages).length === 0
                                ? '⚡ 전체 이미지 생성'
                                : '🔄 미생성 이미지만 생성'}
                    </button>
                </div>
            </div>

            {/* 메인 컨텐츠 */}
            <div className="image-content">

                {/* 스타일 선택 섹션 */}
                <div className="style-selection-section">
                    <div className="ratio-selection">
                        <h3>이미지 종류</h3>
                        <div className="ratio-toggle">
                            <button
                                className={`ratio-btn ${aspectRatio === '16:9' ? 'active' : ''}`}
                                onClick={() => setAspectRatio('16:9')}
                            >
                                롱폼 16:9 (가로형)
                            </button>
                            <button
                                className={`ratio-btn ${aspectRatio === '9:16' ? 'active' : ''}`}
                                onClick={() => setAspectRatio('9:16')}
                            >
                                숏폼 9:16 (세로형)
                            </button>
                        </div>
                    </div>

                    <div className="style-grid-container">
                        <h3>🎨 스타일</h3>
                        <div className="style-grid">
                            {IMAGE_STYLES.map(style => {
                                const isActive = selectedStyle.id === style.id;
                                return (
                                    <div
                                        key={style.id}
                                        className={`style-card ${isActive ? 'active' : ''}`}
                                        onClick={() => setSelectedStyle(style)}
                                        style={!isActive ? { background: style.bg } : {}}
                                    >
                                        <div className="style-name" style={!isActive ? { color: style.color } : {}}>{style.name}</div>
                                        <div className="style-desc" style={!isActive ? { color: style.color, opacity: 0.7 } : {}}>{style.desc}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {renderCharacterGrid()}

                {generationStatus === 'generating'
                    ? renderGenerationProgress()
                    : (viewMode === 'grid' ? renderGridView() : renderTimelineView())
                }
                {renderCharacterProgressModal()}

                <div className="page-nav">
                    <button className="btn-nav" onClick={() => router.push(projectId ? `/json-generation?projectId=${projectId}` : '/json-generation')}>← 이전 페이지</button>
                    <button className="btn-nav primary" onClick={() => router.push(projectId ? `/project?id=${projectId}&step=tts` : '/projects?filter=active')}>다음 페이지 →</button>
                </div>

            </div>

            {/* 이미지 디테일 모달 */}
            {renderImageDetailModal()}

            {/* 하단 액션 */}
            <footer className="page-footer">
                <button
                    className="btn-back"
                    onClick={() => {
                        if (projectId) {
                            router.push(`/json-generation?projectId=${projectId}`);
                        } else {
                            router.push('/json-generation');
                        }
                    }}
                >
                    ← 이전 단계
                </button>

                <div className="footer-stats">
                    <div className="stat">
                        <span className="stat-label">최근 성공:</span>
                        <span className="stat-value">{successCount}</span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">최근 실패:</span>
                        <span className="stat-value error">{failCount}</span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">생성 완료:</span>
                        <span className="stat-value">
                            {Object.keys(generatedImages).length} / {scenes.length}
                        </span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">전체 실패:</span>
                        <span className="stat-value error">
                            {Object.keys(errors).length}
                        </span>
                    </div>
                </div>

                <button
                    className="btn-next"
                    onClick={handleProceedToTTS}
                    disabled={Object.keys(generatedImages).length < scenes.length}
                >
                    다음 단계: TTS 생성 →
                </button>
            </footer>
                </div>
            </div>

            <style jsx>{`
        .image-generation-container {
            height: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
            background: transparent;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 24px;
        }
        .section-card {
            background: #fff;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.05);
        }

        .page-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 24px;
            background: #fff;
            border-bottom: 1px solid #d4d4d4;
        }

        .header-center {
            text-align: center;
        }

        .header-center h1 {
            font-size: 20px;
            font-weight: 700;
            margin: 0;
            color: #1a202c;
        }

        .subtitle {
            font-size: 13px;
            color: #718096;
        }

        .step-indicator {
            font-size: 14px;
            font-weight: 600;
            color: #553c9a;
            background: rgba(85, 60, 154, 0.1);
            padding: 6px 12px;
            border-radius: 20px;
        }

        .back-btn {
            border: none;
            background: none;
            color: #718096;
            cursor: pointer;
            font-size: 14px;
        }

        .control-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 24px;
            background: #fff;
            border-bottom: 1px solid #d4d4d4;
            margin-bottom: 1px;
        }

        .project-info h3 {
            font-size: 18px;
            margin: 0 0 4px 0;
            color: #1a202c;
        }

        .info-badge {
            font-size: 13px;
            color: #718096;
        }

        .control-actions {
            display: flex;
            gap: 12px;
        }

        .btn-control {
            padding: 8px 16px;
            border: 1px solid #cbd5e0;
            background: #fff;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            color: #2d3748;
        }

        .btn-control.primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            border-color: transparent;
        }

        .btn-control:disabled {
            background: #e2e8f0;
            color: #a0aec0;
            cursor: not-allowed;
            border-color: #e2e8f0;
        }

        .image-content {
            flex: 1;
            padding: 6px 16px;
            overflow-y: auto;
            background: #f0f0f0;
        }

        /* 그리드 뷰 */
        .images-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 20px;
        }

        .image-card {
        background: white;
        border-radius: 12px;
        overflow: hidden;
        border: 2px solid #E0E0E0;
        transition: all 0.3s;
        cursor: pointer;
        position: relative;
        }

        .image-card:hover {
        border-color: #9ca3af;
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        }

        .image-card.completed {
        border-color: #4CAF50;
        }

        .image-card.error {
        border-color: #FF6B6B;
        }

        .image-card-new {
            position: relative;
        }

        .spinner-overlay {
            position: absolute;
            top: 12px;
            right: 12px;
            background: rgba(0, 0, 0, 0.7);
            color: #fff;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
            z-index: 5;
        }

        .card-header {
        padding: 12px 16px;
        background: #FAFAFA;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #E0E0E0;
        }

        .scene-badge {
        background: #667eea;
        color: white;
        padding: 4px 12px;
        border-radius: 12px;
        font-weight: 700;
        font-size: 13px;
        }

        .duration-badge {
            color: #666;
            font-size: 13px;
            font-weight: 600;
        }

        .style-selection-section {
            margin-bottom: 10px;
            background: #fff;
            padding: 12px 16px;
            border-radius: 12px;
            border: 1px solid #d4d4d4;
            box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }

        .ratio-selection {
            margin-bottom: 12px;
        }

        .ratio-selection h3, .style-grid-container h3 {
            margin: 0 0 6px 0;
            font-size: 16px;
            font-weight: 700;
            color: #1a202c;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .ratio-toggle {
            display: flex;
            gap: 8px;
            width: 100%;
        }

        .ratio-btn {
            flex: 1;
            padding: 10px 16px;
            border-radius: 999px;
            border: 1px solid #d4d4d4;
            background: #fff;
            color: #718096;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .ratio-btn.active {
            background: #5b21b6;
            color: #fff;
            border-color: #5b21b6;
            box-shadow: 0 10px 20px rgba(79, 70, 229, 0.3);
        }

        .style-grid-container {
            margin-top: 12px;
        }

        .style-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 16px;
        }

        .style-card {
            border-radius: 14px;
            padding: 10px 12px;
            min-height: 58px;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s, border 0.2s;
            border: 1px solid transparent;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        .style-card.active {
            border-color: #5b21b6;
            background: #eef2ff;
            transform: translateY(-2px);
            box-shadow: 0 12px 24px rgba(79, 70, 229, 0.25);
        }

        .style-name {
            font-weight: 700;
            font-size: 14px;
        }

        .style-desc {
            font-size: 12px;
            color: #475569;
            line-height: 1.4;
        }

        .style-card {
            border: 1px solid rgba(0,0,0,0.08);
            border-radius: 6px;
            padding: 6px 8px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .style-card:hover {
            border-color: rgba(0,0,0,0.2);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .style-card.active {
            background: #667eea !important;
            border-color: #667eea;
            color: #fff;
        }

        .style-name {
            font-size: 11px;
            font-weight: 700;
        }

        .style-card.active .style-name {
            color: #fff !important;
        }

        .style-desc {
            font-size: 10px;
            line-height: 1.2;
        }

        .style-card.active .style-desc {
            color: rgba(255,255,255,0.85) !important;
            opacity: 1 !important;
        }

        .image-area {
        position: relative;
        aspect-ratio: 16/9;
        background: #F0F0F0;
        overflow: hidden;
        }

        .generated-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        }

        .image-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s;
        }

        .image-card:hover .image-overlay {
        opacity: 1;
        }

        .btn-overlay {
        padding: 8px 16px;
        background: white;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        }

        .btn-overlay:hover {
        background: #667eea;
        color: white;
        transform: scale(1.05);
        }

        .pending-state,
        .error-state {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #999;
        }

        .pending-icon,
        .error-icon {
        font-size: 48px;
        margin-bottom: 12px;
        }

        .error-message {
        color: #e53e3e;
        font-size: 13px;
        text-align: center;
        padding: 0 16px;
        margin-bottom: 12px;
        }

        .btn-retry {
        padding: 8px 16px;
        background: #e53e3e;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        }

        .card-body {
            padding: 12px 16px;
            border-bottom: 1px solid #edf2f7;
        }

        .scene-text {
            font-size: 13px;
            color: #4a5568;
            margin: 0;
            line-height: 1.5;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .card-footer {
            padding: 12px 16px;
            text-align: center;
        }

        .btn-show-prompt {
            border: 1px solid #e2e8f0;
            background: white;
            color: #718096;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            width: 100%;
        }

        .btn-show-prompt:hover {
            background: #f7fafc;
        }

        /* 진행 상태 */
        .generation-progress {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 500px;
        padding: 40px;
        }

        .progress-animation {
        position: relative;
        width: 120px;
        height: 120px;
        margin-bottom: 32px;
        }

        .rotating-icon {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 48px;
        animation: rotate 3s linear infinite;
        }

        @keyframes rotate {
        to { transform: rotate(360deg); }
        }

        .pulse-rings {
        position: absolute;
        inset: 0;
        }

        .pulse-ring {
        position: absolute;
        inset: -20px;
        border: 3px solid #667eea;
        border-radius: 50%;
        opacity: 0;
        animation: pulse 2s ease-out infinite;
        }

        .pulse-ring:nth-child(2) {
        animation-delay: 0.7s;
        }

        .pulse-ring:nth-child(3) {
        animation-delay: 1.4s;
        }

        @keyframes pulse {
        0% {
            transform: scale(0.5);
            opacity: 1;
        }
        100% {
            transform: scale(1.2);
            opacity: 0;
        }
        }

        .progress-bar-container {
        width: 100%;
        max-width: 500px;
        margin: 24px 0;
        }

        .progress-bar {
        height: 12px;
        background: #e2e8f0;
        border-radius: 6px;
        overflow: hidden;
        }

        .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #667eea, #764ba2);
        transition: width 0.3s;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 8px;
        }

        .progress-text {
        color: white;
        font-size: 11px;
        font-weight: 700;
        }

        .progress-stats {
        display: flex;
        gap: 32px;
        margin-top: 24px;
        }

        .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        }

        .stat-icon {
        font-size: 24px;
        }

        .stat-count {
        font-size: 28px;
        font-weight: 700;
        color: #1a202c;
        }

        .stat-item.success .stat-count {
        color: #38a169;
        }

        .stat-item.error .stat-count {
        color: #e53e3e;
        }

        .current-scene {
            color: #718096;
            font-size: 14px;
        }

        .generation-tips {
            text-align: center;
            margin-top: 32px;
            color: #718096;
            font-size: 14px;
            line-height: 1.6;
        }

        /* 모달 */
        .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
        }

        .modal-content {
        background: #fff;
        border-radius: 16px;
        max-width: 800px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
        border: 1px solid #d4d4d4;
        box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }

        .modal-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 36px;
        height: 36px;
        border: none;
        background: #f0f0f0;
        border-radius: 50%;
        cursor: pointer;
        font-size: 20px;
        z-index: 10;
        color: #4a5568;
        }

        .modal-header {
            padding: 20px 24px;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .modal-header h2 {
            margin: 0;
            font-size: 18px;
            color: #1a202c;
        }

        .time-badge {
            background: #f0f0f0;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 13px;
            color: #718096;
        }

        .modal-body {
            padding: 24px;
        }

        .modal-image {
        width: 100%;
        border-radius: 8px;
        }

        .modal-section {
            margin-top: 24px;
        }

        .modal-section h3 {
            font-size: 16px;
            margin-bottom: 8px;
            color: #1a202c;
        }

        .modal-text {
            color: #4a5568;
            line-height: 1.6;
        }

        .modal-prompt {
        font-family: 'Monaco', monospace;
        font-size: 13px;
        background: #f7fafc;
        padding: 12px;
        border-radius: 6px;
        color: #553c9a;
        line-height: 1.6;
        border: 1px solid #e2e8f0;
        }

        .metadata-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            background: #f7fafc;
            padding: 16px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }

        .metadata-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .metadata-item .label {
            font-size: 12px;
            color: #718096;
        }

        .metadata-item .value {
            font-size: 14px;
            font-weight: 500;
            color: #1a202c;
        }

        .modal-actions {
            padding: 24px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        }

        .btn-modal {
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            border: 1px solid #cbd5e0;
            background: #fff;
            color: #2d3748;
        }

        .btn-modal.primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            border: none;
        }

        .page-footer {
            padding: 10px 24px;
            background: #fff;
            border-top: 1px solid #d4d4d4;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .footer-stats {
            display: flex;
            gap: 24px;
        }

        .stat-label {
            color: #718096;
            margin-right: 8px;
            font-size: 14px;
        }

        .stat-value {
            font-weight: 700;
            font-size: 16px;
            color: #1a202c;
        }

        .stat-value.error {
            color: #e53e3e;
        }

        .btn-next {
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            border: none;
            border-radius: 8px;
            font-weight: 700;
            cursor: pointer;
        }

        .btn-next:disabled {
            background: #e2e8f0;
            color: #a0aec0;
            cursor: not-allowed;
            box-shadow: none;
        }

        .btn-back {
            padding: 12px 24px;
            background: #fff;
            border: 1px solid #cbd5e0;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            color: #718096;
        }

        .btn-back:hover {
            background: #f7fafc;
            color: #2d3748;
        }
        /* New Scene UI Styles */
        .full-grid-view {
            width: 100%;
            min-width: 0;
        }

        .grid-view-container {
            display: flex;
            flex-direction: column;
            gap: 20px;
            width: 100%;
            min-width: 0;
        }

        .section-header-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 6px;
            border-bottom: 1px solid #d4d4d4;
        }

        .header-title {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .bar-icon {
            font-size: 18px;
            font-weight: 700;
        }

        .bar-pink { color: #9f7aea; }
        .bar-blue { color: #667eea; }

        .header-title h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: #1a202c;
        }

        .header-actions {
            display: flex;
            gap: 12px;
        }

        .btn-select-all, .btn-download-all {
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn-select-all {
            background: transparent;
            border: 1px solid #cbd5e0;
            color: #2d3748;
        }

        .section-character .btn-select-all {
            border-color: #9f7aea;
            color: #553c9a;
        }
        .section-character .btn-select-all.active {
            background: #9f7aea;
            color: #fff;
            border-color: #9f7aea;
        }

        .section-thumbnail .btn-select-all {
            border-color: #667eea;
            color: #4c51bf;
        }
        .section-thumbnail .btn-select-all.active {
            background: #667eea;
            color: #fff;
            border-color: #667eea;
        }

        .btn-download-all {
            background: transparent;
            border: 1px solid #cbd5e0;
            color: #718096;
        }

        .btn-download-all:hover {
            color: #2d3748;
            background: #f7fafc;
        }

        .btn-download-all:disabled {
            color: #cbd5e0;
            cursor: not-allowed;
            background: transparent;
        }
        .timeline-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 16px;
        }
        .timeline-card {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
            display: flex;
            flex-direction: column;
            min-height: 100px;
        }
        .timeline-card.pending {
            border-color: #cbd5e0;
        }
        .timeline-card-image {
            width: 100%;
            height: 120px;
            overflow: hidden;
            border-bottom: 1px solid #e2e8f0;
            background: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .timeline-card image, .timeline-card img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .timeline-placeholder-card {
            font-size: 12px;
            color: #64748b;
        }
        .timeline-card-body {
            padding: 12px 14px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .timeline-card-header {
            padding: 10px 14px;
            display: flex;
            justify-content: space-between;
            background: #f9fafb;
            border-bottom: 1px solid #e2e8f0;
            font-weight: 600;
            font-size: 13px;
            color: #1f2937;
        }
        .timeline-card-character {
            display: flex;
            flex-direction: column;
            font-size: 12px;
            color: #4c51bf;
        }
        .character-role {
            font-size: 11px;
            color: #475569;
        }
        .timeline-card-body p {
            margin: 0;
            font-size: 12px;
            color: #1f2937;
            line-height: 1.4;
        }

        .image-card-new {
            background: #fff;
            border: 1px solid #d4d4d4;
            border-radius: 16px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            cursor: pointer;
            min-width: 0;
        }

        .image-card-new:hover {
            transform: translateY(-4px);
            box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
            border-color: #9ca3af;
        }

        .image-card-new.selected {
            border: 2px solid #667eea;
            box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.25);
        }

        .card-image-area {
            position: relative;
            width: 100%;
            background: #e8e8e8;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }

        .ratio-16-9 { aspect-ratio: 16/9; }
        .ratio-9-16 { aspect-ratio: 9/16; }

        .card-overlay-top {
            position: absolute;
            top: 12px;
            left: 12px;
            right: 12px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            z-index: 10;
            pointer-events: none;
        }

        .scene-number-badge-new {
            background: rgba(0, 0, 0, 0.6);
            color: white;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 700;
            backdrop-filter: blur(4px);
        }

        .checkbox-custom {
            width: 24px;
            height: 24px;
            border-radius: 6px;
            border: 2px solid rgba(255,255,255,0.5);
            background: rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 14px;
            font-weight: 900;
            cursor: pointer;
            pointer-events: auto;
            transition: all 0.2s;
        }

        .section-character .character-card.selected .checkbox-custom {
            background: #9f7aea;
            border-color: #9f7aea;
        }

        .section-thumbnail .image-card-new.selected .checkbox-custom {
            background: #667eea;
            border-color: #667eea;
        }

        .generated-image-new {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.5s;
        }

        .image-card-new:hover .generated-image-new {
            transform: scale(1.05);
        }

        .placeholder-pending, .placeholder-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #a0aec0;
            font-weight: 800;
            font-size: 24px;
            letter-spacing: 2px;
            font-style: italic;
        }

        .placeholder-error {
            color: #e53e3e;
            font-size: 14px;
            font-style: normal;
        }

        .hover-actions {
            position: absolute;
            bottom: 12px;
            right: 12px;
            display: flex;
            gap: 8px;
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.3s;
        }

        .image-card-new:hover .hover-actions {
            opacity: 1;
            transform: translateY(0);
        }

        .btn-action-icon {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #fff;
            border: 1px solid #d4d4d4;
            color: #4a5568;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.2s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .btn-action-icon:hover {
            background: #667eea;
            color: #fff;
            border-color: #667eea;
        }

        .card-info-area {
            padding: 12px 14px;
            border-top: 1px solid #e2e8f0;
            background: #fff;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .scene-caption {
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-size: 13px;
            color: #1e293b;
        }

        .scene-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 700;
            color: #1a202c;
        }

        .scene-number {
            font-size: 14px;
        }

        .scene-time {
            font-size: 12px;
            color: #64748b;
            font-weight: 500;
        }

        .scene-caption p {
            margin: 0;
            line-height: 1.5;
            font-size: 13px;
            color: #475569;
        }

        .page-nav {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 12px 24px;
        }
        .btn-nav {
            padding: 8px 16px;
            border-radius: 8px;
            border: 1px solid #cbd5e0;
            background: #fff;
            cursor: pointer;
            font-weight: 600;
        }
        .btn-nav.primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            border-color: transparent;
        }

        .scenes-grid {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 20px;
            width: 100%;
            min-width: 0;
        }

        .scenes-grid.scenes-grid-compact {
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
            gap: 14px;
        }

        .thumbnail-box {
            background: #fff;
            border: 1px solid #d4d4d4;
            border-radius: 12px;
            padding: 12px 16px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }

        .thumbnail-box .image-card-new {
            border-radius: 10px;
        }

        .thumbnail-box .card-image-area.ratio-16-9 {
            aspect-ratio: 16/9 !important;
        }
        .thumbnail-box .card-image-area.ratio-9-16 {
            aspect-ratio: 9/16 !important;
        }

        .thumbnail-box .card-info-area {
            padding: 8px 10px;
        }

        .thumbnail-box .info-title {
            font-size: 12px;
        }

        .thumbnail-box .info-desc {
            font-size: 11px;
            -webkit-line-clamp: 1;
            line-height: 1.3;
        }

        .thumbnail-box .scene-number-badge-new {
            font-size: 10px;
            padding: 2px 6px;
        }

        .thumbnail-box .card-overlay-top {
            top: 6px;
            left: 6px;
            right: 6px;
        }

        .thumbnail-box .checkbox-custom {
            width: 18px;
            height: 18px;
            font-size: 11px;
            border-radius: 4px;
        }

        .thumbnail-box .hover-actions {
            bottom: 6px;
            right: 6px;
            gap: 4px;
        }

        .thumbnail-box .btn-action-icon {
            width: 24px;
            height: 24px;
            font-size: 12px;
        }

        .thumbnail-box .placeholder-pending,
        .thumbnail-box .placeholder-error {
            font-size: 14px;
            letter-spacing: 1px;
        }

      `}</style>

            <style jsx global>{`
                    /* 캐릭터 박스 */
                    .char-box {
                        background: #fff;
                        border: 1px solid #d4d4d4;
                        border-radius: 12px;
                        padding: 12px 16px;
                        margin-bottom: 10px;
                        box-shadow: 0 2px 12px rgba(0,0,0,0.06);
                    }
                    .char-box-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 8px;
                        padding-bottom: 8px;
                        border-bottom: 1px solid #e2e8f0;
                    }
                    .char-box-title {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .char-box-actions {
                        display: flex;
                        gap: 8px;
                        align-items: center;
                    }
                    .char-box-title h3 {
                        margin: 0;
                        font-size: 16px;
                        font-weight: 700;
                        color: #1a202c;
                    }
                    .char-box-count {
                        font-size: 13px;
                        color: #718096;
                        background: #f0f0f0;
                        padding: 2px 10px;
                        border-radius: 10px;
                        font-weight: 600;
                    }
                    .btn-char-generate {
                        padding: 6px 16px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: #fff;
                        border: none;
                        border-radius: 6px;
                        font-size: 13px;
                        font-weight: 600;
                        cursor: pointer;
                    }
                    .btn-char-generate:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    .btn-char-regenerate {
                        padding: 6px 16px;
                        background: #facc15;
                        color: #572d01;
                        border: none;
                        border-radius: 6px;
                        font-size: 13px;
                        font-weight: 600;
                        cursor: pointer;
                        margin-left: 6px;
                    }
                    .btn-char-regenerate:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }

                    .char-list {
                        display: flex;
                        gap: 12px;
                        overflow-x: auto;
                        padding-bottom: 4px;
                    }
                    .character-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 20px;
                    }
                    .char-item {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 8px;
                        min-width: 160px;
                        max-width: 160px;
                        padding: 12px 10px;
                        border: 2px solid #e2e8f0;
                        border-radius: 12px;
                        background: #fafafa;
                        transition: all 0.2s;
                    }
                    .char-item.active {
                        border-color: #667eea;
                        background: #f0f4ff;
                        box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
                    }

                    .char-thumb {
                        width: 80px;
                        height: 80px;
                        border-radius: 8px;
                        overflow: hidden;
                        background: #e2e8f0;
                        flex-shrink: 0;
                    }
                    .char-thumb img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                    .char-empty, .char-loading {
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 20px;
                        font-weight: 700;
                        color: #a0aec0;
                        background: #edf2f7;
                    }
                    .char-loading {
                        font-size: 14px;
                        animation: pulse-text 1.5s ease-in-out infinite;
                    }
                    @keyframes pulse-text {
                        0%, 100% { opacity: 0.4; }
                        50% { opacity: 1; }
                    }

                    .char-meta {
                        text-align: center;
                        line-height: 1.3;
                    }
                    .char-meta-name {
                        font-size: 13px;
                        font-weight: 700;
                        color: #1a202c;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        max-width: 140px;
                    }
                    .char-meta-role {
                        font-size: 11px;
                        color: #718096;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        max-width: 140px;
                    }

                    .char-actions {
                        display: flex;
                        gap: 6px;
                        width: 100%;
                    }
                    .btn-char-apply, .btn-char-regen, .btn-char-custom {
                        flex: 1;
                        padding: 4px 0;
                        border-radius: 6px;
                        font-size: 11px;
                        font-weight: 600;
                        cursor: pointer;
                        border: 1px solid #d4d4d4;
                        background: #fff;
                        color: #4a5568;
                        transition: all 0.15s;
                    }
                    .btn-char-apply:hover {
                        background: #eef2ff;
                        border-color: #667eea;
                        color: #667eea;
                    }
                    .btn-char-apply.active {
                        background: #667eea;
                        color: #fff;
                        border-color: #667eea;
                    }
                    .btn-char-regen:hover {
                        background: #f0f0f0;
                        border-color: #9ca3af;
                    }
                    .btn-char-regen:disabled {
                        opacity: 0.4;
                        cursor: not-allowed;
                    }
                    .btn-char-custom {
                        line-height: 1.2;
                        padding: 3px 0 !important;
                        font-size: 10px !important;
                        text-align: center;
                    }
                    .btn-char-custom:hover {
                        background: #f0fff4;
                        border-color: #38a169;
                        color: #38a169;
                    }

                    /* 썸네일 그리드 global */
                    .image-generation-container .scenes-grid.scenes-grid-compact {
                        display: grid !important;
                        grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
                        gap: 14px !important;
                        width: 100% !important;
                    }
                    .thumbnail-box .card-image-area.ratio-16-9 {
                        aspect-ratio: 16/9 !important;
                    }
                    .thumbnail-box .card-image-area.ratio-9-16 {
                        aspect-ratio: 9/16 !important;
                    }
                    .thumbnail-box .card-image-area img {
                        width: 100% !important;
                        height: 100% !important;
                        object-fit: cover !important;
                    }

                    /* 스타일 그리드 global (styled-jsx 스코핑 회피) */
                    .style-selection-section .style-grid {
                        display: grid !important;
                        grid-template-columns: repeat(6, 1fr) !important;
                        gap: 8px !important;
                    }
                    .style-selection-section .style-card {
                        border: 1px solid rgba(0,0,0,0.08);
                        border-radius: 6px;
                        padding: 8px 10px;
                        cursor: pointer;
                        transition: all 0.2s;
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                    }
                    .style-selection-section .style-card:hover {
                        border-color: rgba(0,0,0,0.2);
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    }
                    .style-selection-section .style-card.active {
                        background: #667eea !important;
                        border-color: #667eea !important;
                    }
                    .style-selection-section .style-card .style-name {
                        font-size: 11px;
                        font-weight: 700;
                    }
                    .style-selection-section .style-card.active .style-name {
                        color: #fff !important;
                    }
                    .style-selection-section .style-card .style-desc {
                        font-size: 10px;
                        line-height: 1.2;
                    }
                    .style-selection-section .style-card.active .style-desc {
                        color: rgba(255,255,255,0.85) !important;
                        opacity: 1 !important;
                    }
                `}</style>
            </div>
        </StudioLayout>
    );
};

export default ImageGeneration;
