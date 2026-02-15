import { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getApiBase } from '../utils/apiBase';

const tonePersonaMap = {
  'senior-expert': {
    name: '시니어 건강 전문가',
    rules: [
      '신뢰감 있는 전문 용어를 사용하되, 문장 끝은 격식체로 유지합니다.',
      '의학적 용어는 이해하기 쉽게 풀어 설명합니다.',
      '존댓말을 일관되게 유지합니다.',
      '차분하고 신뢰감 있게 전달합니다.'
    ],
    preview: '해당 톤은 "하십시오", "입니다" 같은 격식체로 작성됩니다.'
  },
  'friendly-neighbor': {
    name: '친근한 이웃',
    rules: [
      '부드러운 해요체를 사용합니다.',
      '질문을 자주 던져 소통감을 높입니다.'
    ],
    preview: '해당 톤은 "~해요", "~했나요?" 같은 해요체를 사용합니다.'
  },
  'grandchild-friendly': {
    name: '손주처럼 다정한',
    rules: [
      '따뜻하고 애정 어린 말투를 사용합니다.',
      '배려 표현을 포함합니다.'
    ],
    preview: '해당 톤은 애교 섞인 다정한 표현으로 작성됩니다.'
  },
  'charismatic-trainer': {
    name: '카리스마 강사',
    rules: [
      '활기찬 명령조를 사용합니다.',
      '동기부여 표현을 적극 활용합니다.'
    ],
    preview: '해당 톤은 활기찬 명령조로 작성됩니다.'
  },
  'professional-analyst': {
    name: '전문 데이터 분석가',
    rules: [
      '수치와 근거 위주의 문체를 사용합니다.',
      '객관적이고 사실 중심으로 전달합니다.'
    ],
    preview: '해당 톤은 수치 중심의 객관적 문체로 작성됩니다.'
  },
  'emotional-storyteller': {
    name: '감성적인 이야기꾼',
    rules: [
      '따뜻한 위로와 공감을 주는 서술형 문체를 사용합니다.',
      '스토리텔링 기법을 활용합니다.'
    ],
    preview: '해당 톤은 감성적인 서술형 문체로 작성됩니다.'
  },
  'humorous-comedian': {
    name: '유머러스한 만담가',
    rules: [
      '재치 있는 비유와 농담을 섞습니다.',
      '가벼운 유머를 유지합니다.'
    ],
    preview: '해당 톤은 유머러스한 표현으로 작성됩니다.'
  },
  'urgent-news-anchor': {
    name: '긴급 뉴스 앵커',
    rules: [
      '명확하고 간결한 문장 구조를 사용합니다.',
      '중요성을 강조합니다.'
    ],
    preview: '해당 톤은 뉴스 앵커 스타일로 작성됩니다.'
  }
};

const durationOptions = {
  shorts: [
    { value: '30s', label: '30초' },
    { value: '1m', label: '1분' },
    { value: '2m', label: '2분' },
    { value: '3m', label: '3분' }
  ],
  longform: [
    { value: '10m', label: '10분' },
    { value: '20m', label: '20분' },
    { value: '30m', label: '30분' },
    { value: '40m', label: '40분' },
    { value: '50m', label: '50분' },
    { value: '60m', label: '60분' }
  ]
};

function parseKeywords(text) {
  if (!text || !text.trim()) return [];
  return text.split(',').map((keyword) => keyword.trim()).filter(Boolean);
}

function parseStorylineLines(blueprint, fromStep2) {
  let text = blueprint?.storyline || '';
  if (!text && fromStep2?.blueprint?.storyline) {
    text = fromStep2.blueprint.storyline;
  }
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^[0-9]+\)|^[0-9]+\./, '').trim());
  return lines.length ? lines : ['인트로', '핵심 내용', '마무리'];
}

function parseTargetDuration(durationStr) {
  if (durationStr.endsWith('s')) return parseInt(durationStr, 10) / 60;
  if (durationStr.endsWith('m')) return parseInt(durationStr, 10);
  if (durationStr.includes('초')) return parseInt(durationStr.replace(/[^0-9]/g, ''), 10) / 60;
  if (durationStr.includes('분')) return parseInt(durationStr.replace(/[^0-9]/g, ''), 10);
  return 1;
}

// 문자열(예: '30초', '1분', '60분', '30s', '60m') → 초 단위 숫자
function parseDurationSeconds(durationStr) {
  const str = String(durationStr || '').trim();
  if (str.endsWith('s')) return parseInt(str, 10);
  if (str.endsWith('m')) return parseInt(str, 10) * 60;
  if (str.includes('초')) return parseInt(str.replace(/[^0-9]/g, ''), 10);
  if (str.includes('분')) return parseInt(str.replace(/[^0-9]/g, ''), 10) * 60;
  return 60; // 기본 1분
}

function formatDuration(minutes) {
  if (minutes < 1) return `${Math.round(minutes * 60)}초`;
  const mins = Math.floor(minutes);
  const secs = Math.round((minutes - mins) * 60);
  if (secs === 0) return `${mins}분`;
  if (secs === 60) return `${mins + 1}분`;
  return `${mins}분 ${secs}초`;
}

