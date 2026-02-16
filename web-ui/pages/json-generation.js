import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import StudioLayout from '../components/StudioLayout';
import { fetchProject, updateProject } from '../lib/api';

const JSONGeneration = () => {
    const router = useRouter();
    const projectId = Array.isArray(router.query.projectId)
        ? router.query.projectId[0]
        : router.query.projectId;
    const [blueprint, setBlueprint] = useState(null);
    const [generatedScript, setGeneratedScript] = useState('');
    const [scenes, setScenes] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedScene, setSelectedScene] = useState(null);
    const [viewMode, setViewMode] = useState('all-scenes'); // 'all-scenes' | 'timeline' | 'json'
    const [loading, setLoading] = useState(true);

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [scriptHash, setScriptHash] = useState(null);
    const [showCharModal, setShowCharModal] = useState(false);
    const [newCharacter, setNewCharacter] = useState({ name: '', role: '', description: '', descriptionKo: '', userInput: '', imageDataUrl: '' });

    // 캐릭터 분석 데이터
    const [characters, setCharacters] = useState([]);

    // 내레이터 1명 항상 유지 (남/녀 랜덤)
    const getDefaultNarrator = () => {
        const isFemale = Math.random() >= 0.5;
        const description = isFemale
            ? 'A female narrator or presenter, professional, modern style, trustworthy and clear voice, suitable for documentary or educational video.'
            : 'A male narrator or presenter, professional, modern style, trustworthy and clear voice, suitable for documentary or educational video.';
        const descriptionKo = isFemale
            ? '여성 내레이터 또는 진행자, 전문적이고 현대적인 스타일, 신뢰감 있고 선명한 목소리, 다큐멘터리나 교육 영상에 적합합니다.'
            : '남성 내레이터 또는 진행자, 전문적이고 현대적인 스타일, 신뢰감 있고 선명한 목소리, 다큐멘터리나 교육 영상에 적합합니다.';
        return {
            id: 'narrator_default',
            name: '내레이터',
            role: '1인 내레이션',
            description,
            descriptionKo,
            userInput: ''
        };
    };
    const ensureNarrator = (list) => {
        const arr = Array.isArray(list) ? list : [];
        const hasNarrator = arr.some(c => c.id === 'narrator_default' || (c.role === '1인 내레이션' && c.name === '내레이터'));
        if (!hasNarrator) return [getDefaultNarrator(), ...arr];
        return arr.map(c => {
            const isNarrator = c.id === 'narrator_default' || (c.role === '1인 내레이션' && c.name === '내레이터');
            if (!isNarrator) return c;
            if (c.descriptionKo != null && String(c.descriptionKo).trim() !== '') return c;
            const descEn = (c.description || '').toLowerCase();
            const descriptionKo = descEn.includes('female')
                ? '여성 내레이터 또는 진행자, 전문적이고 현대적인 스타일, 신뢰감 있고 선명한 목소리, 다큐멘터리나 교육 영상에 적합합니다.'
                : '남성 내레이터 또는 진행자, 전문적이고 현대적인 스타일, 신뢰감 있고 선명한 목소리, 다큐멘터리나 교육 영상에 적합합니다.';
            return { ...c, descriptionKo };
        });
    };

    const getPlaceholderCharacter = (uniqueId) => ({
        id: typeof uniqueId === 'number' ? `char_slot_${uniqueId}` : uniqueId,
        name: '',
        role: '',
        description: '',
        descriptionKo: '',
        userInput: ''
    });

    const ensureMinimumCards = (list, minCount = 3) => {
        let arr = ensureNarrator(list);
        const need = minCount - arr.length;
        if (need <= 0) return arr;
        const placeholders = [];
        const base = Date.now();
        for (let i = 0; i < need; i++) {
            placeholders.push(getPlaceholderCharacter(`char_slot_${base}_${i}`));
        }
        return [...arr, ...placeholders];
    };

    useEffect(() => {
        if (!router.isReady) return;
        loadData();
    }, [router.isReady, projectId]);

    useEffect(() => {
        if (router.isReady && !projectId && characters.length === 0) {
            setCharacters(ensureMinimumCards([]));
        }
    }, [router.isReady, projectId]);

    const loadData = async () => {
        try {
            console.log('━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📍 Loading JSON Generation Page');
            console.log('━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📋 ProjectId:', projectId);

            setLoading(true);
            let scriptText = '';
            let project = null; // 프로젝트 변수를 상위 스코프에 선언
            let resolvedScenes = null; // 프로젝트 → localStorage → 자동생성 순으로 채움

            // 1. 프로젝트 데이터에서 대본 가져오기 (우선순위 1)
            if (projectId) {
                try {
                    project = await fetchProject(projectId);
                    console.log('📦 Project loaded:', {
                        scenesCount: project?.scenes?.length || 0,
                        hasScenes: !!project?.scenes?.length,
                        hasScript: !!project?.script,
                        scriptLength: project?.script?.length || 0,
                        firstSceneText: project?.scenes?.[0]?.text?.substring(0, 50),
                        firstSceneNarration: project?.scenes?.[0]?.narration_ko?.substring(0, 50)
                    });

                    // 대본 가져오기: 우선순위 1) project.script, 2) scenes 배열의 첫 번째 씬
                    if (project?.script && project.script.trim()) {
                        // project.script 필드에서 대본 가져오기 (대본 생성 페이지에서 저장한 대본)
                        scriptText = project.script.trim();
                        console.log('✅ Script found in project.script:', scriptText.substring(0, 100));
                    } else if (project?.scenes?.length > 0) {
                        // scenes 배열에서 대본 가져오기 (기존 데이터)
                        const firstScene = project.scenes[0];
                        scriptText = firstScene.text || firstScene.narration_ko || firstScene.narration_en || '';
                        console.log('✅ Script found in project.scenes:', scriptText.substring(0, 100));
                    }

                    // 기존 scenes가 있으면 로드 (duration, startTime, endTime이 없으면 기본값 설정)
                    if (project?.scenes?.length > 0) {
                        let currentTime = 0;
                        const normalizedScenes = project.scenes.map((scene, idx) => {
                            const duration = scene.duration || scene.durationSec || 5;
                            const startTime = scene.startTime !== undefined ? scene.startTime : currentTime;
                            const endTime = scene.endTime !== undefined ? scene.endTime : (startTime + duration);
                            currentTime = endTime;
                            return {
                                ...scene,
                                duration: duration,
                                startTime: startTime,
                                endTime: endTime,
                                text: scene.text || scene.narration_ko || scene.narration_en || '',
                                imagePrompt: scene.imagePrompt || scene.prompt || '',
                                sequence: scene.sequence || idx + 1
                            };
                        });
                        resolvedScenes = normalizedScenes;
                    }
                } catch (error) {
                    console.warn('⚠️ Failed to load project, trying localStorage:', error);
                    project = null; // 에러 발생 시 null로 설정
                }
            }

            // 2. 프로젝트에서 대본을 찾지 못했으면 localStorage 확인 (우선순위 2)
            if (!scriptText || scriptText.trim() === '') {
                const savedScript = localStorage.getItem('generatedScript');
                console.log('📜 Script from localStorage:', savedScript?.substring(0, 100));
                scriptText = savedScript || '';
            }

            // 3. 대본이 없으면 에러
            if (!scriptText || scriptText.trim() === '') {
                console.error('❌ No script found in project or localStorage');
                alert('대본 정보가 없습니다. 먼저 대본 편집에서 대본을 입력해주세요.');
                if (projectId) {
                    router.push(`/project?id=${projectId}&step=script`);
                } else {
                    router.push('/script-generation');
                }
                return;
            }

            console.log('✅ Script found:', scriptText.substring(0, 100));
            setGeneratedScript(scriptText);

            // 4. Blueprint 가져오기 (우선순위 1: 프로젝트, 2: localStorage)
            let blueprintData = null;

            // 프로젝트에서 blueprint 가져오기
            if (projectId && project?.blueprint) {
                try {
                    blueprintData = typeof project.blueprint === 'string'
                        ? JSON.parse(project.blueprint)
                        : project.blueprint;
                    console.log('✅ Blueprint loaded from project:', blueprintData);
                } catch (e) {
                    console.error('❌ Failed to parse project blueprint:', e);
                }
            }

            // 프로젝트에서 가져오지 못했으면 localStorage 확인
            if (!blueprintData) {
                const savedBlueprint = localStorage.getItem('step2Blueprint');
                console.log('⚙️ Blueprint from localStorage:', savedBlueprint ? 'found' : 'not found');
                if (savedBlueprint) {
                    try {
                        blueprintData = JSON.parse(savedBlueprint);
                        console.log('✅ Blueprint parsed from localStorage:', blueprintData);
                    } catch (e) {
                        console.error('❌ Blueprint parse error:', e);
                        blueprintData = { topic: project?.title || '제목 없음', length: 60 };
                    }
                }
            }

            // 기본값 설정
            if (!blueprintData) {
                blueprintData = {
                    topic: project?.title || '제목 없음',
                    length: 60,
                    tone: 'casual',
                    coreMessage: scriptText ? `${scriptText.substring(0, 50)}...` : '',
                    viewerPainPoint: '',
                    targetAudience: 'general',
                    style: 'shorts',
                    scriptStructure: 'hook',
                    hookType: ['question'],
                    emotionIntensity: 3
                };
                console.log('⚠️ Using default blueprint');
            }

            setBlueprint(blueprintData);

            // 5. 장면이 없으면 localStorage에서 로드 시도
            if (!resolvedScenes) {
                const savedScenes = localStorage.getItem('scenes');
                if (savedScenes) {
                    try {
                        const parsed = JSON.parse(savedScenes);
                        if (Array.isArray(parsed) && parsed.length > 0) resolvedScenes = parsed;
                    } catch (e) {
                        console.error('Failed to parse scenes', e);
                    }
                }
            }

            // 6. 캐릭터 정보 먼저 로드 (장면 자동 생성 시 캐릭터 포함 일관성 유지)
            let loadedCharacters = [];
            const savedCharacters = localStorage.getItem('characters');
            const savedHash = localStorage.getItem('scriptHash');
            if (savedCharacters && savedHash) {
                try {
                    loadedCharacters = ensureMinimumCards(JSON.parse(savedCharacters) || []);
                    setCharacters(loadedCharacters);
                    setScriptHash(savedHash);
                } catch (e) {
                    console.error('Failed to parse characters', e);
                }
            } else if (scriptText) {
                try {
                    const analyzed = await analyzeCharacters(scriptText, blueprintData?.id || projectId, blueprintData);
                    if (analyzed && Array.isArray(analyzed)) loadedCharacters = analyzed;
                } catch (e) {
                    console.warn('⚠️ Character analysis failed, but continuing:', e);
                }
            }

            // 5b. 대본은 있는데 장면이 없으면 대본에서 장면 골격 자동 생성 (캐릭터가 있으면 모든 이미지 프롬프트에 포함)
            if (!resolvedScenes && scriptText && scriptText.trim() && blueprintData) {
                try {
                    const newScenes = autoGenerateScenes(scriptText.trim(), blueprintData, loadedCharacters);
                    if (newScenes && newScenes.length > 0) {
                        resolvedScenes = newScenes;
                        console.log('✅ Auto-generated', resolvedScenes.length, 'scenes from script');
                    }
                } catch (e) {
                    console.warn('⚠️ Auto-generate scenes failed, continuing with empty list:', e);
                }
            }

            if (resolvedScenes && resolvedScenes.length > 0) {
                setScenes(resolvedScenes);
            }

            setCharacters(prev => ensureMinimumCards(prev));

            console.log('✅ Data loaded successfully');
            console.log('━━━━━━━━━━━━━━━━━━━━━━');
            setLoading(false);

        } catch (error) {
            console.error('❌ Fatal error in loadData:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                projectId: projectId,
                scriptTextLength: scriptText?.length || 0
            });
            setLoading(false);

            // 오류 발생 시 프로젝트 대시보드로 리다이렉트하지 않고, 사용자에게 선택권을 제공
            const shouldRetry = confirm(
                `데이터 로드 중 오류가 발생했습니다.\n\n` +
                `에러: ${error.message || '알 수 없는 오류'}\n\n` +
                `다시 시도하시겠습니까?\n\n` +
                `(취소를 누르면 대본 생성 페이지로 돌아갑니다)`
            );

            if (shouldRetry) {
                // 재시도: loadData 다시 호출
                setTimeout(() => {
                    loadData();
                }, 1000);
            } else {
                // 대본 생성 페이지로 돌아가기 (데이터 유지)
                if (projectId) {
                    router.push(`/script-generation?projectId=${projectId}`);
                } else {
                    router.push('/script-generation');
                }
            }
        }
    };

    // Save scenes to local storage whenever they change
    useEffect(() => {
        if (scenes.length > 0) {
            localStorage.setItem('scenes', JSON.stringify(scenes));
        }
    }, [scenes]);

    // Save characters to local storage
    useEffect(() => {
        localStorage.setItem('characters', JSON.stringify(characters));
        if (scriptHash) {
            localStorage.setItem('scriptHash', scriptHash);
        }
    }, [characters, scriptHash]);

    // 캐릭터 분석 함수
    const analyzeCharacters = async (script, projectId = 'temp', blueprintData = null) => {
        setIsAnalyzing(true);
        try {
            // blueprintData가 전달되면 사용, 없으면 state의 blueprint 사용
            const blueprintToUse = blueprintData || blueprint;
            const pid = blueprintToUse?.id || projectId || 'p_default';
            const response = await fetch(`/api/projects/${pid}/analyze/characters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script: script })
            });

            const data = await response.json();
            if (data.ok) {
                const chars = ensureMinimumCards(data.characters || []);
                setCharacters(chars);
                setScriptHash(data.scriptHash);
                alert(`✅ 캐릭터 분석 완료: ${chars.length}명 발견`);
                return chars;
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Character analysis failed:', error);
            alert('캐릭터 분석 실패: ' + error.message);
            return [];
        } finally {
            setIsAnalyzing(false);
        }
    };

    // 캐릭터 삭제 (내레이터는 삭제 불가)
    const handleDeleteCharacter = (charId) => {
        const target = characters.find(c => c.id === charId);
        if (target && (target.id === 'narrator_default' || (target.role === '1인 내레이션' && target.name === '내레이터'))) {
            alert('내레이터는 삭제할 수 없습니다.');
            return;
        }
        if (!confirm('캐릭터를 삭제하시겠습니까? 관련 씬 설정도 해제됩니다.')) return;

        const updatedChars = characters.filter(c => c.id !== charId);
        setCharacters(ensureMinimumCards(updatedChars));

        // 씬에서 해당 캐릭터 제거 (Not implemented fully in scene yet, but logic would go here)
        // If 0 characters left, backend or generation logic handles fallback
    };

    const readImageAsDataUrl = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleCharacterImageFile = async (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        try {
            const dataUrl = await readImageAsDataUrl(file);
            setNewCharacter(prev => ({ ...prev, imageDataUrl: dataUrl }));
        } catch (e) {
            console.error(e);
            alert('이미지 읽기 실패');
        }
    };

    const handleSetCharacterImage = async (charId, file) => {
        if (!file || !file.type.startsWith('image/')) return;
        try {
            const dataUrl = await readImageAsDataUrl(file);
            setCharacters(prev => prev.map(c => c.id === charId ? { ...c, imageDataUrl: dataUrl } : c));
        } catch (e) {
            console.error(e);
            alert('이미지 읽기 실패');
        }
    };

    const handleRemoveCharacterImage = (charId) => {
        setCharacters(prev => prev.map(c => c.id === charId ? { ...c, imageDataUrl: null, imageUrl: null } : c));
    };

    // 캐릭터 추가
    const handleAddCharacter = () => {
        if (!newCharacter.name) return alert('이름을 입력해주세요.');

        const char = {
            id: 'custom_' + Date.now(),
            name: newCharacter.name,
            role: newCharacter.role || '',
            description: newCharacter.description || `${newCharacter.name}, ${newCharacter.role || ''}, default style`,
            descriptionKo: newCharacter.descriptionKo || '',
            userInput: newCharacter.userInput || '',
            imageDataUrl: newCharacter.imageDataUrl || null
        };

        setCharacters([...characters, char]);
        setShowCharModal(false);
        setNewCharacter({ name: '', role: '', description: '', descriptionKo: '', userInput: '', imageDataUrl: '' });
    };

    // 텍스트 정제 함수
    const cleanScriptText = (rawScript) => {
        let cleaned = rawScript;

        // 구조 표시 제거
        const patterns = [
            /\(오프닝[^)]*\)/gi,
            /\[오프닝[^\]]*\]/gi,
            /\(본론[^)]*\)/gi,
            /\[본론[^\]]*\]/gi,
            /\(결론[^)]*\)/gi,
            /\[결론[^\]]*\]/gi,
            /\(클로징[^)]*\)/gi,
            /\(도입부[^)]*\)/gi,
            /\(마무리[^)]*\)/gi,
            /\(씬\s*\d+[^)]*\)/gi,
            /\[씬\s*\d+[^\]]*\]/gi,
            /\(\d+초[^)]*\)/g,
            /\[배경음악[^\]]*\]/gi,
            /\[효과음[^\]]*\]/gi,
        ];

        patterns.forEach(pattern => {
            cleaned = cleaned.replace(pattern, '');
        });

        // 공백 정리
        cleaned = cleaned
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .replace(/[ \t]+/g, ' ')
            .trim();

        return cleaned;
    };

    // 장면 길이 계산
    const calculateSceneDuration = (text) => {
        const charCount = text.replace(/\s/g, '').length;
        return Math.max(3, Math.ceil(charCount / 4));
    };

    // 주제별 프롬프트 템플릿 정의
    const topicTemplates = {
        '공무원': {
            base: 'government office, civil service, professional workspace',
            scenes: [
                'person studying at desk with books and laptop',
                'organized study materials and notes spread out',
                'focused person writing exam preparation',
                'celebration of exam success, diploma and certificate',
            ]
        },
        '다이소': {
            base: 'Daiso store, budget shopping, colorful products',
            scenes: [
                'colorful Daiso store interior with product displays',
                'hand holding budget-friendly useful items',
                'organized household products on shelves',
                'satisfied customer with shopping basket',
            ]
        },
        '운동': {
            base: 'fitness, exercise, gym, healthy lifestyle',
            scenes: [
                'person doing stretching exercises',
                'active workout routine in gym',
                'healthy lifestyle and fitness motivation',
                'achievement of fitness goals',
            ]
        },
        '요리': {
            base: 'cooking, kitchen, food preparation, culinary',
            scenes: [
                'fresh ingredients on kitchen counter',
                'cooking process with utensils',
                'delicious finished dish presentation',
                'happy person enjoying homemade food',
            ]
        },
        '여행': {
            base: 'travel, tourism, destination, adventure',
            scenes: [
                'beautiful landscape and scenery',
                'tourist exploring new location',
                'happy traveler with backpack',
                'scenic view of destination',
            ]
        },
        '재테크': {
            base: 'investment, finance, money management, savings',
            scenes: [
                'financial growth graph and charts',
                'saving money in piggy bank',
                'calculating budget and expenses',
                'successful financial planning concept',
            ]
        },
        '공부': {
            base: 'study, learning, education, academic',
            scenes: [
                'student reading books in library',
                'taking notes in notebook',
                'focused learning environment',
                'educational materials and laptop',
            ]
        },
        'default': {
            base: 'modern lifestyle, everyday scene, professional photography',
            scenes: [
                'introduction scene with clear message',
                'main content demonstration',
                'detailed explanation or process',
                'conclusion with positive outcome',
            ]
        }
    };

    // 스마트 프롬프트 생성 함수
    const generateSmartPrompt = (sceneText, topic, sceneNumber, totalScenes) => {
        // 1. 주제에 맞는 템플릿 찾기
        let template = topicTemplates['default'];
        if (topic) {
            for (const [key, value] of Object.entries(topicTemplates)) {
                if (topic.includes(key)) {
                    template = value;
                    break;
                }
            }
        }

        // 2. 장면 번호에 따른 설명 선택 (순환)
        const sceneIndex = (sceneNumber - 1) % template.scenes.length;
        const sceneDescription = template.scenes[sceneIndex];

        // 3. 최종 프롬프트 구성 (한글 제거 및 영문 조합)
        const prompt = `
${template.base}, ${sceneDescription}, 
professional photography, high quality, vibrant colors, 
well-lit, sharp focus, detailed, clean composition, 
16:9 aspect ratio, modern aesthetic, engaging visual
        `.trim().replace(/\s+/g, ' ');

        return prompt;
    };

    // 프롬프트 검증 및 정제 함수
    const validateImagePrompt = (prompt) => {
        // 한글 체크
        const hasKorean = /[가-힣]/.test(prompt);

        if (hasKorean) {
            console.warn('⚠️ Korean characters detected in prompt:', prompt);

            // 한글 제거
            let cleaned = prompt.replace(/[가-힣]/g, '').trim();
            // 연속된 특수문자나 공백 정리
            cleaned = cleaned.replace(/[,\s]+,/g, ',').replace(/\s+/g, ' ').trim();

            // 너무 짧아지면 기본 프롬프트 사용
            if (cleaned.length < 20) {
                return 'professional scene, high quality, vibrant colors, 16:9 aspect ratio';
            }

            return cleaned;
        }

        return prompt;
    };

    // 캐릭터가 있으면 모든 이미지 프롬프트에 일관되게 포함할 접두사
    const getCharacterPromptPrefix = (charList) => {
        if (!charList || charList.length === 0) return '';
        const descs = charList
            .map(c => (c.description || c.desc_en || `${c.name}, ${c.role || 'character'}`).replace(/[가-힣]/g, '').trim())
            .filter(Boolean);
        if (descs.length === 0) return '';
        return `featuring ${descs.join(', ')}, `;
    };

    // 프롬프트 개선 함수 (수동)
    const improvePrompt = (currentPrompt) => {
        // 한글 제거
        let improved = currentPrompt.replace(/[가-힣]/g, ' ').trim();

        // 연속 공백 및 콤마 정리
        improved = improved.replace(/\s+/g, ' ').replace(/,\s*,/g, ',');

        // 기본 품질 키워드 추가 (없으면)
        const qualityKeywords = [
            'high quality',
            'professional',
            'detailed',
            'vibrant colors',
            '16:9 aspect ratio'
        ];

        qualityKeywords.forEach(keyword => {
            if (!improved.toLowerCase().includes(keyword.toLowerCase())) {
                improved += `, ${keyword}`;
            }
        });

        return improved;
    };

    // Auto-generate scenes from script (charList: 캐릭터가 있으면 모든 씬 이미지 프롬프트에 포함)
    const autoGenerateScenes = (scriptText, blueprintData, charList = []) => {
        const cleanedScript = cleanScriptText(scriptText);
        const characterPrefix = getCharacterPromptPrefix(charList);

        console.log('━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎬 Auto Generate Scenes Start');
        console.log('Script length:', scriptText?.length);
        console.log('Blueprint:', blueprintData);
        console.log('━━━━━━━━━━━━━━━━━━━━━━');

        if (!scriptText || !blueprintData) {
            console.error('❌ Missing data for scene generation');
            alert('대본 또는 설정 정보가 없습니다.');
            return [];
        }

        try {
            console.log('🧹 Cleaned script:', cleanedScript.substring(0, 200));

            // 2. 문장 분할 (향상된 로직)
            let sentences = cleanedScript
                .split(/[.!?。！？]+/)
                .map(s => s.trim())
                .filter(s => s.length > 5);

            // 만약 문장 분할 결과가 너무 적으면(1개 이하), 줄바꿈으로 다시 시도
            if (sentences.length <= 1) {
                console.log('⚠️ Few sentences found, trying newline split');
                const lineSentences = cleanedScript
                    .split(/\n+/)
                    .map(s => s.trim())
                    .filter(s => s.length > 5);

                if (lineSentences.length > sentences.length) {
                    sentences = lineSentences;
                }
            }

            console.log('📝 Total sentences:', sentences.length);

            if (sentences.length === 0) {
                // 정말 아무것도 없으면 원본이라도 씀
                if (cleanedScript.trim().length > 0) {
                    sentences = [cleanedScript.trim()];
                } else {
                    console.warn('⚠️ No valid sentences found even after fallback');
                    return [];
                }
            }

            // 3. 장면 개수 계산
            const targetLength = blueprintData?.length || 60;
            const avgSceneLength = 5; // 5초
            const targetSceneCount = Math.max(3, Math.ceil(targetLength / avgSceneLength));

            // 문장이 장면 수보다 적으면, 문장을 쪼개지 않고 그냥 1:1 매핑하거나 반복 사용
            // 문장이 너무 많으면 합침
            const sentencesPerScene = Math.max(1, Math.ceil(sentences.length / targetSceneCount));

            console.log('🎯 Target scenes:', targetSceneCount);
            console.log('📊 Sentences per scene:', sentencesPerScene);

            // 4. 장면 생성
            const newScenes = [];
            let currentTime = 0;

            for (let i = 0; i < sentences.length; i += sentencesPerScene) {
                const sceneText = sentences
                    .slice(i, i + sentencesPerScene)
                    .join('. ')
                    .trim() + '.';

                const duration = calculateSceneDuration(sceneText);

                const basePrompt = validateImagePrompt(
                    generateSmartPrompt(
                        sceneText,
                        blueprintData?.topic || 'general',
                        Math.floor(i / sentencesPerScene) + 1,
                        targetSceneCount
                    )
                );
                const scene = {
                    id: `scene_${Date.now()}_${i}`,
                    sequence: Math.floor(i / sentencesPerScene) + 1,
                    text: sceneText,
                    duration: duration,
                    startTime: currentTime,
                    endTime: currentTime + duration,
                    imagePrompt: characterPrefix ? (characterPrefix + basePrompt).replace(/\s+/g, ' ').trim() : basePrompt,
                    imageStyle: 'vibrant',
                    imageUrl: null,
                    transition: 'none',
                    effects: {
                        zoom: false,
                        pan: false,
                        kenBurns: false,
                        textAnimation: 'none'
                    },
                    characterId: (() => {
                        if (!charList || charList.length === 0) return null;
                        const match = charList.find(c => sceneText.includes(c.name));
                        return match ? match.id : null;
                    })()
                };

                newScenes.push(scene);
                currentTime += duration;

                console.log(`✓ Scene ${scene.sequence} created: ${duration}s`);
            }

            console.log('✅ Total scenes created:', newScenes.length);
            console.log('⏱️ Total duration:', currentTime, 'seconds');
            console.log('━━━━━━━━━━━━━━━━━━━━━━');

            return newScenes;

        } catch (error) {
            console.error('❌ Error in autoGenerateScenes:', error);
            alert('장면 생성 중 오류가 발생했습니다: ' + error.message);
            return [];
        }
    };

    const handleAutoGenerate = () => {
        console.log('🚀 Auto Generate Button Clicked');
        console.log('Script available:', !!generatedScript);
        console.log('Blueprint available:', !!blueprint);

        if (!generatedScript || generatedScript.trim() === '') {
            alert('대본이 없습니다. 이전 단계로 돌아가 대본을 생성해주세요.');
            return;
        }

        if (!blueprint) {
            alert('설정 정보가 없습니다. 이전 단계로 돌아가주세요.');
            return;
        }

        setIsGenerating(true);

        // 약간의 딜레이 후 생성 (UI 피드백)
        setTimeout(async () => {
            try {
                const newScenes = autoGenerateScenes(generatedScript, blueprint, characters);

                if (newScenes.length === 0) {
                    alert('장면을 생성할 수 없습니다. 대본을 확인해주세요.');
                    setIsGenerating(false);
                    return;
                }

                setScenes(newScenes);

                setViewMode('all-scenes');
                setIsGenerating(false);

                alert(`✅ ${newScenes.length}개의 장면이 생성되었습니다!`);

            } catch (error) {
                console.error('❌ Generation failed:', error);
                // 오류가 나도 그때까지 작업한 scenes/characters는 저장해 복구 가능하게
                if (projectId && (scenes?.length > 0 || characters?.length > 0)) {
                    try {
                        await updateProject(projectId, {
                            scenes: scenes || [],
                            characters: characters || [],
                            ...(generatedScript?.trim() ? { script: generatedScript } : {})
                        });
                        console.log('✓ Project state saved after error');
                    } catch (saveErr) {
                        console.error('Save on error failed:', saveErr);
                    }
                }
                alert('장면 생성에 실패했습니다: ' + error.message);
                setIsGenerating(false);
            }
        }, 500);
    };

    const handleAddScene = () => {
        const lastScene = scenes[scenes.length - 1];
        const startTime = lastScene ? (lastScene.endTime ?? (lastScene.startTime ?? 0) + (lastScene.duration ?? 5)) : 0;
        const newScene = {
            id: Date.now(),
            sequence: scenes.length + 1,
            text: '',
            imagePrompt: '',
            imageStyle: 'cinematic',
            startTime: startTime,
            endTime: startTime + 3,
            duration: 3,
            transition: 'none',
            effects: { textAnimation: 'none' }
        };
        setScenes([...scenes, newScene]);
        setSelectedScene(newScene);
        setViewMode('timeline');
    };

    const handleSceneUpdate = (updatedScene) => {
        const updatedScenes = scenes.map(s =>
            s.id === updatedScene.id ? updatedScene : s
        );

        // Recalculate timings
        let currentTime = 0;
        const retimedScenes = updatedScenes.map(s => {
            const duration = s.duration || s.durationSec || 5; // 기본값 5초
            const start = parseFloat(currentTime.toFixed(1));
            const end = parseFloat((start + duration).toFixed(1));
            currentTime = end;
            return { ...s, duration, startTime: start, endTime: end };
        });

        setScenes(retimedScenes);
        if (selectedScene?.id === updatedScene.id) {
            setSelectedScene(retimedScenes.find(s => s.id === updatedScene.id));
        }
    };

    const handleSceneDelete = (sceneId) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;

        const filtered = scenes.filter(s => s.id !== sceneId);
        // Recalculate timings and sequences
        let currentTime = 0;
        const reordered = filtered.map((s, idx) => {
            const duration = s.duration || s.durationSec || 5; // 기본값 5초
            const start = parseFloat(currentTime.toFixed(1));
            const end = parseFloat((start + duration).toFixed(1));
            currentTime = end;
            return {
                ...s,
                duration,
                sequence: idx + 1,
                startTime: start,
                endTime: end
            };
        });

        setScenes(reordered);
        if (selectedScene?.id === sceneId) setSelectedScene(null);
    };

    const generateCompleteJSON = (currentScenes, currentBlueprint, currentScript) => {
        return {
            project: {
                id: 'proj_' + Date.now(),
                title: currentBlueprint?.title || currentBlueprint?.topic || 'Untitled Project',
                created: new Date().toISOString(),
                version: '1.0'
            },
            script: {
                original: currentScript,
                metadata: currentBlueprint
            },
            scenes: currentScenes.map(s => ({
                id: s.id,
                sequence: s.sequence,
                text: s.text,
                narration_ko: s.narration_ko || s.text,
                narration_en: s.narration_en || '',
                duration: s.duration,
                startTime: s.startTime,
                endTime: s.endTime,
                timing: { start: s.startTime, end: s.endTime },
                imagePrompt: s.imagePrompt || s.prompt || '',
                characterId: s.characterId || null,
                visual: {
                    prompt: s.imagePrompt || s.prompt,
                    style: s.imageStyle,
                    transition: s.transition,
                    effects: s.effects
                },
                audio: {
                    voice: 'ko-KR-Standard-A',
                }
            }))
        };
    };

    const handleValidateJSON = () => {
        try {
            const data = generateCompleteJSON(scenes, blueprint, generatedScript);
            // Simple validation
            if (!data.scenes || data.scenes.length === 0) throw new Error('장면(Scene)이 없습니다.');
            if (data.scenes.some(s => !s.text)) throw new Error('대본이 비어있는 장면이 있습니다.');

            alert('유효한 JSON 구조입니다. \n총 ' + data.scenes.length + '개의 장면이 확인되었습니다.');
        } catch (e) {
            alert('유효성 검사 실패: ' + e.message);
        }
    };

    const getTotalDuration = (scenesList) => {
        return scenesList.reduce((acc, curr) => acc + (curr.duration || curr.durationSec || 5), 0).toFixed(1);
    };

    const handleProceedToImage = async () => {
        // Save current state
        localStorage.setItem('scenes', JSON.stringify(scenes));
        localStorage.setItem('projectJSON', JSON.stringify(generateCompleteJSON(scenes, blueprint, generatedScript)));

        // 이미지 생성 페이지로 이동 (projectId가 있으면 백엔드 저장 후 이동)
        if (projectId) {
            try {
                await updateProject(projectId, {
                    scenes: scenes,
                    characters: characters
                });
                console.log('✓ Project scenes & characters saved to backend');
            } catch (error) {
                console.error('Failed to save project data:', error);
                // 실패해도 이동은 시도? 아니면 알림?
                // alert('프로젝트 저장에 실패했습니다. (로컬 데이터로 계속 진행합니다)');
            }
            router.push(`/image-generation?projectId=${projectId}`);
        } else {
            router.push('/image-generation');
        }
    };

    // 로딩 중이면 로딩 화면 표시
    if (loading) {
        return (
            <StudioLayout title="JSON 생성 - HANRA STUDIO" activeStep="json" reachedStep="json" projectId={projectId}>
                <div style={{ padding: '48px', textAlign: 'center' }}>
                    <p style={{ fontSize: '18px', color: '#718096' }}>데이터를 불러오는 중...</p>
                </div>
            </StudioLayout>
        );
    }

    return (
        <StudioLayout title="JSON 생성 - HANRA STUDIO" activeStep="json" reachedStep="json" projectId={projectId}>
            <Head>
                <title>JSON 생성 - HANRA STUDIO</title>
            </Head>

            <div className="json-generation-container">
                {/* 헤더 */}
                <header className="page-header">
                    <button
                        onClick={() => {
                            if (projectId) {
                                router.push(`/script-generation?projectId=${projectId}`);
                            } else {
                                router.push('/script-generation');
                            }
                        }}
                        className="back-btn"
                    >
                        ← 뒤로
                    </button>
                    <div className="header-center">
                        <h1>4-1. JSON 생성</h1>
                        <span className="subtitle">장면별 구조화 및 이미지 프롬프트 설정</span>
                    </div>
                    <span className="step-indicator">단계 4/6</span>
                </header>

                <div className="json-content">
                    {/* 캐릭터 분석 리스트 */}
                    <div className="character-analysis-section">
                        <div className="character-list-header">
                            <h2 className="character-list-title">👥 캐릭터 분석리스트</h2>
                            <button type="button" className="btn-add-character" onClick={() => setShowCharModal(true)}>
                                + 캐릭터 추가
                            </button>
                        </div>
                        <div className="character-grid">
                            {characters.map((char) => (
                                <div key={char.id} className="character-card">
                                    <div className="character-card-header">
                                        <div className="character-name-badge">
                                            <input
                                                className="character-name-input"
                                                value={char.name || ''}
                                                onChange={(e) => setCharacters(characters.map(c => c.id === char.id ? { ...c, name: e.target.value } : c))}
                                                placeholder="이름"
                                            />
                                        </div>
                                        <div className="character-role-text">
                                            {char.role || '—'}
                                        </div>
                                        <button type="button" className="btn-delete-char" onClick={() => handleDeleteCharacter(char.id)} title="삭제">✕</button>
                                    </div>
                                    <div className="character-card-body">
                                        <div className="character-section">
                                            <label>📝 캐릭터 설명 (한글)</label>
                                            <textarea className="character-text-box" value={char.descriptionKo ?? ''} onChange={(e) => setCharacters(characters.map(c => c.id === char.id ? { ...c, descriptionKo: e.target.value } : c))} placeholder="한글 설명" rows={2} />
                                        </div>
                                        <div className="character-section">
                                            <label>🎨 캐릭터 설명 (영문)</label>
                                            <div className="character-prompt-box">
                                                <textarea className="character-prompt-inner" value={char.description ?? ''} onChange={(e) => setCharacters(characters.map(c => c.id === char.id ? { ...c, description: e.target.value } : c))} placeholder="영문 설명" rows={2} />
                                            </div>
                                        </div>
                                        <div className="character-section">
                                            <label>✨ 외모/특징</label>
                                            <input type="text" className="character-input" placeholder="추가 입력..." value={char.userInput || ''} onChange={(e) => setCharacters(characters.map(c => c.id === char.id ? { ...c, userInput: e.target.value } : c))} />
                                        </div>
                                        <div className="character-section character-image-section">
                                            <label>🖼️ 캐릭터 이미지</label>
                                            {(char.imageDataUrl || char.imageUrl) ? (
                                                <div className="character-image-wrap">
                                                    <img src={char.imageDataUrl || char.imageUrl} alt={char.name} className="character-image-preview" />
                                                    <div className="character-image-actions">
                                                        <input type="file" accept="image/*" id={`char-img-${char.id}`} style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSetCharacterImage(char.id, f); e.target.value = ''; }} />
                                                        <label htmlFor={`char-img-${char.id}`} className="btn-char-img">변경</label>
                                                        <button type="button" className="btn-char-remove" onClick={() => handleRemoveCharacterImage(char.id)}>제거</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="character-image-zone" onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }} onDragLeave={(e) => { e.currentTarget.classList.remove('drag-over'); }} onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); const file = e.dataTransfer?.files?.[0]; if (file && file.type.startsWith('image/')) handleSetCharacterImage(char.id, file); }}>
                                                    <input type="file" accept="image/*" id={`char-img-drop-${char.id}`} style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSetCharacterImage(char.id, f); e.target.value = ''; }} />
                                                    <label htmlFor={`char-img-drop-${char.id}`} className="character-image-label">클릭 또는 끌어다 놓기</label>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 캐릭터 추가 모달 */}
                    {showCharModal && (
                        <div className="modal-overlay">
                            <div className="modal-content">
                                <h3>캐릭터 추가</h3>
                                <div className="modal-form">
                                    <input
                                        placeholder="이름 (필수)"
                                        value={newCharacter.name}
                                        onChange={e => setNewCharacter({ ...newCharacter, name: e.target.value })}
                                    />
                                    <input
                                        placeholder="역할"
                                        value={newCharacter.role}
                                        onChange={e => setNewCharacter({ ...newCharacter, role: e.target.value })}
                                    />
                                    <textarea
                                        placeholder="캐릭터 설명 (한글)"
                                        value={newCharacter.descriptionKo || ''}
                                        onChange={e => setNewCharacter({ ...newCharacter, descriptionKo: e.target.value })}
                                        rows={2}
                                    />
                                    <textarea
                                        placeholder="외형 설명 (영어 권장)"
                                        value={newCharacter.description}
                                        onChange={e => setNewCharacter({ ...newCharacter, description: e.target.value })}
                                        rows={4}
                                    />
                                    <div className="character-image-upload">
                                        <label>캐릭터 이미지</label>
                                        <div
                                            className="image-upload-zone"
                                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                                            onDragLeave={(e) => { e.currentTarget.classList.remove('drag-over'); }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.remove('drag-over');
                                                const file = e.dataTransfer?.files?.[0];
                                                if (file && file.type.startsWith('image/')) handleCharacterImageFile(file);
                                            }}
                                        >
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCharacterImageFile(f); e.target.value = ''; }}
                                                style={{ display: 'none' }}
                                                id="char-image-input"
                                            />
                                            {newCharacter.imageDataUrl ? (
                                                <div className="image-preview-wrap">
                                                    <img src={newCharacter.imageDataUrl} alt="캐릭터 미리보기" className="image-preview" />
                                                    <button type="button" className="remove-image-btn" onClick={() => setNewCharacter({ ...newCharacter, imageDataUrl: '' })}>✕ 제거</button>
                                                </div>
                                            ) : (
                                                <label htmlFor="char-image-input" className="image-upload-label">
                                                    파일 선택 또는 이미지를 여기에 끌어다 놓기
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-actions">
                                    <button onClick={() => { setShowCharModal(false); setNewCharacter({ name: '', role: '', description: '', descriptionKo: '', userInput: '', imageDataUrl: '' }); }}>취소</button>
                                    <button className="confirm" onClick={handleAddCharacter}>추가</button>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* 상단 탭 & 컨트롤 */}
                    <div className="control-bar">
                        <div className="view-tabs">
                            <button
                                className={`tab ${viewMode === 'all-scenes' ? 'active' : ''}`}
                                onClick={() => setViewMode('all-scenes')}
                            >
                                📋 전체 Scene
                            </button>
                            <button
                                className={`tab ${viewMode === 'timeline' ? 'active' : ''}`}
                                onClick={() => setViewMode('timeline')}
                            >
                                📽️ 타임라인 뷰
                            </button>
                            <button
                                className={`tab ${viewMode === 'json' ? 'active' : ''}`}
                                onClick={() => setViewMode('json')}
                            >
                                📄 JSON 뷰
                            </button>
                        </div>

                        <div className="control-actions">
                            <button className="btn-control primary" onClick={handleAutoGenerate}>
                                ⚡ 씬 전체생성
                            </button>
                            <button className="btn-control" onClick={handleAddScene}>
                                ➕ 장면 추가
                            </button>
                            <button className="btn-control" onClick={handleValidateJSON}>
                                ✓ 검증
                            </button>
                            {isAnalyzing && <span className="status-text">🔄 캐릭터 분석 중...</span>}
                        </div>
                    </div>

                    {isGenerating ? (
                        <div className="generating-view">
                            <div className="spinner"></div>
                            <p>장면을 분석하고 나누는 중입니다...</p>
                        </div>
                    ) : viewMode === 'all-scenes' ? (
                        <AllScenesView
                            scenes={scenes}
                            onUpdateScenes={setScenes}
                            onOpenSceneEdit={(scene) => {
                                setSelectedScene(scene);
                                setViewMode('timeline');
                            }}
                            characters={characters}
                            getCharacterPromptPrefix={getCharacterPromptPrefix}
                            improvePrompt={improvePrompt}
                            validateImagePrompt={validateImagePrompt}
                        />
                    ) : viewMode === 'timeline' ? (
                        <TimelineView
                            scenes={scenes}
                            blueprint={blueprint}
                            selectedScene={selectedScene}
                            onSceneSelect={setSelectedScene}
                            onSceneUpdate={handleSceneUpdate}
                            onSceneDelete={handleSceneDelete}
                        />
                    ) : (
                        <JSONView
                            scenes={scenes}
                            blueprint={blueprint}
                            script={generatedScript}
                            generateCompleteJSON={generateCompleteJSON}
                        />
                    )}
                </div>

                {/* 하단 액션 */}
                <footer className="page-footer">
                    <button
                        className="btn-back"
                        onClick={() => {
                            if (projectId) {
                                router.push(`/script-generation?projectId=${projectId}`);
                            } else {
                                router.push('/script-generation');
                            }
                        }}
                    >
                        ← 이전 단계
                    </button>

                    <div className="footer-info">
                        <span>총 {scenes.length}개 장면</span>
                        <span>•</span>
                        <span>총 길이: {getTotalDuration(scenes)}초</span>
                    </div>

                    <button
                        className="btn-next"
                        onClick={handleProceedToImage}
                        disabled={scenes.length === 0}
                    >
                        다음 단계: 이미지 생성 →
                    </button>
                </footer>
            </div >

            <style jsx>{`
                .json-generation-container {
                    min-height: 100vh;
                    background: #F5F5F5;
                    display: flex;
                    flex-direction: column;
                }

                .page-header {
                    background: white;
                    padding: 20px 32px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }

                .back-btn {
                    background: none;
                    border: none;
                    font-size: 16px;
                    color: #718096;
                    cursor: pointer;
                    font-weight: 600;
                }

                .header-center {
                    flex: 1;
                    text-align: center;
                }

                .header-center h1 {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 700;
                    color: #2d3748;
                }

                .subtitle {
                    color: #718096;
                    font-size: 13px;
                }
                
                .step-indicator {
                    font-size: 12px;
                    font-weight: 600;
                    color: #4A5568;
                    background: #EDF2F7;
                    padding: 4px 12px;
                    border-radius: 20px;
                }

                .json-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .control-bar {
                    background: white;
                    padding: 12px 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #E0E0E0;
                }

                .view-tabs {
                    display: flex;
                    gap: 8px;
                }

                .tab {
                    padding: 8px 16px;
                    border: 1px solid #E2E8F0;
                    background: white;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 13px;
                    color: #718096;
                }

                .tab.active {
                    border-color: #8B7DE8;
                    background: #F5F3FF;
                    color: #6B5DD8;
                    font-weight: 600;
                }

                .control-actions {
                    display: flex;
                    gap: 8px;
                }
                
                .btn-control {
                    padding: 8px 12px;
                    border: 1px solid #E2E8F0;
                    background: white;
                    border-radius: 6px;
                    font-size: 13px;
                    cursor: pointer;
                }
                
                .btn-control:hover {
                    background: #F7FAFC;
                }
                
                .generating-view {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 16px;
                }
                
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid #EDF2F7;
                    border-top: 3px solid #8B7DE8;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .page-footer {
                    background: white;
                    padding: 16px 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-top: 1px solid #E0E0E0;
                }
                
                .footer-info {
                    font-size: 13px;
                    color: #718096;
                    display: flex;
                    gap: 8px;
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
                    background: #CBD5E0;
                    cursor: not-allowed;
                    box-shadow: none;
                }
                .character-analysis-section {
                    background: #F7FAFC;
                    padding: 20px 24px 24px;
                    border-radius: 16px;
                    margin: 20px 24px 24px 24px;
                    border: 1px solid #E2E8F0;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                }

                .character-list-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding: 12px 16px;
                    background: white;
                    border-radius: 10px;
                    border: 1px solid #E2E8F0;
                }

                .character-list-title {
                    font-size: 18px;
                    font-weight: 700;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: #2D3748;
                }

                .btn-add-character {
                    padding: 8px 16px;
                    font-size: 13px;
                    font-weight: 600;
                    color: white;
                    background: #718096;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .btn-add-character:hover {
                    background: #4A5568;
                }

                .section-header {
                    margin-bottom: 20px;
                    border-bottom: 1px solid #EDF2F7;
                    padding-bottom: 12px;
                }

                .section-title {
                    font-size: 18px;
                    font-weight: 700;
                    color: #2D3748;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .character-grid {
                    display: grid;
                    gap: 16px;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                }
                .character-card {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    border: 1px solid #E2E8F0;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                .character-card-header {
                    padding: 12px 16px;
                    background: #FAFAFA;
                    border-bottom: 1px solid #E2E8F0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .character-name-badge {
                    flex: 0 0 auto;
                }
                .character-name-input {
                    background: #2D3748;
                    color: white;
                    font-size: 12px;
                    font-weight: 700;
                    padding: 4px 8px;
                    border-radius: 6px;
                    border: 1px solid transparent;
                    min-width: 60px;
                    max-width: 120px;
                }
                .character-name-input::placeholder { color: rgba(255,255,255,0.6); }
                .character-name-input:focus { outline: none; border-color: #8B7DE8; }
                .character-role-text {
                    font-size: 12px;
                    color: #718096;
                }
                .character-card-body {
                    padding: 16px;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .character-section label {
                    display: block;
                    font-size: 11px;
                    font-weight: 700;
                    color: #A0AEC0;
                    margin-bottom: 6px;
                    text-transform: uppercase;
                }
                .character-text-box {
                    width: 100%;
                    box-sizing: border-box;
                    font-size: 13px;
                    padding: 8px;
                    border: 1px solid #FFE4CC;
                    border-radius: 6px;
                    background: #FFF5EB;
                    resize: vertical;
                    min-height: 44px;
                }
                .character-prompt-box {
                    background: #FFF5EB;
                    padding: 8px;
                    border-radius: 6px;
                    border: 1px solid #FFE4CC;
                }
                .character-prompt-inner {
                    width: 100%;
                    box-sizing: border-box;
                    font-size: 12px;
                    color: #4A5568;
                    font-style: italic;
                    border: none;
                    background: transparent;
                    resize: vertical;
                    min-height: 40px;
                }
                .character-input {
                    width: 100%;
                    box-sizing: border-box;
                    font-size: 13px;
                    padding: 6px 8px;
                    border: 1px solid #FFE4CC;
                    border-radius: 6px;
                    background: #FFF5EB;
                }
                .character-image-wrap { display: flex; flex-direction: column; gap: 6px; }
                .character-image-preview { max-width: 100%; max-height: 80px; object-fit: contain; border-radius: 6px; }
                .character-image-actions { display: flex; gap: 6px; }
                .btn-char-img, .btn-char-remove { font-size: 11px; padding: 6px 12px; border-radius: 4px; cursor: pointer; min-width: 52px; box-sizing: border-box; text-align: center; }
                .btn-char-img { background: #EDE9FE; color: #8B7DE8; border: 1px solid #8B7DE8; }
                .btn-char-remove { background: #FFF5F5; color: #E53E3E; border: 1px solid #E53E3E; }
                .character-image-zone {
                    border: 2px dashed #FFD4B8;
                    border-radius: 6px;
                    min-height: 56px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #FFF5EB;
                }
                .character-image-zone.drag-over { border-color: #8B7DE8; background: #EDE9FE; }
                .character-image-label { font-size: 11px; color: #7EB8DA; cursor: pointer; padding: 8px; text-align: center; }

                .char-image-thumb { padding: 8px; text-align: center; border-bottom: 1px solid #E2E8F0; }
                .char-image-thumb img { max-width: 80px; max-height: 80px; object-fit: contain; border-radius: 8px; }
                .analysis-card {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    border: 1px solid #E2E8F0;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                .analysis-header {
                    padding: 12px 16px;
                    background: #FAFAFA;
                    border-bottom: 1px solid #E2E8F0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .char-name-badge {
                    background: #2D3748;
                    color: white;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 14px;
                }

                .char-name-input {
                    background: #2D3748;
                    color: white;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 14px;
                    border: 1px solid transparent;
                    min-width: 80px;
                    max-width: 180px;
                    box-sizing: border-box;
                }
                .char-name-input::placeholder { color: rgba(255,255,255,0.6); }
                .char-name-input:focus { outline: none; border-color: #8B7DE8; }

                .char-role-badge {
                    font-size: 12px;
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-weight: 600;
                    border: 1px solid transparent;
                }
                
                .role-텀블러 { background: #EDF2F7; color: #4A5568; border-color: #CBD5E0; }
                .role-보좌관 { background: #EDF2F7; color: #4A5568; border-color: #CBD5E0; }
                .role-결정 { background: #F3F0FF; color: #6B5DD8; border-color: #D6BCFA; }

                .analysis-body {
                    padding: 16px;
                    display: flex;
                    gap: 16px;
                    align-items: flex-start;
                    min-width: 0;
                }
                .analysis-body-horizontal {
                    flex-direction: row;
                    flex-wrap: nowrap;
                    overflow-x: auto;
                }
                .analysis-body-vertical {
                    flex-direction: column;
                    flex-wrap: wrap;
                }
                .analysis-body-horizontal .analysis-cell {
                    flex: 1 1 0;
                    min-width: 200px;
                }
                .analysis-body-horizontal .analysis-cell .analysis-textarea { width: 100%; min-width: 200px; box-sizing: border-box; }
                .analysis-body-horizontal .analysis-cell.character-image-section { flex: 0 0 auto; min-width: 160px; }

                .analysis-section {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .analysis-section label {
                    font-size: 13px;
                    font-weight: 600;
                    color: #718096;
                }

                .analysis-text-box {
                    padding: 12px;
                    background: #F7FAFC;
                    border: 1px solid #EDF2F7;
                    border-radius: 8px;
                    font-size: 14px;
                    line-height: 1.6;
                    color: #4A5568;
                    min-height: 80px;
                }

                .analysis-textarea {
                    padding: 12px;
                    border: 1px solid #E2E8F0;
                    border-radius: 8px;
                    font-size: 14px;
                    line-height: 1.6;
                    width: 100%;
                    box-sizing: border-box;
                    background: white;
                    resize: vertical;
                    min-height: 60px;
                }
                .analysis-textarea:focus {
                    outline: none;
                    border-color: #8B7DE8;
                    box-shadow: 0 0 0 3px rgba(139, 125, 232, 0.1);
                }
                .analysis-textarea::placeholder { color: #A0AEC0; }
                .analysis-textarea.description-ko { margin-bottom: 8px; }

                .analysis-input {
                    padding: 10px;
                    border: 1px solid #E2E8F0;
                    border-radius: 8px;
                    font-size: 14px;
                    width: 100%;
                }

                .analysis-input {
                    padding: 12px;
                    border: 1px solid #E2E8F0;
                    border-radius: 8px;
                    font-size: 14px;
                    width: 100%;
                    box-sizing: border-box;
                    background: white;
                    transition: all 0.2s;
                }

                .analysis-input:focus {
                    outline: none;
                    border-color: #8B7DE8;
                    box-shadow: 0 0 0 3px rgba(139, 125, 232, 0.1);
                }

                .analysis-input::placeholder {
                    color: #A0AEC0;
                }
                
                .btn-delete-char {
                    background: none;
                    border: none;
                    color: #CBD5E0;
                    cursor: pointer;
                    font-size: 16px;
                }
                .btn-delete-char:hover {
                    color: #E53E3E;
                }

                .add-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    background: #F7FAFC;
                    border: 2px dashed #CBD5E0;
                    color: #718096;
                    min-height: 200px;
                    transition: all 0.2s;
                }
                .add-card:hover {
                    border-color: #8B7DE8;
                    color: #8B7DE8;
                    background: #F5F3FF;
                }
                .add-card.drag-over {
                    border-color: #8B7DE8;
                    background: #EDE9FE;
                }
                .add-icon {
                    font-size: 32px;
                    margin-bottom: 8px;
                }
                .add-card-hint {
                    font-size: 11px;
                    color: #A0AEC0;
                    margin-top: 6px;
                }
                .character-image-upload { margin-top: 12px; }
                .character-image-upload label { display: block; font-size: 13px; font-weight: 600; color: #4A5568; margin-bottom: 8px; }
                .image-upload-zone {
                    border: 2px dashed #CBD5E0;
                    border-radius: 8px;
                    min-height: 100px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #F7FAFC;
                }
                .image-upload-zone.drag-over { border-color: #8B7DE8; background: #EDE9FE; }
                .image-upload-label { cursor: pointer; padding: 20px; text-align: center; color: #718096; font-size: 13px; display: block; }
                .image-preview-wrap { padding: 12px; text-align: center; }
                .image-preview { max-width: 120px; max-height: 120px; object-fit: contain; border-radius: 8px; display: block; margin: 0 auto 8px; }
                .remove-image-btn { font-size: 12px; color: #E53E3E; background: none; border: none; cursor: pointer; }

                .character-image-section { margin-top: 4px; }
                .char-card-image-wrap { display: flex; flex-direction: column; gap: 8px; }
                .char-card-image-preview { max-width: 160px; max-height: 120px; object-fit: contain; border-radius: 8px; display: block; }
                .char-card-image-actions { display: flex; gap: 8px; flex-wrap: wrap; }
                .btn-change-image { font-size: 12px; color: #8B7DE8; background: none; border: 1px solid #8B7DE8; padding: 6px 12px; border-radius: 6px; cursor: pointer; }
                .btn-change-image:hover { background: #EDE9FE; }
                .btn-remove-image { font-size: 12px; color: #E53E3E; background: none; border: 1px solid #E53E3E; padding: 6px 12px; border-radius: 6px; cursor: pointer; }
                .btn-remove-image:hover { background: #FFF5F5; }
                .char-card-image-zone {
                    border: 2px dashed #CBD5E0;
                    border-radius: 8px;
                    min-height: 80px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #F7FAFC;
                }
                .char-card-image-zone.drag-over { border-color: #8B7DE8; background: #EDE9FE; }
                .char-card-image-label { cursor: pointer; padding: 16px; text-align: center; color: #718096; font-size: 13px; display: block; width: 100%; }
                
                .modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                .modal-content {
                    background: white;
                    padding: 24px;
                    border-radius: 12px;
                    width: 400px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .modal-form input, .modal-form textarea {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #E2E8F0;
                    border-radius: 6px;
                    margin-bottom: 8px;
                }
                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                }
                .modal-actions button {
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    border: 1px solid #E2E8F0;
                    background: white;
                }
                .modal-actions button.confirm {
                    background: #8B7DE8;
                    color: white;
                    border: none;
                }
                .status-text {
                    font-size: 12px;
                    color: #6B5DD8;
                    margin-left: 8px;
                }
            `}</style>
        </StudioLayout >
    );
};

const AllScenesView = ({ scenes, onUpdateScenes, onOpenSceneEdit, onCopyAll, onCopyImagePrompts, characters = [], getCharacterPromptPrefix, improvePrompt, validateImagePrompt }) => {
    const [copyStatus, setCopyStatus] = useState('');

    const handleCopyAllText = () => {
        const allText = scenes
            .map((scene, idx) => `씬${idx + 1}: ${scene.text}`)
            .join('\n\n');

        navigator.clipboard.writeText(allText);
        setCopyStatus('전체 대본 복사 완료!');
        setTimeout(() => setCopyStatus(''), 2000);
    };

    const handleCopyAllPrompts = () => {
        const allPrompts = scenes
            .map((scene, idx) => `Scene ${idx + 1}: ${scene.imagePrompt.replace(/[가-힣]/g, '').trim()}`)
            .join('\n\n');

        navigator.clipboard.writeText(allPrompts);
        setCopyStatus('영문 프롬프트 전체 복사 완료!');
        setTimeout(() => setCopyStatus(''), 2000);
    };

    // 전체 복사: 씬별 내용 모두 포함 (씬 번호, 시간, 대본, 이미지 프롬프트)
    const handleCopySceneList = () => {
        const blocks = scenes.map((scene, idx) => {
            const start = (scene.startTime ?? 0).toFixed(1);
            const end = (scene.endTime ?? (scene.startTime ?? 0) + (scene.duration ?? 5)).toFixed(1);
            const dur = scene.duration ?? 5;
            const timing = `${start}초 - ${end}초 (${dur}초)`;
            const script = (scene.text || scene.narration_ko || scene.narration_en || '').trim();
            const prompt = (scene.imagePrompt || scene.prompt || '').trim();
            return [
                `[씬 ${idx + 1}] ${timing}`,
                `대본: ${script}`,
                `이미지 프롬프트: ${prompt}`
            ].join('\n');
        });
        const text = blocks.join('\n\n');
        navigator.clipboard.writeText(text);
        setCopyStatus('씬별 내용 전체 복사 완료!');
        setTimeout(() => setCopyStatus(''), 2000);
    };

    const getTotalDuration = (scenes) => {
        if (!scenes || scenes.length === 0) return 0;
        return scenes.reduce((total, scene) => total + (scene.duration || 0), 0);
    };

    const handleBatchImprove = () => {
        if (!confirm('모든 장면의 프롬프트를 영문 기반으로 개선하시겠습니까?')) return;

        // onUpdateScenes가 있으면 상위 상태 업데이트
        if (onUpdateScenes && improvePrompt && validateImagePrompt) {
            const charPrefix = getCharacterPromptPrefix ? getCharacterPromptPrefix(characters) : '';
            const improvedScenes = scenes.map(scene => {
                const improved = validateImagePrompt(improvePrompt(scene.imagePrompt));
                const finalPrompt = charPrefix ? (charPrefix + improved).replace(/\s+/g, ' ').trim() : improved;
                return { ...scene, imagePrompt: finalPrompt };
            });
            onUpdateScenes(improvedScenes);
            alert('모든 장면의 프롬프트가 영문 기반으로 개선되었습니다.');
        } else {
            alert('상위 컴포넌트 업데이트 함수가 없습니다.');
        }
    };

    return (
        <div className="all-scenes-view">

            {/* 상단 액션 바 */}
            <div className="all-scenes-header">
                <div className="header-info">
                    <h2>전체 장면 목록</h2>
                    <span className="scene-count">총 {scenes.length}개 장면</span>
                </div>

                <div className="header-actions">
                    {copyStatus && (
                        <span className="copy-status">✓ {copyStatus}</span>
                    )}
                    <button
                        className="btn-copy"
                        onClick={handleCopyAllText}
                    >
                        📋 대본만 복사
                    </button>
                    <button
                        className="btn-copy primary"
                        onClick={handleCopyAllPrompts}
                    >
                        🎨 프롬프트만 복사
                    </button>
                    <button
                        className="btn-copy"
                        onClick={handleCopySceneList}
                    >
                        📑 전체 복사
                    </button>
                </div>
            </div>

            {/* 장면 리스트 */}
            <div className="all-scenes-list">
                {scenes.map((scene, index) => (
                    <div key={scene.id} className="scene-card">

                        <div className="scene-card-header">
                            <div className="scene-number-badge">
                                씬 {index + 1}
                            </div>
                            <div className="scene-timing">
                                {(scene.startTime ?? 0).toFixed(1)}초 - {(scene.endTime ?? (scene.startTime ?? 0) + (scene.duration ?? 5)).toFixed(1)}초
                                <span className="duration">({scene.duration ?? 5}초)</span>
                            </div>
                            <button
                                className="btn-copy-scene"
                                onClick={() => {
                                    const prompt = scene.imagePrompt.replace(/[가-힣]/g, '').trim();
                                    navigator.clipboard.writeText(prompt);
                                    setCopyStatus(`씬${index + 1} 프롬프트 복사`);
                                    setTimeout(() => setCopyStatus(''), 2000);
                                }}
                                title="프롬프트만 복사"
                            >
                                🎨
                            </button>
                        </div>

                        <div className="scene-card-body">

                            {/* 대본 텍스트 */}
                            <div className="scene-section">
                                <label>📝 대본</label>
                                <div className="scene-text-box">
                                    {scene.text}
                                </div>
                            </div>

                            {/* 이미지 프롬프트 */}
                            <div className="scene-section">
                                <label>🎨 이미지 프롬프트</label>
                                <div className="scene-prompt-box">
                                    {scene.imagePrompt}
                                </div>
                            </div>

                            {/* 설정 요약: 클릭 시 해당 씬 수정(타임라인) 뷰로 이동 */}
                            <div
                                className="scene-settings scene-settings-clickable"
                                onClick={() => onOpenSceneEdit && onOpenSceneEdit(scene)}
                                title="클릭하면 이 장면 수정 화면으로 이동합니다"
                                role="button"
                            >
                                <div className="setting-tag">
                                    🎬 {scene.transition}
                                </div>
                                <div className="setting-tag">
                                    🎭 {scene.imageStyle}
                                </div>
                                {scene.effects?.zoom && (
                                    <div className="setting-tag">🔍 줌</div>
                                )}
                                {scene.effects?.pan && (
                                    <div className="setting-tag">↔️ 팬</div>
                                )}
                            </div>

                        </div>

                    </div>
                ))}
            </div>

            {/* 하단 요약 */}
            <div className="all-scenes-summary">
                <div className="summary-item">
                    <span className="label">총 장면 수:</span>
                    <span className="value">{scenes.length}개</span>
                </div>
                <div className="summary-item">
                    <span className="label">총 길이:</span>
                    <span className="value">{getTotalDuration(scenes)}초</span>
                </div>
                <div className="summary-item">
                    <span className="label">평균 장면 길이:</span>
                    <span className="value">
                        {(scenes.length > 0 ? getTotalDuration(scenes) / scenes.length : 0).toFixed(1)}초
                    </span>
                </div>
            </div>

            {/* 스타일 */}
            <style jsx>{`
                .all-scenes-view {
                    padding: 24px;
                    background: #F5F5F5;
                    height: 100%;
                    overflow-y: auto;
                }

                .all-scenes-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }

                .header-info h2 {
                    margin: 0 0 4px 0;
                    font-size: 18px;
                    color: #2D3748;
                }

                .scene-count {
                    font-size: 13px;
                    color: #718096;
                }

                .header-actions {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }

                .copy-status {
                    font-size: 13px;
                    color: #48BB78;
                    font-weight: 600;
                    margin-right: 8px;
                }

                .btn-copy {
                    padding: 8px 12px;
                    background: white;
                    border: 1px solid #E2E8F0;
                    border-radius: 6px;
                    font-size: 13px;
                    color: #4A5568;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-copy:hover {
                    background: #EDF2F7;
                }

                .btn-copy.primary {
                    background: #8B7DE8;
                    color: white;
                    border-color: #8B7DE8;
                }

                .btn-copy.primary:hover {
                    background: #7B6AD6;
                }

                .all-scenes-list {
                    display: grid;
                    gap: 16px;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                }

                .scene-card {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    border: 1px solid #E2E8F0;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                .scene-card-header {
                    padding: 12px 16px;
                    background: #FAFAFA;
                    border-bottom: 1px solid #E2E8F0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .scene-number-badge {
                    background: #2D3748;
                    color: white;
                    font-size: 12px;
                    font-weight: 700;
                    padding: 4px 8px;
                    border-radius: 6px;
                }

                .scene-timing {
                    font-size: 12px;
                    color: #718096;
                    font-family: monospace;
                }

                .btn-copy-scene {
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 14px;
                    opacity: 0.5;
                    transition: opacity 0.2s;
                }

                .btn-copy-scene:hover {
                    opacity: 1;
                }

                .scene-card-body {
                    padding: 16px;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .scene-section label {
                    display: block;
                    font-size: 11px;
                    font-weight: 700;
                    color: #A0AEC0;
                    margin-bottom: 6px;
                    text-transform: uppercase;
                }

                .scene-text-box {
                    font-size: 14px;
                    color: #2D3748;
                    line-height: 1.5;
                    white-space: pre-wrap;
                }

                .scene-prompt-box {
                    font-size: 13px;
                    color: #4A5568;
                    background: #F7FAFC;
                    padding: 8px;
                    border-radius: 6px;
                    border: 1px solid #EDF2F7;
                    font-style: italic;
                }

                .scene-settings {
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                    margin-top: auto;
                    padding-top: 12px;
                    border-top: 1px solid #EDF2F7;
                }
                .scene-settings-clickable {
                    cursor: pointer;
                }
                .scene-settings-clickable:hover {
                    opacity: 0.9;
                }
                .scene-settings-clickable:hover .setting-tag {
                    background: #E2E8F0;
                }

                .setting-tag {
                    font-size: 11px;
                    padding: 4px 8px;
                    background: #EDF2F7;
                    color: #4A5568;
                    border-radius: 4px;
                    font-weight: 600;
                }

                .all-scenes-summary {
                    margin-top: 24px;
                    padding: 16px;
                    background: white;
                    border-radius: 8px;
                    border: 1px solid #E2E8F0;
                    display: flex;
                    justify-content: space-around;
                }

                .summary-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                }

                .summary-item .label {
                    font-size: 12px;
                    color: #718096;
                }

                .summary-item .value {
                    font-size: 18px;
                    font-weight: 700;
                    color: #2D3748;
                }
            `}</style>

        </div>
    );
};

const TimelineView = ({ scenes, blueprint, selectedScene, onSceneSelect, onSceneUpdate, onSceneDelete }) => {
    return (
        <div className="timeline-view">
            {/* 좌측: 타임라인 리스트 */}
            <div className="timeline-sidebar">
                <div className="timeline-header">
                    <h3>장면 목록</h3>
                    <span className="scene-count">{scenes.length}개</span>
                </div>

                <div className="timeline-list">
                    {scenes.map((scene, index) => (
                        <div
                            key={scene.id}
                            className={`timeline-item ${selectedScene?.id === scene.id ? 'selected' : ''}`}
                            onClick={() => onSceneSelect(scene)}
                        >
                            <div className="scene-number">#{index + 1}</div>
                            <div className="scene-preview">
                                <div className="scene-info">
                                    <p className="scene-text" title={scene.text}>{scene.text}</p>
                                    <span className="scene-time">
                                        {(scene.startTime ?? 0).toFixed(1)}s - {(scene.endTime ?? (scene.startTime ?? 0) + (scene.duration ?? 5)).toFixed(1)}s ({(scene.duration ?? 5)}초)
                                    </span>
                                </div>
                            </div>
                            <button
                                className="scene-delete"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSceneDelete(scene.id);
                                }}
                                title="삭제"
                            > 🗑️
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* 우측: 선택된 장면 편집 */}
            <div className="scene-editor">
                {selectedScene ? (
                    <SceneEditor
                        scene={selectedScene}
                        blueprint={blueprint}
                        onUpdate={onSceneUpdate}
                    />
                ) : (
                    <div className="editor-empty">
                        <div className="empty-icon">👈</div>
                        <p>좌측에서 장면을 선택하세요</p>
                    </div>
                )}
            </div>

            <style jsx>{`
                .timeline-view {
                    display: grid;
                    grid-template-columns: 350px 1fr;
                    height: calc(100vh - 220px);
                    background: white;
                    margin: 16px;
                    border-radius: 12px;
                    overflow: hidden;
                    border: 1px solid #E2E8F0;
                }

                .timeline-sidebar {
                    border-right: 1px solid #E0E0E0;
                    display: flex;
                    flex-direction: column;
                    background: #FAFAFA;
                }

                .timeline-header {
                    padding: 16px;
                    border-bottom: 1px solid #E0E0E0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: white;
                }
                
                .timeline-header h3 {
                    margin: 0;
                    font-size: 14px;
                    color: #2d3748;
                }
                
                .scene-count {
                    font-size: 12px;
                    color: #718096;
                    background: #EDF2F7;
                    padding: 2px 6px;
                    border-radius: 10px;
                }

                .timeline-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px;
                }

                .timeline-item {
                    display: flex;
                    gap: 12px;
                    padding: 12px;
                    border: 1px solid #E2E8F0;
                    border-radius: 8px;
                    margin-bottom: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                    background: white;
                }

                .timeline-item:hover {
                    border-color: #CBD5E0;
                    background: #F7FAFC;
                }

                .timeline-item.selected {
                    border-color: #8B7DE8;
                    background: #F5F3FF;
                    box-shadow: 0 2px 4px rgba(139, 125, 232, 0.1);
                }

                .scene-number {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: #EDF2F7;
                    color: #718096;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 11px;
                    flex-shrink: 0;
                }
                
                .timeline-item.selected .scene-number {
                    background: #8B7DE8;
                    color: white;
                }

                .scene-preview {
                    flex: 1;
                    min-width: 0;
                }

                .scene-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .scene-text {
                    font-size: 13px;
                    color: #2d3748;
                    margin: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .scene-time {
                    font-size: 11px;
                    color: #A0AEC0;
                }

                .scene-delete {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    width: 24px;
                    height: 24px;
                    border: none;
                    background: transparent;
                    border-radius: 4px;
                    cursor: pointer;
                    opacity: 0;
                    transition: opacity 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                }

                .timeline-item:hover .scene-delete {
                    opacity: 1;
                }
                
                .timeline-item:hover .scene-delete:hover {
                    background: #FEB2B2;
                }

                .scene-editor {
                    flex: 1;
                    overflow: hidden;
                }
                
                .editor-empty {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: #A0AEC0;
                }
                
                .empty-icon {
                    font-size: 32px;
                    margin-bottom: 16px;
                }
            `}</style>

        </div>
    );
};



const SceneEditor = ({ scene, blueprint, onUpdate }) => {
    const [editedScene, setEditedScene] = useState(scene);

    useEffect(() => {
        setEditedScene(scene);
    }, [scene]);

    const handleChange = (field, value) => {
        const updated = { ...editedScene, [field]: value };
        setEditedScene(updated);
        onUpdate(updated);
    };

    const handleEffectChange = (key, value) => {
        const updatedEffects = { ...editedScene.effects, [key]: value };
        const updated = { ...editedScene, effects: updatedEffects };
        setEditedScene(updated);
        onUpdate(updated);
    }

    return (
        <div className="scene-editor-content">

            <div className="editor-header">
                <h2>장면 #{scene.sequence} 편집</h2>
                <div className="time-range">
                    {(scene.startTime ?? 0).toFixed(1)}s - {(scene.endTime ?? (scene.startTime ?? 0) + (scene.duration ?? 5)).toFixed(1)}s
                </div>
            </div>

            {/* 대본 텍스트 */}
            <div className="editor-section">
                <label>📝 대본 텍스트</label>
                <textarea
                    value={editedScene.text}
                    onChange={e => handleChange('text', e.target.value)}
                    rows={3}
                    className="scene-text-input"
                />
            </div>

            {/* 타이밍 설정 */}
            <div className="editor-section">
                <label>⏱️ 타이밍 설정</label>
                <div className="timing-controls">
                    <div className="timing-input">
                        <span>시작</span>
                        <input
                            type="number"
                            value={editedScene.startTime ?? 0}
                            disabled
                            className="input-disabled"
                        />
                        <span>초</span>
                    </div>
                    <div className="timing-input">
                        <span>길이</span>
                        <input
                            type="number"
                            value={editedScene.duration ?? 5}
                            onChange={e => {
                                const dur = parseFloat(e.target.value);
                                handleChange('duration', dur);
                            }}
                            step="0.5"
                            min="0.5"
                        />
                        <span>초</span>
                    </div>
                </div>
            </div>

            {/* 이미지 프롬프트 */}
            <div className="editor-section">
                <label>🎨 이미지 프롬프트 (영문 번역)</label>
                <textarea
                    value={editedScene.imagePrompt}
                    onChange={e => handleChange('imagePrompt', e.target.value)}
                    rows={3}
                    placeholder="대본의 영문 번역이 자동으로 입력됩니다..."
                    className="prompt-input"
                />
            </div>

            {/* 스타일 및 효과 */}
            <div className="editor-section">
                <label>🎬 효과 설정</label>
                <div className="effect-controls">
                    <div className="control-group">
                        <span>전환 효과</span>
                        <select
                            value={editedScene.transition || 'none'}
                            onChange={e => handleChange('transition', e.target.value)}
                            className="select-input"
                        >
                            <option value="none">없음</option>
                            <option value="fade">페이드</option>
                            <option value="slide">슬라이드</option>
                            <option value="zoom">줌</option>
                        </select>
                    </div>
                    <div className="control-group">
                        <span>텍스트 애니메이션</span>
                        <select
                            value={editedScene.effects?.textAnimation || 'none'}
                            onChange={e => handleEffectChange('textAnimation', e.target.value)}
                            className="select-input"
                        >
                            <option value="none">없음</option>
                            <option value="fade-in">페이드 인</option>
                            <option value="typewriter">타이핑</option>
                            <option value="bounce">바운스</option>
                        </select>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .scene-editor-content {
                    padding: 24px;
                    overflow-y: auto;
                    height: 100%;
                }

                .editor-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid #E2E8F0;
                }
                
                .editor-header h2 {
                    margin: 0;
                    font-size: 18px;
                    color: #2d3748;
                }
                
                .time-range {
                    font-size: 13px;
                    color: #6B5DD8;
                    font-weight: 700;
                    background: #F5F3FF;
                    padding: 4px 10px;
                    border-radius: 6px;
                }

                .editor-section {
                    margin-bottom: 24px;
                }

                .editor-section label {
                    display: block;
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: #4A5568;
                    font-size: 13px;
                }

                .scene-text-input,
                .prompt-input {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid #E2E8F0;
                    border-radius: 8px;
                    font-size: 14px;
                    font-family: inherit;
                    resize: vertical;
                    line-height: 1.6;
                }
                
                .scene-text-input:focus, .prompt-input:focus {
                    outline: none;
                    border-color: #8B7DE8;
                    box-shadow: 0 0 0 1px #8B7DE8;
                }

                .timing-controls {
                    display: flex;
                    gap: 16px;
                }

                .timing-input {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .timing-input input {
                    width: 70px;
                    padding: 8px;
                    border: 1px solid #E2E8F0;
                    border-radius: 6px;
                    text-align: center;
                    font-weight: 600;
                }
                
                .input-disabled {
                    background: #F7FAFC;
                    color: #A0AEC0;
                }
                
                .effect-controls {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                
                .control-group {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                
                .control-group span {
                    font-size: 12px;
                    color: #718096;
                }
                
                .select-input {
                    padding: 8px;
                    border: 1px solid #E2E8F0;
                    border-radius: 6px;
                    font-size: 13px;
                }
                
                .prompt-suggestions {
                    display: flex;
                    gap: 8px;
                    margin-top: 8px;
                }
                .btn-suggestion {
                    padding: 4px 8px;
                    font-size: 11px;
                    background: #EDF2F7;
                    border: 1px solid #CBD5E0;
                    border-radius: 4px;
                    cursor: pointer;
                    color: #4A5568;
                }
                .btn-suggestion:hover {
                    background: #E2E8F0;
                }

                .prompt-suggestions {
                    margin-top: 8px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .btn-translate {
                    padding: 6px 12px;
                    background: #EDF2F7;
                    border: 1px solid #CBD5E0;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 600;
                    color: #4A5568;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    transition: all 0.2s;
                }

                .btn-translate:hover {
                    background: #E2E8F0;
                    color: #2D3748;
                }

                .translate-info {
                    font-size: 11px;
                    color: #718096;
                }
            `}</style>
        </div>
    );
};

const JSONView = ({ scenes, blueprint, script, generateCompleteJSON }) => {
    const [jsonData, setJsonData] = useState('');
    const [isValid, setIsValid] = useState(true);

    useEffect(() => {
        const data = generateCompleteJSON(scenes, blueprint, script);
        setJsonData(JSON.stringify(data, null, 2));
    }, [scenes, blueprint, script]);

    const handleJSONEdit = (value) => {
        setJsonData(value);
        try {
            JSON.parse(value);
            setIsValid(true);
        } catch (error) {
            setIsValid(false);
        }
    };

    const handleCopyJSON = () => {
        navigator.clipboard.writeText(jsonData);
        alert('JSON이 클립보드에 복사되었습니다');
    };

    return (
        <div className="json-view">
            <div className="json-toolbar">
                <div className="validation-status">
                    {isValid ? (
                        <span className="status-valid">✓ 유효한 JSON</span>
                    ) : (
                        <span className="status-invalid">✗ JSON 오류</span>
                    )}
                </div>

                <div className="json-actions">
                    <button onClick={handleCopyJSON} className="btn-json">
                        📋 복사
                    </button>
                </div>
            </div>

            <textarea
                value={jsonData}
                onChange={e => handleJSONEdit(e.target.value)}
                className={`json-textarea ${!isValid ? 'invalid' : ''}`}
                spellCheck={false}
            />

            <style jsx>{`
                .json-view {
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: white;
                    margin: 16px;
                    border-radius: 12px;
                    border: 1px solid #E2E8F0;
                }
                
                .json-toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }
                
                .status-valid { color: #48BB78; font-weight: 600; font-size: 13px; }
                .status-invalid { color: #F56565; font-weight: 600; font-size: 13px; }
                
                .btn-json {
                    padding: 6px 12px;
                    border: 1px solid #E2E8F0;
                    background: white;
                    border-radius: 6px;
                    font-size: 12px;
                    cursor: pointer;
                }
                
                .json-textarea {
                    flex: 1;
                    min-height: 750px;
                    padding: 16px;
                    border: 1px solid #E2E8F0;
                    border-radius: 8px;
                    font-family: 'Monaco', 'Consolas', monospace;
                    font-size: 12px;
                    line-height: 1.6;
                    background: #FAFAFA;
                    resize: vertical;
                    color: #2d3748;
                }
                
                .json-textarea.invalid {
                    border-color: #FC8181;
                    background: #FFF5F5;
                }
                
                .json-textarea:focus {
                    outline: none;
                    border-color: #8B7DE8;
                }
            `}</style>
        </div>
    );
};

export default JSONGeneration;