function countWords(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

function cleanScriptForDisplay(script) {
  return String(script || '')
    .replace(/^\[씬\s*\d+\]\s*/gm, '')
    .replace(/역할:.*$/gm, '')
    .replace(/지시사항:.*$/gm, '')
    .replace(/인사이트:.*$/gm, '')
    .replace(/이 부분에서는.*$/gm, '')
    .replace(/알겠습니다[.!]?/gm, '')
    .replace(/작성된 대본입니다[.!]?/gm, '')
    .trim();
}

function getLastSentence(text) {
  const sentences = String(text || '').split(/(?<=[.!?。！？])\s+/).filter(Boolean);
  if (!sentences.length) return '';
  return sentences[sentences.length - 1];
}

function buildApiPrompt({
  blueprint,
  requiredKeywords,
  tone,
  currentFormat,
  currentDuration,
  fromStep2,
  externalContext
}) {
  const persona = tonePersonaMap[tone] || tonePersonaMap['senior-expert'];
  const scenes = parseStorylineLines(blueprint, fromStep2);
  const format = currentFormat;
  const duration = currentDuration;
  const targetMinutes = parseTargetDuration(duration);

  let sceneCount = scenes.length;
  if (format === 'shorts') {
    sceneCount = targetMinutes <= 1 ? Math.max(5, Math.min(6, Math.round(targetMinutes * 5.5))) : Math.round(targetMinutes * 2);
  } else {
    sceneCount = Math.max(20, Math.round(targetMinutes * 2));
    if (targetMinutes >= 60) sceneCount = Math.max(120, sceneCount);
    else if (targetMinutes >= 40) sceneCount = Math.max(80, sceneCount);
  }

  const adjustedScenes = targetMinutes >= 60
    ? Array.from({ length: 120 }, () => '')
    : scenes.concat(Array.from({ length: Math.max(0, sceneCount - scenes.length) }, () => ''));

  return {
    title: blueprint?.title || '(제목 미정)',
    target: blueprint?.target || '(타겟 미정)',
    hook: blueprint?.hook || '(훅 미정)',
    storyline: blueprint?.storyline || '',
    scenes: adjustedScenes,
    sceneCount,
    requiredSceneCount: sceneCount,
    format,
    duration,
    targetMinutes,
    targetWordCount: Math.round(targetMinutes * 160),
    perSceneMinWords: targetMinutes >= 60 ? 200 : undefined,
    tone,
    requiredKeywords,
    tonePersona: {
      name: persona.name,
      rules: persona.rules
    },
    sourceContext: externalContext || null,
    constraints: ['톤에 맞지 않는 어미나 표현을 절대 사용하지 마세요.'],
    durationInstructions: `목표 영상 길이는 ${targetMinutes < 1 ? Math.round(targetMinutes * 60) + '초' : targetMinutes + '분'}입니다. 1분당 160단어 이상을 작성하세요.`,
    numericalProtection: {
      enabled: true,
      instruction: '대본 내 수치 데이터는 변경하지 마세요.'
    },
    systemInstruction: '너는 시니어 건강 전문가다. 구어체로 대사만 작성하라.',
    instruction: '시니어 건강 전문가 톤앤매너를 유지하며 구어체로 작성하세요.'
  };
}

export default function Step3Page() {
  const [blueprint, setBlueprint] = useState({ title: '', target: '', hook: '', storyline: '' });
  const [fromStep2, setFromStep2] = useState(null);
  const [externalSummary, setExternalSummary] = useState('');
  const [externalRaw, setExternalRaw] = useState('');
  const [externalContext, setExternalContext] = useState(null);
  const [tone, setTone] = useState('senior-expert');
  const [currentFormat, setCurrentFormat] = useState('shorts');
  const [currentDuration, setCurrentDuration] = useState('1m');
  const [requiredKeywordsInput, setRequiredKeywordsInput] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [originalScript, setOriginalScript] = useState(''); // 원본 대본 저장용
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [apiError, setApiError] = useState('');
  const [longformState, setLongformState] = useState({
    totalScenes: 120,
    completedScenes: 0,
    totalChapters: 12
  });
  const [showDashboard, setShowDashboard] = useState(false);
  const [statusLines, setStatusLines] = useState([]);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [modalMode, setModalMode] = useState('url'); // 'file' or 'url'
  const stopRequestedRef = useRef(false);
  const abortControllerRef = useRef(null);
  const autoTriggeredRef = useRef(false);
  const handleGenerateRef = useRef(() => {});
  const fileInputRef = useRef(null);
  const urlInputRef = useRef(null);

  const scenes = useMemo(() => parseStorylineLines(blueprint, fromStep2), [blueprint, fromStep2]);
  const targetMinutes = parseTargetDuration(currentDuration);
  const currentMinutes = countWords(scriptText) / 160;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('step3Blueprint');
      if (raw) {
        const step3Data = JSON.parse(raw);
        if (step3Data?.blueprint) setBlueprint(step3Data.blueprint);
        if (step3Data?.fromStep2) setFromStep2(step3Data.fromStep2);
      }
      const format = localStorage.getItem('currentFormat');
      const duration = localStorage.getItem('currentDuration');
      if (format === 'shorts' || format === 'longform') setCurrentFormat(format);
      if (duration) setCurrentDuration(duration);
      const globalStateRaw = localStorage.getItem('globalState');
      if (globalStateRaw) {
        const globalState = JSON.parse(globalStateRaw);
        if (globalState?.keyword) setRequiredKeywordsInput(globalState.keyword);
        const scriptTextFromState = globalState?.scriptText || '';
        const summaryFromState = globalState?.generatedMaterials?.summary || '';
        const modeFromState = globalState?.generatedMaterials?.mode || undefined;
        if (summaryFromState) setExternalSummary(summaryFromState);
        if (scriptTextFromState) setExternalRaw(scriptTextFromState);
        if (summaryFromState || scriptTextFromState) {
          setExternalContext({
            raw: scriptTextFromState,
            summary: summaryFromState,
            mode: modeFromState
          });
        }
      }
      
      // 3단계로 직접 진입한 경우: raw_source_script 또는 final_script 확인
      const rawSourceScript = localStorage.getItem('raw_source_script');
      const finalScript = localStorage.getItem('final_script');
      if (rawSourceScript && !scriptText) {
        setScriptText(rawSourceScript);
        setOriginalScript(rawSourceScript); // 원본 저장
      } else if (finalScript && !scriptText) {
        setScriptText(finalScript);
        setOriginalScript(finalScript); // 원본 저장
      }
      
      // 원본 대본이 localStorage에 저장되어 있으면 불러오기
      const savedOriginal = localStorage.getItem('step3OriginalScript');
      if (savedOriginal) {
        setOriginalScript(savedOriginal);
      }
      
      // 2단계에서 AI 생성 후 3단계로 이동한 경우: 생성된 대본 확인
      const autoGenerate = localStorage.getItem('autoGenerateScript');
      if (autoGenerate === 'true') {
        localStorage.removeItem('autoGenerateScript');
        // 2단계에서 생성된 대본이 있다면 로드 (step3Blueprint에 저장되어 있을 수 있음)
        if (finalScript && !scriptText) {
          setScriptText(finalScript);
        }
      }
    } catch (error) {
      console.warn('[Step 3] 초기 데이터 로드 실패:', error);
    }
  }, []);

  // scriptText가 처음 설정될 때 원본으로 저장
  useEffect(() => {
    if (scriptText && !originalScript && typeof window !== 'undefined') {
      setOriginalScript(scriptText);
      localStorage.setItem('step3OriginalScript', scriptText);
    }
  }, [scriptText]);

  useEffect(() => {
    if (!durationOptions[currentFormat].some((opt) => opt.value === currentDuration)) {
      setCurrentDuration(durationOptions[currentFormat][0].value);
    }
  }, [currentFormat]);


  // 모달이 열리고 URL 모드일 때 URL 입력 필드에 포커스
  useEffect(() => {
    if (showSourceModal && modalMode === 'url' && urlInputRef.current) {
      const timer = setTimeout(() => {
        urlInputRef.current?.focus();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [showSourceModal, modalMode]);

  // [No-Prompt Full-Auto] ?auto=60m 이면 60분 선택 후 자동으로 12회 릴레이 생성 시작
  const router = useRouter();
  useEffect(() => {
    if (typeof window === 'undefined' || !router.isReady) return;
    const auto = router.query.auto || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('auto') : null);
    if (auto !== '60m') return;
    setCurrentFormat('longform');
    setCurrentDuration('60m');
  }, [router.isReady, router.query.auto]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const auto = new URLSearchParams(window.location.search).get('auto');
    if (auto !== '60m' || autoTriggeredRef.current || isGenerating) return;
    if (currentFormat !== 'longform' || currentDuration !== '60m') return;
    autoTriggeredRef.current = true;
    const t = setTimeout(() => {
      handleGenerateRef.current();
    }, 800);
    return () => clearTimeout(t);
  }, [currentFormat, currentDuration, isGenerating]);

  function appendStatus(message) {
    setStatusLines((prev) => [...prev.slice(-20), message]);
  }

  function updateProgress(additionalScenes) {
    setLongformState((prev) => ({
      ...prev,
      completedScenes: Math.min(prev.totalScenes, prev.completedScenes + additionalScenes)
    }));
  }

  async function requestScript(payload, retryCount = 0) {
    abortControllerRef.current = new AbortController();
    const response = await fetch(getApiBase() + '/api/generate-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: abortControllerRef.current.signal
    });
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        const text = await response.text();
        errorData = { error: text };
      }
      
      // 429 할당량 초과: 재시도 불가 (사용자에게 명확한 메시지)
      if (response.status === 429) {
        const retryDelay = errorData.retryDelay || 60;
        throw new Error(`할당량 초과: 무료 티어는 하루 20회 제한입니다. ${Math.ceil(retryDelay)}초 후 재시도 가능하지만, 할당량이 충족되지 않으면 내일까지 대기해야 합니다.`);
      }

      // 응답이 너무 짧음 → 한 번 재시도 후 포기
      const shortMsg = errorData.error || errorData.detail || '';
      if (shortMsg.includes('너무 짧습니다') && retryCount < 1) {
        await new Promise((r) => setTimeout(r, 1000));
        return requestScript(payload, retryCount + 1);
      }

      throw new Error(`API 응답 실패: ${response.status} ${errorData.error || errorData.detail || JSON.stringify(errorData)}`);
    }
    return response.json();
  }

  async function handleGenerate() {
    const keywords = parseKeywords(requiredKeywordsInput);
    setApiError('');
    setIsGenerating(true);
    setStatusLines([]);
    stopRequestedRef.current = false;

    try {
      const apiPrompt = buildApiPrompt({
        blueprint,
        requiredKeywords: keywords,
        tone,
        currentFormat,
        currentDuration,
        fromStep2,
        externalContext
      });

      const totalSeconds = parseDurationSeconds(currentDuration);
      const totalMinutes = Math.round(totalSeconds / 60);
      // 5분 단위 릴레이 원칙: 롱폼은 항상 5분(300초) 단위로 분할
      const chunkSeconds = 300; // 5분 고정
      const totalChapters = totalSeconds <= 300 ? 1 : Math.ceil(totalSeconds / chunkSeconds);

      if (totalChapters > 1) {
        setShowDashboard(true);
        // 씬 수는 챕터당 10 씬 가정
        setLongformState({ totalScenes: totalChapters * 10, completedScenes: 0, totalChapters });
        appendStatus(`${totalMinutes}분 릴레이 엔진 시작 (총 ${totalChapters}회, 1회당 정확히 5분)`);

        let previousContext = '';
        const collectedScripts = [];

        const seniorExpertTone = {
          name: '시니어 건강 전문가',
          rules: [
            '신뢰감 있는 전문 용어를 사용하되, 문장 끝은 격식체로 유지합니다.',
            '의학적 용어는 이해하기 쉽게 풀어 설명합니다.',
            '존댓말을 일관되게 유지합니다.',
            '차분하고 신뢰감 있게 전달합니다.'
          ]
        };
        for (let i = 0; i < totalChapters; i += 1) {
          if (stopRequestedRef.current) break;
          const remainingSeconds = totalSeconds - i * chunkSeconds;
          const segmentSeconds = Math.min(chunkSeconds, remainingSeconds);
          const segmentMinutes = segmentSeconds / 60;
          const isLast = i === totalChapters - 1;
          appendStatus(`[${i + 1}/${totalChapters}] 챕터 생성 중... (${segmentMinutes}분 분량)`);

          const timeInstruction = `현재 총 ${totalMinutes}분 중 ${i + 1}번째 섹션을 작성 중이다. 각 섹션은 정확히 5분 분량의 내용을 담아야 한다. 전체적인 기승전결이 무너지지 않도록, 이전 섹션의 흐름을 자연스럽게 이어받아 다음 섹션으로 연결될 수 있도록 작성하라. 단순 요약이 아닌 실제 낭독용 Full Script로, 구체적 사례/단계별 설명/따라 할 멘트를 충분히 포함하라.`;

          const segmentPayload = {
            ...apiPrompt,
            targetMinutes: segmentMinutes,
            requiredSceneCount: 10,
            previous_context: previousContext,
            isLast,
            currentChapter: i + 1,
            totalChapters,
            systemInstruction: '너는 시니어 건강 전문가다. 구어체로 대사만 작성하라. 릴레이 전 구간 동일 톤을 유지하라.',
            tonePersona: seniorExpertTone,
            instruction: `${apiPrompt.instruction || ''} 시니어 건강 전문가 구어체 지침을 최우선으로 적용하라. ${timeInstruction}`
          };
          
          try {
            const segmentData = await requestScript(segmentPayload);
            const segmentScript = segmentData?.script || '';
            collectedScripts.push(segmentScript);
            previousContext = segmentData?.last_two_sentences || getLastSentence(segmentScript) || previousContext;

            updateProgress(segmentData?.scene_count || 10);
            setScriptText(cleanScriptForDisplay(collectedScripts.join('\n\n')));
          } catch (segmentError) {
            // 할당량 초과 시 중단하고 현재까지 생성된 내용 저장
            if (segmentError.message.includes('할당량 초과')) {
              appendStatus(`[중단] ${i + 1}번째 챕터에서 할당량 초과 발생`);
              appendStatus(`현재까지 ${i}개 챕터 생성 완료. 생성된 내용은 저장되었습니다.`);
              if (collectedScripts.length > 0) {
                setScriptText(cleanScriptForDisplay(collectedScripts.join('\n\n')));
              }
              throw segmentError; // 상위로 전파하여 사용자에게 알림
            }
            throw segmentError;
          }
        }

        appendStatus('릴레이 생성 완료');
      } else {
        // 단일 호출: 선택된 시간에 맞춰 프롬프트에 명시
        const singleTimeInstruction = totalSeconds >= 60
          ? `${Math.round(totalSeconds / 60)}분 내외로 읽을 수 있는 대본을 작성하라. 단순 요약이 아닌 낭독용 Full Script로, 구체적 사례/단계별 설명/따라 할 멘트 포함.`
          : `${totalSeconds}초 내외로 읽을 수 있는 짧고 강렬한 대본을 작성하라. 단순 요약이 아닌 낭독용 Full Script로, 구체적 사례/단계별 설명/따라 할 멘트 포함.`;

        const singlePrompt = {
          ...apiPrompt,
          isLast: true,
          currentChapter: 1,
          totalChapters: 1,
          instruction: `${apiPrompt.instruction || ''} ${singleTimeInstruction}`
        };

        const data = await requestScript(singlePrompt);
        if (!data?.script) throw new Error('API 응답이 비어 있습니다.');
        setScriptText(cleanScriptForDisplay(data.script));
      }
    } catch (error) {
      console.error('[Step 3] 대본 생성 오류:', error);
      const errorMsg = error?.message || '대본 생성 실패';
      if (errorMsg.includes('할당량 초과')) {
        setApiError('할당량 초과: 무료 티어는 하루 20회 제한입니다. 60분 생성은 12회 호출이 필요하므로 할당량이 부족할 수 있습니다.');
        appendStatus(`⚠️ ${errorMsg}`);
        appendStatus('💡 해결 방법: Google AI Studio에서 유료 플랜으로 업그레이드하거나, 내일 다시 시도해주세요.');
      } else {
        setApiError('API 연결 확인 필요');
        appendStatus(`오류: ${errorMsg}`);
      }
    } finally {
      setIsGenerating(false);
    }
  }
  handleGenerateRef.current = handleGenerate;

  async function handleRegenerate() {
    if (!scriptText.trim()) {
      alert('재생성할 대본이 없습니다. 먼저 대본을 입력해주세요.');
      return;
    }

    // 현재 대본을 원본으로 저장 (재생성 전에 현재 상태를 원본으로 저장)
    // 재생성 후 되돌리기를 위해 현재 대본을 원본으로 업데이트
    setOriginalScript(scriptText);
    localStorage.setItem('step3OriginalScript', scriptText);

    const keywords = parseKeywords(requiredKeywordsInput);
    setApiError('');
    setIsRegenerating(true);
    setStatusLines([]);
    stopRequestedRef.current = false;

    try {
      // 원본 대본을 sourceContext로 사용
      const sourceContext = {
        raw: scriptText,
        summary: scriptText.substring(0, 500) + '...',
        mode: 'regenerate'
      };

      const apiPrompt = buildApiPrompt({
        blueprint,
        requiredKeywords: keywords,
        tone,
        currentFormat,
        currentDuration,
        fromStep2,
        externalContext: sourceContext
      });

      // 100만 조회수 이상 채널의 골격을 모태로 하라는 지시 추가
      const regenerateInstruction = `원본 대본을 바탕으로, 100만 조회수 이상의 인기 채널의 영상 골격과 구조를 모태로 하여 똑같은 주제로 대본을 재생성하세요. 
- 인기 채널의 특징: 강력한 훅, 명확한 구조, 시청자 참여 유도, 핵심 메시지 반복, 자연스러운 전환
- 원본 대본의 핵심 내용과 주제는 유지하되, 표현 방식과 구조를 더욱 효과적으로 개선
- 시청자 몰입도를 높이는 스토리텔링 기법 적용
- 각 씬이 자연스럽게 연결되도록 구성`;

      const totalSeconds = parseDurationSeconds(currentDuration);
      const totalMinutes = Math.round(totalSeconds / 60);
      const chunkSeconds = 300;
      const totalChapters = totalSeconds <= 300 ? 1 : Math.ceil(totalSeconds / chunkSeconds);

      if (totalChapters > 1) {
        setShowDashboard(true);
        setLongformState({ totalScenes: totalChapters * 10, completedScenes: 0, totalChapters });
        appendStatus(`${totalMinutes}분 재생성 시작 (총 ${totalChapters}회)`);

        let previousContext = '';
        const collectedScripts = [];

        const seniorExpertTone = {
          name: '시니어 건강 전문가',
          rules: [
            '신뢰감 있는 전문 용어를 사용하되, 문장 끝은 격식체로 유지합니다.',
            '의학적 용어는 이해하기 쉽게 풀어 설명합니다.',
            '존댓말을 일관되게 유지합니다.',
            '차분하고 신뢰감 있게 전달합니다.'
          ]
        };

        for (let i = 0; i < totalChapters; i += 1) {
          if (stopRequestedRef.current) break;
          const remainingSeconds = totalSeconds - i * chunkSeconds;
          const segmentSeconds = Math.min(chunkSeconds, remainingSeconds);
          const segmentMinutes = segmentSeconds / 60;
          const isLast = i === totalChapters - 1;

          appendStatus(`[${i + 1}/${totalChapters}] 재생성 중...`);

          const segmentPayload = {
            ...apiPrompt,
            targetMinutes: segmentMinutes,
            requiredSceneCount: 10,
            previous_context: previousContext,
            isLast,
            currentChapter: i + 1,
            totalChapters,
            systemInstruction: '너는 시니어 건강 전문가다. 구어체로 대사만 작성하라.',
            tonePersona: seniorExpertTone,
            instruction: `${regenerateInstruction} ${apiPrompt.instruction || ''}`,
            sourceContext: sourceContext
          };

          try {
            const segmentData = await requestScript(segmentPayload);
            const segmentScript = segmentData?.script || '';
            collectedScripts.push(segmentScript);
            previousContext = segmentData?.last_two_sentences || getLastSentence(segmentScript) || previousContext;

            updateProgress(segmentData?.scene_count || 10);
            setScriptText(cleanScriptForDisplay(collectedScripts.join('\n\n')));
          } catch (segmentError) {
            if (segmentError.message.includes('할당량 초과')) {
              appendStatus(`[중단] ${i + 1}번째 챕터에서 할당량 초과 발생`);
              if (collectedScripts.length > 0) {
                setScriptText(cleanScriptForDisplay(collectedScripts.join('\n\n')));
              }
              throw segmentError;
            }
            throw segmentError;
          }
        }

        appendStatus('재생성 완료');
      } else {
        const singlePrompt = {
          ...apiPrompt,
          isLast: true,
          currentChapter: 1,
          totalChapters: 1,
          instruction: `${regenerateInstruction} ${apiPrompt.instruction || ''}`,
          sourceContext: sourceContext
        };

        const data = await requestScript(singlePrompt);
        if (!data?.script) throw new Error('API 응답이 비어 있습니다.');
        setScriptText(cleanScriptForDisplay(data.script));
        appendStatus('재생성 완료');
      }
    } catch (error) {
      console.error('[Step 3] 대본 재생성 오류:', error);
      const errorMsg = error?.message || '대본 재생성 실패';
      if (errorMsg.includes('할당량 초과')) {
        setApiError('할당량 초과: 무료 티어는 하루 20회 제한입니다.');
        appendStatus(`⚠️ ${errorMsg}`);
      } else {
        setApiError('재생성 중 오류가 발생했습니다.');
        appendStatus(`오류: ${errorMsg}`);
      }
    } finally {
      setIsRegenerating(false);
    }
  }

  function handleRevert() {
    if (!originalScript) {
      alert('되돌릴 원본 대본이 없습니다.');
      return;
    }
    if (confirm('원본 대본으로 되돌리시겠습니까? 현재 수정된 내용은 사라집니다.')) {
      setScriptText(originalScript);
    }
  }

  function handleStopAndSave() {
    stopRequestedRef.current = true;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (typeof window !== 'undefined') {
      const payload = {
        script: scriptText,
        tone,
        format: currentFormat,
        duration: currentDuration,
        targetMinutes: parseTargetDuration(currentDuration),
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('step3InterruptedScript', JSON.stringify(payload));
      if (typeof window !== 'undefined') {
        alert('생성이 중단되었습니다. 현재 결과물이 저장되었습니다.');
      }
    }
  }

  async function handleLoadUrl() {
    if (!sourceUrl.trim()) {
      if (typeof window !== 'undefined') {
        alert('URL을 입력해 주세요.');
      }
      return;
    }
    setIsLoadingSource(true);
    try {
      const res = await fetch(getApiBase() + '/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sourceUrl.trim() })
      });
      const data = await res.json();
      if (data.success && (data.text || data.title || data.description)) {
        const text = data.text || (data.title && data.description ? data.title + '\n\n' + data.description : data.title || data.description);
        setScriptText(text);
        setSourceUrl('');
        setShowSourceModal(false);
      } else {
        if (typeof window !== 'undefined') {
          alert(data.error || 'URL 내용을 가져오지 못했습니다.');
        }
      }
    } catch (e) {
      if (typeof window !== 'undefined') {
        alert('URL을 불러오지 못했습니다. 네트워크를 확인해 주세요.');
      }
    } finally {
      setIsLoadingSource(false);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setScriptText(text);
      if (showSourceModal) {
        setShowSourceModal(false);
      }
    } catch (err) {
      if (typeof window !== 'undefined') {
        alert('파일을 읽는 중 오류가 발생했습니다.');
      }
    }
  }

  function handleGoToStep4() {
    if (!scriptText.trim()) {
      if (typeof window !== 'undefined' && !confirm('대본이 비어 있습니다. 그래도 다음 단계로 이동하시겠습니까?')) return;
    }
    const keywords = parseKeywords(requiredKeywordsInput);
    const finalScript = scriptText.trim();
    
    if (typeof window !== 'undefined') {
      // final_script로 통합하여 저장
      const step3Payload = {
        script: finalScript,
        final_script: finalScript, // 통합 변수
        tone,
        keywords,
        format: currentFormat,
        duration: currentDuration,
        targetMinutes: parseTargetDuration(currentDuration),
        blueprint,
        fromStep2,
        scenes
      };
      localStorage.setItem('step3Blueprint', JSON.stringify(step3Payload));
      localStorage.setItem('final_script', finalScript); // 별도로도 저장
      localStorage.setItem('currentFormat', currentFormat);
      localStorage.setItem('currentDuration', currentDuration);

      const payload = {
        blueprint,
        fromStep2,
        script: finalScript,
        final_script: finalScript, // 통합 변수
        scenes,
        tone,
        tonePersona: tonePersonaMap[tone] || tonePersonaMap['senior-expert'],
        requiredKeywords: keywords
      };
      localStorage.setItem('step4JsonPayload', JSON.stringify(payload));
      router.push('/step-4-1');
    }
  }

  const durationGaugeClass = (() => {
    if (!scriptText.trim()) return 'duration-gauge';
    const diff = Math.abs(currentMinutes - targetMinutes);
    const tolerance = targetMinutes * 0.2;
    if (diff <= tolerance) return 'duration-gauge success';
    if (currentMinutes < targetMinutes * 0.5 || currentMinutes > targetMinutes * 1.5) return 'duration-gauge error';
    return 'duration-gauge warning';
  })();

  const longformPercent = longformState.totalScenes > 0
    ? Math.min(100, Math.round((longformState.completedScenes / longformState.totalScenes) * 100))
    : 0;

  return (
    <>
      <Head>
        <title>3. 대본 직접 입력</title>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-logo" onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = 'ai-automation-project.html';
            }
          }}>
            HANRA STUDIO
          </div>
          <div className="sidebar-card">
            <div className="workflow-title">진행 단계</div>
            <ul className="workflow-list">
              <li>
                <a
                  href="ai-automation-project.html"
                  className={`workflow-item ${!fromStep2 && !blueprint?.title ? 'disabled' : ''}`}
                  onClick={(e) => {
                    if (!fromStep2 && !blueprint?.title) {
                      e.preventDefault();
                    }
                  }}
                >
                  1. 주제 추천
                </a>
              </li>
              <li>
                <a
                  href="step-2.html"
                  className={`workflow-item ${!fromStep2 && !blueprint?.title ? 'disabled' : ''}`}
                  onClick={(e) => {
                    if (!fromStep2 && !blueprint?.title) {
                      e.preventDefault();
                    }
                  }}
                >
                  2. AI 대본 생성
                </a>
              </li>
              <li><a href="step-3.html" className="workflow-item active">3. 대본 직접 입력</a></li>
              <li><a href="step-4-1.html" className="workflow-item">4-1. JSON 생성</a></li>
              <li><a href="step-4-2.html" className="workflow-item">4-2. 이미지 생성</a></li>
              <li><a href="step-6.html" className="workflow-item">5. TTS 생성</a></li>
              <li><a href="step-5-2.html" className="workflow-item">5-2. BGM 삽입</a></li>
              <li><a href="step-7.html" className="workflow-item">6. 영상 렌더링</a></li>
              <li><a href="step-8.html" className="workflow-item">7. 제목/설명 작성</a></li>
              <li><a href="step-9.html" className="workflow-item">8. 썸네일 생성기</a></li>
              <li><a href="step-10.html" className="workflow-item">9. 최종 제작</a></li>
              <li><a href="step-11.html" className="workflow-item">10. 쇼츠 자동 변환</a></li>
              <li><a href="step-12.html" className="workflow-item">11. 채널 매니저</a></li>
              <li><a href="step-13.html" className="workflow-item">12. 작업 보관함</a></li>
            </ul>
          </div>
        </aside>

        <main className="main">
          <div className="header-row">
            <div className="title-area">
              <h1>3. 대본 직접 입력</h1>
              <p className="subtitle">AI 대본생성에서 자동으로 생성된 대본의 요약 정보를 확인합니다.</p>
            </div>
          </div>

          <section className="content-card recap-card">
            <div className="field-label">AI 대본 요약</div>
            <p className="section-desc">2단계에서 확정한 제목·타겟·훅 문구를 다시 한 번 확인합니다.</p>
            <div className="recap-grid">
              {blueprint?.title && (
                <div className="recap-item">
                  <div className="recap-label">제목</div>
                  <div className="recap-value">{blueprint.title}</div>
                </div>
              )}
              {blueprint?.target && (
                <div className="recap-item">
                  <div className="recap-label">타겟 시청자</div>
                  <div className="recap-value">{blueprint.target}</div>
                </div>
              )}
              {blueprint?.hook && (
                <div className="recap-item">
                  <div className="recap-label">훅(Hook) 문구</div>
                  <div className="recap-value">{blueprint.hook}</div>
                </div>
              )}
              {externalSummary && (
                <div className="recap-item">
                  <div className="recap-label">직접 입력 대본 요약</div>
                  <div className="recap-value">{externalSummary}</div>
                </div>
              )}
              {!blueprint?.title && !blueprint?.target && !blueprint?.hook && !externalSummary && (
                <div className="recap-item">
                  <div className="recap-value">2단계 기획안 정보가 없습니다. 이전 단계에서 다시 설정해 주세요.</div>
                </div>
              )}
            </div>
          </section>

          {/* AI 대본 생성 섹션 제거됨 - 2단계로 이동 */}

          {/* 대본 입력/수정 섹션 */}
          <section className="content-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div className="field-label" style={{ marginBottom: 0 }}>내가 직접 편집한 대본</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-import-icon"
                  onClick={() => {
                    // 모달 없이 바로 파일 선택 다이얼로그 열기
                    fileInputRef.current?.click();
                  }}
                  title="내 컴퓨터에서 파일 불러오기"
                  aria-label="내 컴퓨터에서 파일 불러오기"
                >
                  📂
                </button>
                <button
                  type="button"
                  className="btn-import-icon"
                  onClick={() => {
                    setModalMode('url');
                    setShowSourceModal(true);
                  }}
                  title="URL에서 불러오기"
                  aria-label="URL에서 불러오기"
                >
                  🔗
                </button>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '16px' }}>
                  <button
                    type="button"
                    className="btn-regenerate"
                    onClick={handleRegenerate}
                    disabled={!scriptText.trim() || isRegenerating || isGenerating}
                  >
                    {isRegenerating ? '재생성 중...' : '🔄 재생성'}
                  </button>
                  <button
                    type="button"
                    className="btn-revert"
                    onClick={handleRevert}
                    disabled={!originalScript || scriptText === originalScript}
                  >
                    ↶ 되돌리기
                  </button>
                </div>
              </div>
            </div>
            <p className="section-desc">2단계에서 생성된 AI 대본을 확인하고, 수정하거나, 직접 작성한 대본을 입력/수정/재생성 할수 있습니다.</p>
            <div className="editor-wrapper">
              <textarea
                className="editor-textarea"
                value={scriptText}
                onChange={(e) => {
                  setScriptText(e.target.value);
                  // 수정 시 원본이 없으면 현재 내용을 원본으로 저장
                  if (!originalScript && e.target.value.trim()) {
                    setOriginalScript(e.target.value);
                    localStorage.setItem('step3OriginalScript', e.target.value);
                  }
                }}
                placeholder=""
                style={{ minHeight: '500px' }}
              />
              {scriptText && (
                <div className={durationGaugeClass}>
                  현재 분량: <strong>{formatDuration(currentMinutes)}</strong>
                </div>
              )}
            </div>
          </section>

          {showDashboard && (
            <section className="longform-dashboard">
              <div className="longform-dashboard-title">실시간 장편 제작 대시보드</div>
              <div className="longform-progress-bar">
                <div className="longform-progress-fill" style={{ width: `${longformPercent}%` }} />
              </div>
              <div className="longform-status-row">
                <div>{longformState.completedScenes}/{longformState.totalScenes} 씬 생성 중...</div>
                <div>예상 길이: {Math.round(currentMinutes)}분</div>
              </div>
              <div className="chapter-indicators">
                {Array.from({ length: longformState.totalChapters }).map((_, idx) => {
                  const doneChapters = Math.floor(longformState.completedScenes / 10);
                  const className = idx < doneChapters ? 'chapter-indicator done' : idx === doneChapters ? 'chapter-indicator active' : 'chapter-indicator';
                  return <div key={`chapter-${idx}`} className={className} />;
                })}
              </div>
              <div className="dashboard-actions">
                <button className="btn-stop-save" type="button" onClick={handleStopAndSave}>
                  생성 중단 및 저장
                </button>
              </div>
            </section>
          )}

          <section className="content-card">
            <button className="btn-primary btn-next" type="button" onClick={handleGoToStep4}>
              4-1. JSON 생성 단계로 이동
            </button>
          </section>
        </main>
      </div>

      {statusLines.length > 0 && (
        <div className="status-window">
          <div className="status-window-title">실시간 상태</div>
          {statusLines.map((line, idx) => (
            <div key={`status-${idx}`} className="status-window-line">{line}</div>
          ))}
        </div>
      )}

      {/* 숨겨진 파일 입력 (폴더 아이콘에서 직접 사용) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/plain"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* 외부 소스 불러오기 모달 (URL용) */}
      {showSourceModal && (
        <div className="modal-overlay" onClick={() => setShowSourceModal(false)}>
          <div className="source-modal" onClick={(e) => e.stopPropagation()}>
            <div className="source-modal-header">
              <h2 className="source-modal-title">외부 소스 불러오기</h2>
              <button
                type="button"
                className="source-modal-close"
                onClick={() => setShowSourceModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="source-modal-body">
              <div className="source-option">
                <label className="source-label">파일 업로드 (.txt)</label>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                >
                  파일 선택
                </button>
              </div>
              <div className="source-option">
                <label className="source-label">URL 입력</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    ref={urlInputRef}
                    type="text"
                    className="source-url-input"
                    placeholder="https://..."
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleLoadUrl();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleLoadUrl}
                    disabled={isLoadingSource}
                  >
                    {isLoadingSource ? '불러오는 중...' : '불러오기'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif;
          background: #f5f5f5;
          color: #333;
          min-height: 100vh;
        }
        .layout { display: flex; min-height: 100vh; }
        .sidebar {
          width: 300px;
          background: linear-gradient(180deg, #fafbff 0%, #f2f4f8 100%);
          border-right: 1px solid #e8ecf4;
          padding: 20px 16px 24px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 20px;
          height: 100vh;
          overflow-y: auto;
        }
        .sidebar-logo {
          font-weight: 700;
          font-size: 1.5rem;
          letter-spacing: 0.05em;
          color: #2d3748;
          margin-top: 8px;
          padding-left: 4px;
          cursor: pointer;
        }
        .sidebar-card {
          background: #fff;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          border: 1px solid rgba(0,0,0,0.04);
        }
        .workflow-title {
          font-size: 13px;
          font-weight: 700;
          color: #4a5568;
          margin-bottom: 12px;
          padding: 0 4px;
        }
        .workflow-list { list-style: none; padding-right: 4px; }
        .workflow-item {
          display: block;
          padding: 12px 14px;
          margin-bottom: 6px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          color: #4a5568;
          background: #fff;
          border: 1px solid #e2e8f0;
          text-decoration: none;
        }
        .workflow-item.active {
          background: linear-gradient(135deg, #e9d8fd 0%, #e2e8f0 100%);
          border-color: #b794f4;
          color: #553c9a;
          font-weight: 600;
        }
        /* 1~2단계(AI 창작)와 3단계(사용자 제어) 시각적 구분 */
        .workflow-list li:nth-child(3) .workflow-item {
          margin-top: 10px;
          border-top: 1px dashed #e2e8f0;
          padding-top: 14px;
        }
        .main { flex: 1; padding: 24px 32px 40px; overflow-y: auto; }
        .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .title-area h1 { font-size: 24px; font-weight: 700; color: #222; margin-bottom: 4px; }
        .subtitle { font-size: 14px; color: #666; margin: 0; }
        .content-card {
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          margin-bottom: 20px;
        }
        .recap-card { background: #fff7fb; border-color: #fed7e2; }
        .recap-grid { display: grid; grid-template-columns: 1fr; gap: 8px; }
        .recap-item { padding: 8px 10px; border-radius: 8px; background: rgba(255,255,255,0.9); border: 1px solid #fed7e2; }
        .recap-label { font-size: 12px; font-weight: 700; color: #d53f8c; margin-bottom: 2px; }
        .recap-value { font-size: 13px; color: #333; line-height: 1.5; white-space: pre-line; }
        .field-label { font-size: 14px; font-weight: 700; color: #2d3748; margin-bottom: 8px; }
        .section-desc { font-size: 13px; color: #666; margin-bottom: 12px; line-height: 1.5; }
        .top-selection-bar {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
          padding: 12px;
          background: #f7fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          flex-wrap: wrap;
        }
        .format-toggle { display: flex; gap: 4px; background: #fff; border: 1px solid #cbd5e0; border-radius: 6px; padding: 2px; }
        .format-btn { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border: none; background: transparent; border-radius: 4px; font-size: 13px; font-weight: 600; color: #4a5568; cursor: pointer; }
        .format-btn.active { background: #e53935; color: #fff; }
        .tone-select, .duration-select {
          height: 32px;
          padding: 0 8px;
          border-radius: 6px;
          border: 1px solid #cbd5e0;
          font-size: 13px;
          background: #fff;
        }
        .tone-preview {
          margin-top: 8px;
          padding: 10px 12px;
          background: #f0f9ff;
          border-left: 3px solid #0ea5e9;
          border-radius: 6px;
          font-size: 12px;
          color: #0c4a6e;
          line-height: 1.5;
          display: none;
        }
        .tone-preview.show { display: block; }
        .keywords-row { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
        .keywords-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #cbd5e0;
          border-radius: 6px;
          font-size: 13px;
          font-family: inherit;
        }
        .keywords-hint { font-size: 11px; color: #718096; margin-top: -4px; }
        .keyword-validation { margin-top: 8px; padding: 8px 12px; border-radius: 6px; font-size: 12px; }
        .keyword-validation.warning { background: #fef3c7; border-left: 3px solid #f59e0b; color: #92400e; }
        .editor-wrapper { position: relative; }
        .editor-textarea {
          width: 100%;
          min-height: 260px;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #cbd5e0;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .btn-primary {
          margin-top: 12px;
          padding: 10px 16px;
          background: #e53935;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-next { margin-top: 16px; width: 100%; }
        .btn-regenerate {
          padding: 10px 20px;
          background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
          color: #000000;
          border: 2px solid #2196f3;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
          text-shadow: none;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          letter-spacing: 0.3px;
        }
        .btn-regenerate:hover:not(:disabled) {
          background: linear-gradient(135deg, #bbdefb 0%, #90caf9 100%);
          box-shadow: 0 6px 16px rgba(33, 150, 243, 0.4);
          transform: translateY(-2px);
          color: #000000;
        }
        .btn-regenerate:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(33, 150, 243, 0.3);
        }
        .btn-regenerate:disabled {
          background: #e3f2fd;
          border-color: #90caf9;
          cursor: not-allowed;
          opacity: 0.6;
          box-shadow: none;
          transform: none;
          color: #424242;
        }
        .btn-revert {
          padding: 10px 20px;
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
          color: #ffffff;
          border: 2px solid #ff5252;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
          text-shadow: none;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          letter-spacing: 0.3px;
        }
        .btn-revert:hover:not(:disabled) {
          background: linear-gradient(135deg, #ff5252 0%, #e53935 100%);
          box-shadow: 0 6px 16px rgba(255, 107, 107, 0.4);
          transform: translateY(-2px);
          color: #ffffff;
        }
        .btn-revert:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
        }
        .btn-revert:disabled {
          background: #e2e8f0;
          border-color: #e2e8f0;
          color: #4a5568;
          cursor: not-allowed;
          opacity: 0.8;
          box-shadow: none;
          transform: none;
          font-weight: 700;
        }
        .scene-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 8px; }
        .scene-card { background: #f7fafc; border-radius: 10px; border: 1px solid #e2e8f0; padding: 10px; }
        .scene-title { font-size: 13px; font-weight: 700; color: #2d3748; margin-bottom: 4px; }
        .scene-body { font-size: 12px; color: #4a5568; line-height: 1.5; }
        .duration-gauge {
          position: absolute;
          bottom: 8px;
          right: 12px;
          font-size: 11px;
          color: #718096;
          background: rgba(255, 255, 255, 0.9);
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid #e2e8f0;
        }
        .duration-gauge.success { color: #047857; background: #d1fae5; border-color: #10b981; }
        .duration-gauge.warning { color: #92400e; background: #fef3c7; border-color: #f59e0b; }
        .duration-gauge.error { color: #991b1b; background: #fee2e2; border-color: #ef4444; }
        .longform-dashboard {
          margin-top: 20px;
          background: #0f172a;
          color: #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          border: 1px solid #1e293b;
        }
        .longform-progress-bar {
          width: 100%;
          height: 12px;
          background: #1e293b;
          border-radius: 6px;
          overflow: hidden;
        }
        .longform-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #f97316 0%, #facc15 50%, #22c55e 100%);
          transition: width 0.3s ease;
        }
        .longform-status-row { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 12px; }
        .chapter-indicators { display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px; margin-top: 12px; }
        .chapter-indicator { height: 10px; border-radius: 6px; background: #334155; border: 1px solid #475569; }
        .chapter-indicator.active { background: #38bdf8; border-color: #38bdf8; }
        .chapter-indicator.done { background: #22c55e; border-color: #16a34a; }
        .dashboard-actions { margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end; }
        .btn-stop-save {
          padding: 6px 10px;
          background: #ef4444;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .status-window {
          position: fixed;
          right: 16px;
          bottom: 16px;
          width: 260px;
          max-height: 160px;
          overflow-y: auto;
          background: rgba(15, 23, 42, 0.95);
          color: #e2e8f0;
          border: 1px solid #334155;
          border-radius: 10px;
          padding: 10px;
          font-size: 12px;
          z-index: 9999;
        }
        .status-window-title { font-weight: 700; margin-bottom: 6px; }
        .status-window-line { margin-bottom: 4px; color: #cbd5f5; }
        .btn-secondary {
          padding: 8px 16px;
          background: #fff;
          border: 1px solid #cbd5e0;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #4a5568;
          cursor: pointer;
        }
        .btn-secondary:hover { background: #f7fafc; border-color: #a0aec0; }
        .btn-import-icon {
          width: 40px;
          height: 40px;
          min-width: 40px;
          min-height: 40px;
          border: none;
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          position: relative;
          color: #4a5568;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif;
          flex-shrink: 0;
          vertical-align: middle;
          visibility: visible !important;
          opacity: 1 !important;
        }
        .btn-import-icon:hover {
          background: #edf2f7;
          border-color: #cbd5e0;
          transform: scale(1.05);
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .source-modal {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .source-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e2e8f0;
        }
        .source-modal-title {
          font-size: 18px;
          font-weight: 700;
          color: #222;
          margin: 0;
        }
        .source-modal-close {
          width: 32px;
          height: 32px;
          border: none;
          background: #f0f0f0;
          border-radius: 6px;
          font-size: 18px;
          cursor: pointer;
          line-height: 1;
          color: #666;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .source-modal-close:hover { background: #e0e0e0; }
        .source-modal-body {
          padding: 24px;
        }
        .source-option {
          margin-bottom: 24px;
        }
        .source-option:last-child { margin-bottom: 0; }
        .source-label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #333;
          margin-bottom: 8px;
        }
        .source-url-input {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid #cbd5e0;
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
        }
        .source-url-input:focus { outline: none; border-color: #3182ce; }
        .workflow-item.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          pointer-events: none;
        }
        .workflow-item.disabled::after {
          content: ' (건너뜀)';
          font-size: 11px;
          color: #999;
        }
      `}</style>
    </>
  );
}
