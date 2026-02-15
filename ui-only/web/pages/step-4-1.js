import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { getApiBase } from '../utils/apiBase';

export default function Step41Page() {
  const router = useRouter();
  const [scriptText, setScriptText] = useState('');
  const [jsonData, setJsonData] = useState(null);
  const [step3Data, setStep3Data] = useState(null);
  const [showPromptReview, setShowPromptReview] = useState(false);
  const [promptScenes, setPromptScenes] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [thumbnailScenarios, setThumbnailScenarios] = useState([
    { id: 1, checked: true, title: '', subtitle: '', dialogue: '', imageScript: '', modification: '' },
    { id: 2, checked: true, title: '', subtitle: '', dialogue: '', imageScript: '', modification: '' },
    { id: 3, checked: true, title: '', subtitle: '', dialogue: '', imageScript: '', modification: '' },
    { id: 4, checked: true, title: '', subtitle: '', dialogue: '', imageScript: '', modification: '' },
    { id: 5, checked: true, title: '', subtitle: '', dialogue: '', imageScript: '', modification: '' }
  ]);
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  const [isExtractingJson, setIsExtractingJson] = useState(false);
  const [translatingSceneNum, setTranslatingSceneNum] = useState(null);
  const [characters, setCharacters] = useState([
    {
      id: 1,
      name: '내레이터',
      role: '',
      age: '',
      gender: '',
      description: '',
      checked: true,
      modification: ''
    },
    {
      id: 2,
      name: '주인공',
      role: '',
      age: '',
      gender: '',
      description: '',
      checked: true,
      modification: ''
    }
  ]);
  const [isAnalyzingCharacters, setIsAnalyzingCharacters] = useState(false);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // 저장된 캐릭터 정보 복원
      const savedCharacters = localStorage.getItem('step4Characters');
      if (savedCharacters) {
        try {
          const parsed = JSON.parse(savedCharacters);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCharacters(parsed);
          }
        } catch (e) {
          console.error('캐릭터 데이터 복원 실패:', e);
        }
      }

      // 저장된 썸네일 시나리오 복원 + 4-1 JSON 생성 결과(번역)가 있으면 썸네일/씬별 분할 미리보기에 반영해 새로고침 후에도 영문 유지
      const savedThumbnails = localStorage.getItem('step4ThumbnailScenarios');
      const savedJson42 = localStorage.getItem('step42JsonData');
      let thumbnailsToSet = null;
      if (savedThumbnails) {
        try {
          const parsed = JSON.parse(savedThumbnails);
          if (Array.isArray(parsed) && parsed.length > 0) thumbnailsToSet = [...parsed];
        } catch (e) {
          console.error('썸네일 시나리오 데이터 복원 실패:', e);
        }
      }
      if (savedJson42) {
        try {
          const data = JSON.parse(savedJson42);
          if (data.scenes && Array.isArray(data.scenes) && data.scenes.length > 0) {
            setJsonData(data);
            if (thumbnailsToSet) {
              data.scenes.forEach((scene) => {
                const idx = thumbnailsToSet.findIndex(s => s.id === scene.scene_num || String(s.id) === String(scene.scene_num));
                if (idx >= 0 && (scene.image_script_en || scene.image_prompt)) {
                  thumbnailsToSet[idx] = {
                    ...thumbnailsToSet[idx],
                    dialogue: scene.dialogue_ko ?? scene.script ?? thumbnailsToSet[idx].dialogue,
                    imageScript: scene.image_script_en ?? scene.image_prompt ?? thumbnailsToSet[idx].imageScript,
                    title: scene.scene_title || thumbnailsToSet[idx].title,
                  };
                }
              });
              try { localStorage.setItem('step4ThumbnailScenarios', JSON.stringify(thumbnailsToSet)); } catch (e) {}
            }
          }
        } catch (e) {}
      }
      if (thumbnailsToSet) setThumbnailScenarios(thumbnailsToSet);

      // final_script를 우선적으로 확인
      const finalScriptRaw = localStorage.getItem('final_script');
      if (finalScriptRaw) {
        const finalScript = finalScriptRaw.trim();
        setScriptText(finalScript);
        const payloadRaw = localStorage.getItem('step4JsonPayload');
        if (payloadRaw) {
          const data = JSON.parse(payloadRaw);
          data.script = finalScript;
          data.final_script = finalScript;
          setStep3Data(data);
          const parsedScenes = parseStorylineLines(data.blueprint, data.fromStep2);
          setScenes(parsedScenes);
        } else {
          setStep3Data({ script: finalScript, final_script: finalScript });
        }
        return;
      }
      
      // final_script가 없으면 기존 방식으로 로드
      const payloadRaw = localStorage.getItem('step4JsonPayload');
      if (payloadRaw) {
        const data = JSON.parse(payloadRaw);
        setStep3Data(data);
        const script = data.final_script || data.script || '';
        setScriptText(script);
        const parsedScenes = parseStorylineLines(data.blueprint, data.fromStep2);
        setScenes(parsedScenes);
      } else {
        setScriptText('3단계에서 전달된 데이터가 없습니다. 대본 생성 페이지에서 다시 시작해 주세요.');
      }
    } catch (e) {
      console.error('데이터 로드 실패:', e);
      setScriptText('데이터를 불러오는 중 오류가 발생했습니다.');
    }
  }, []);

  // 대본이 로드되면 자동으로 캐릭터 분석 및 썸네일 시나리오 생성 (이미 4-1 JSON 생성으로 번역 적용된 데이터가 있으면 썸네일 재생성 건너뛰어 한글로 덮어쓰지 않음)
  useEffect(() => {
    if (!scriptText || !scriptText.trim() || scriptText === '3단계에서 전달된 데이터가 없습니다. 대본 생성 페이지에서 다시 시작해 주세요.' || scriptText === '데이터를 불러오는 중 오류가 발생했습니다.') return;
    analyzeCharacters();
    try {
      const savedJson = localStorage.getItem('step42JsonData');
      if (savedJson) {
        const data = JSON.parse(savedJson);
        if (data.scenes && Array.isArray(data.scenes) && data.scenes.length > 0) {
          return;
        }
      }
    } catch (e) {}
    generateThumbnailScenarios();
  }, [scriptText]);

  /** 캐릭터 description 한글 → character_prompt_en(영문만), description_ko(원문) 분리. 번역 실패 시 원문을 en에 넣지 않음. */
  async function enrichCharactersWithEnPrompts(list) {
    const KOREAN_REGEX = /[가-힣]/;
    const result = [];
    for (const char of list) {
      const desc = (char.description || '').trim();
      let character_prompt_en = '';
      let description_ko = desc;
      if (desc) {
        if (KOREAN_REGEX.test(desc)) {
          try {
            const res = await fetch(getApiBase() + '/api/translate-test', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: desc }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.en) {
              character_prompt_en = data.en.trim();
              description_ko = desc;
            }
          } catch (e) {
            console.warn('캐릭터 설명 번역 실패 (character_prompt_en 비움):', char.name, e);
          }
        } else {
          character_prompt_en = desc;
          description_ko = '';
        }
      }
      result.push({
        ...char,
        character_prompt_en,
        description_ko,
      });
    }
    return result;
  }

  async function analyzeCharacters() {
    if (!scriptText || !scriptText.trim()) return;
    
    setIsAnalyzingCharacters(true);
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        // API 키가 없으면 기본 캐릭터 설정
        setDefaultCharacters();
        return;
      }

      const baseUrl = (process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const endpoint = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

      const prompt = `다음 대본을 분석하여 등장하는 모든 주요 캐릭터의 정보를 추출하세요. 내레이터(멘토)와 주인공(주요 인물)을 포함하여, 대본에 등장하는 모든 주요 인물을 추출하세요.

대본:
${scriptText.substring(0, 5000)}

다음 JSON 형식으로만 응답하세요:
{
  "characters": [
    {
      "type": "narrator 또는 protagonist 또는 other",
      "name": "캐릭터 이름 (예: 내레이터, 주인공, 직장인 A 등)",
      "role": "역할 (예: 커리어 코치, 마케터 등)",
      "age": "나이대 (예: 30대, 40대 등)",
      "gender": "성별 (여성 또는 남성)",
      "description": "영문과 한글을 병기한 상세한 외모 및 특징 설명 (이미지 생성용 프롬프트 형식). 먼저 한글로 설명하고, 그 다음 영문으로 설명하세요. 예: '30대 중반의 전문적인 아시아계 여성 커리어 코치로, 안경을 착용한 스마트 캐주얼 비즈니스 복장을 입고 있습니다. 자신감 있고 따뜻하며 지적인 표정을 가지고 있습니다. 창문에서 들어오는 부드러운 자연광이 있는 현대적이고 밝은 사무실 환경에 위치해 있습니다. 고품질 초상화, 사진처럼 사실적, 8k 해상도, 심도. / A professional Asian female career coach in her mid-30s, wearing smart casual business attire with glasses. She has a confident, warm, and intelligent expression. She is positioned in a modern, bright office environment with soft natural lighting coming from a window. High-quality portrait, photorealistic, 8k resolution, depth of field.'"
    }
  ]
}

최소 2개 이상의 캐릭터를 추출하세요. 내레이터와 주인공은 반드시 포함되어야 합니다. description 필드는 반드시 한글 설명과 영문 설명을 모두 포함해야 합니다.`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json'
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = parseJsonFromText(raw);
        
        if (parsed && parsed.characters && Array.isArray(parsed.characters) && parsed.characters.length >= 2) {
          const rawList = parsed.characters.map((char, idx) => ({
            id: idx + 1,
            name: char.name || (char.type === 'narrator' ? '내레이터' : char.type === 'protagonist' ? '주인공' : `캐릭터 ${idx + 1}`),
            role: char.role || '',
            age: char.age || '',
            gender: char.gender || '',
            description: char.description || '',
            checked: true,
            modification: ''
          }));
          const newCharacters = await enrichCharactersWithEnPrompts(rawList);
          setCharacters(newCharacters);
          if (typeof window !== 'undefined') {
            localStorage.setItem('step4Characters', JSON.stringify(newCharacters));
          }
        } else if (parsed && parsed.narrator && parsed.protagonist) {
          const narratorDesc = parsed.narrator.description || '';
          const protagonistDesc = parsed.protagonist.description || '';
          const rawList = [
            { id: 1, name: `내레이터 (${parsed.narrator.role})`, role: parsed.narrator.role, age: parsed.narrator.age, gender: parsed.narrator.gender, description: narratorDesc, checked: true, modification: '' },
            { id: 2, name: `주인공 (${parsed.protagonist.role})`, role: parsed.protagonist.role, age: parsed.protagonist.age, gender: parsed.protagonist.gender, description: protagonistDesc, checked: true, modification: '' },
          ];
          const newCharacters = await enrichCharactersWithEnPrompts(rawList);
          setCharacters(newCharacters);
          if (typeof window !== 'undefined') {
            localStorage.setItem('step4Characters', JSON.stringify(newCharacters));
          }
        } else {
          setDefaultCharacters();
        }
      } else {
        setDefaultCharacters();
      }
    } catch (e) {
      console.error('캐릭터 분석 실패:', e);
      setDefaultCharacters();
    } finally {
      setIsAnalyzingCharacters(false);
    }
  }

  function setDefaultCharacters() {
    const en1 = 'A professional Asian female career coach in her mid-30s, wearing smart casual business attire with glasses. She has a confident, warm, and intelligent expression. She is positioned in a modern, bright office environment with soft natural lighting coming from a window. High-quality portrait, photorealistic, 8k resolution, depth of field.';
    const en2 = 'A young Asian male office worker, late 20s, wearing a casual shirt. He looks thoughtful and slightly anxious about his career path. Sitting at a desk with a laptop, surrounded by office stationery. Soft, slightly cool-toned lighting to reflect his contemplation. Realistic style.';
    const defaultChars = [
      { id: 1, name: '내레이터 (멘토)', role: '커리어 코치', age: '30대', gender: '여성', description: en1, character_prompt_en: en1, description_ko: '', checked: true, modification: '' },
      { id: 2, name: '주인공 (고민하는 주니어)', role: '마케터', age: '20대', gender: '남성', description: en2, character_prompt_en: en2, description_ko: '', checked: true, modification: '' },
    ];
    setCharacters(defaultChars);
    if (typeof window !== 'undefined') {
      localStorage.setItem('step4Characters', JSON.stringify(defaultChars));
    }
  }

  function parseJsonFromText(raw) {
    const trimmed = raw.trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  function handleCharacterChange(index, field, value) {
    const newCharacters = [...characters];
    if (field === 'checked') {
      newCharacters[index].checked = value;
    } else {
      newCharacters[index][field] = value;
    }
    setCharacters(newCharacters);
    // localStorage에 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem('step4Characters', JSON.stringify(newCharacters));
    }
  }

  function copyCharacterDescription(index) {
    const char = characters[index];
    const fullDescription = char.modification 
      ? `${(char.character_prompt_en ?? char.description)}\n\nModifications: ${char.modification}`
      : (char.character_prompt_en ?? char.description);
    navigator.clipboard.writeText(fullDescription).then(() => {
      alert('복사되었습니다!');
    });
  }

  async function generateThumbnailScenarios() {
    setIsGeneratingThumbnails(true);
    try {
      // 대본이 없으면 빈 시나리오 5개 유지
      if (!scriptText || !scriptText.trim() || scriptText === '3단계에서 전달된 데이터가 없습니다. 대본 생성 페이지에서 다시 시작해 주세요.' || scriptText === '데이터를 불러오는 중 오류가 발생했습니다.') {
        setIsGeneratingThumbnails(false);
        return;
      }
      
      const sceneTitles = step3Data?.scenes || scenes || [];
      const blueprint = step3Data?.blueprint || {};
      const fromStep2 = step3Data?.fromStep2 || {};
      
      // 대본을 씬별로 분할
      let scriptScenes = splitScriptByScenes(scriptText, sceneTitles);
      
      // 씬이 없거나 1개만 있으면 문단별 또는 일정 길이로 분할
      if (!scriptScenes.length || scriptScenes.length === 1) {
        const paragraphs = scriptText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        
        if (paragraphs.length > 1) {
          // 문단이 여러 개면 문단별로 분할
          scriptScenes = paragraphs.map((para, idx) => ({
            scene_num: idx + 1,
            script: para.trim(),
            scene_title: sceneTitles[idx] || `씬 ${idx + 1}`
          }));
        } else if (scriptText.length > 500) {
          // 문단이 하나지만 길면 일정 길이로 분할 (최소 300자씩)
          const chunkSize = Math.max(300, Math.floor(scriptText.length / 5));
          scriptScenes = [];
          let currentChunk = '';
          let chunkNum = 1;
          
          const sentences = scriptText.split(/[.!?。！？]\s*/).filter(s => s.trim().length > 0);
          
          for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
              scriptScenes.push({
                scene_num: chunkNum,
                script: currentChunk.trim(),
                scene_title: sceneTitles[chunkNum - 1] || `씬 ${chunkNum}`
              });
              currentChunk = sentence;
              chunkNum++;
            } else {
              currentChunk += (currentChunk ? '. ' : '') + sentence;
            }
          }
          
          if (currentChunk.trim().length > 0) {
            scriptScenes.push({
              scene_num: chunkNum,
              script: currentChunk.trim(),
              scene_title: sceneTitles[chunkNum - 1] || `씬 ${chunkNum}`
            });
          }
          
          // 최소 3개는 보장
          if (scriptScenes.length < 3 && scriptText.length > 0) {
            const singleChunkSize = Math.floor(scriptText.length / 3);
            scriptScenes = [
              {
                scene_num: 1,
                script: scriptText.substring(0, singleChunkSize).trim(),
                scene_title: sceneTitles[0] || '씬 1'
              },
              {
                scene_num: 2,
                script: scriptText.substring(singleChunkSize, singleChunkSize * 2).trim(),
                scene_title: sceneTitles[1] || '씬 2'
              },
              {
                scene_num: 3,
                script: scriptText.substring(singleChunkSize * 2).trim(),
                scene_title: sceneTitles[2] || '씬 3'
              }
            ].filter(s => s.script.length > 0);
          }
        } else {
          // 짧은 대본은 그대로 사용하되 여러 씬으로 복제
          scriptScenes = [
            {
              scene_num: 1,
              script: scriptText.trim(),
              scene_title: sceneTitles[0] || '씬 1'
            }
          ];
        }
      }
      
      // 최대 5개까지만 생성
      const maxScenarios = Math.min(scriptScenes.length, 5);
      const scenariosToGenerate = scriptScenes.slice(0, maxScenarios);
      
      // 5개 미만이면 빈 시나리오로 채우기
      while (scenariosToGenerate.length < 5) {
        scenariosToGenerate.push({
          scene_num: scenariosToGenerate.length + 1,
          script: '',
          scene_title: `씬 ${scenariosToGenerate.length + 1}`
        });
      }
      
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      
      if (apiKey) {
        // AI로 각 시나리오 생성
        const baseUrl = (process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
        const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const endpoint = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
        
        // 캐릭터 정보를 문자열로 변환
        const characterInfo = characters
          .filter(char => char.name && (char.role || char.age || char.gender || char.description))
          .map(char => {
            let info = char.name;
            if (char.role) info += ` (${char.role})`;
            if (char.age || char.gender) {
              info += ` - ${char.age || ''} ${char.gender || ''}`.trim();
            }
            if (char.description) {
              const desc = char.description.split('/')[0].trim(); // 한글 설명만 추출
              if (desc) info += `: ${desc.substring(0, 100)}`;
            }
            return info;
          })
          .join(', ');

        const generatedScenarios = await Promise.all(
          scenariosToGenerate.map(async (scene, idx) => {
            // 빈 스크립트가 있으면 기본값만 반환
            if (!scene.script || !scene.script.trim()) {
              return {
                id: idx + 1,
                checked: true,
                title: scene.scene_title || `씬 ${idx + 1}`,
                subtitle: '',
                dialogue: '',
                imageScript: '',
                modification: ''
              };
            }

            try {
              // 롱폼 대본의 경우 전체 씬 스크립트 전달 (최대 3000자로 증가하여 더 많은 컨텍스트 제공)
              // 씬이 길어도 핵심 내용을 놓치지 않도록 충분한 길이 확보
              const sceneScriptForPrompt = scene.script.length > 3000 
                ? scene.script.substring(0, 3000) + '\n\n[... 이어지는 내용이 있습니다 ...]' 
                : scene.script;
              
              const prompt = `다음 대본 씬을 분석하여 썸네일 이미지 시나리오를 생성하세요. 캐릭터의 성격과 상황을 주제에 담아내야 합니다.

${characterInfo ? `캐릭터 정보:\n${characterInfo}\n\n` : ''}씬 번호: ${scene.scene_num}
씬 제목: ${scene.scene_title}
대본 내용:
${sceneScriptForPrompt}

위 대본 내용을 바탕으로 다음 JSON 형식으로만 응답하세요. 반드시 모든 필드를 채워야 하며, 절대 빈 값("")으로 내보내지 마세요:

{
  "title": "씬의 핵심 메시지를 담은 짧은 제목 (10자 이내). 대본 내용을 요약한 제목",
  "subtitle": "제목을 보완하는 서브타이틀 (20자 이내). 씬의 주요 내용을 한 문장으로",
  "dialogue": "대본에서 가장 중요한 대사나 핵심 문장을 발췌 (3-5줄). 대본의 핵심 내용을 반영",
  "dialogueEnglish": "위 dialogue 필드의 내용을 반드시 영어로 번역한 결과. 한국어가 포함되어 있으면 안 됩니다. 번역된 영어 텍스트만 반환하세요. 예시: dialogue가 '어르신들, 혹시 아침에 신문 읽고 TV 뉴스 보다가 저녁엔 유튜브까지, 하루 종일 정보의 홍수 속에서 피곤하다고 느끼신 적은 없으신가요?'이면 dialogueEnglish는 'Elders, have you ever felt tired from a flood of information all day, reading newspapers in the morning, watching TV news, and even YouTube in the evening?'와 같이 정확히 번역해야 합니다."
}`;

              const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ role: 'user', parts: [{ text: prompt }] }],
                  generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 4096, // 더 상세한 이미지 프롬프트 생성을 위해 토큰 수 증가
                    responseMimeType: 'application/json'
                  }
                })
              });

              if (response.ok) {
                const data = await response.json();
                const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const parsed = parseJsonFromText(raw);
                
                if (parsed && parsed.title && parsed.dialogue) {
                  // 대사 발췌
                  const dialogueText = parsed.dialogue || '';
                  
                  // 단순하게: 대사를 영어로 번역
                  let finalDialogueEnglish = '';
                  if (dialogueText && dialogueText.trim()) {
                    // 한글이 포함되어 있으면 번역
                    if (/[가-힣]/.test(dialogueText)) {
                      finalDialogueEnglish = await translateDialogue(dialogueText);
                      // 번역 실패 시 재시도
                      if (!finalDialogueEnglish || finalDialogueEnglish.trim() === '' || /[가-힣]/.test(finalDialogueEnglish)) {
                        // 짧게 잘라서 다시 번역 시도
                        const shortText = dialogueText.substring(0, 200).trim();
                        if (shortText) {
                          finalDialogueEnglish = await translateDialogue(shortText);
                        }
                      }
                    } else {
                      // 이미 영어면 그대로 사용
                      finalDialogueEnglish = dialogueText.trim();
                    }
                  }
                  
                  // 한글 완전 제거 (여러 번 반복하여 확실히 제거)
                  if (finalDialogueEnglish) {
                    finalDialogueEnglish = finalDialogueEnglish.replace(/[가-힣]/g, '').trim();
                    let prev = '';
                    while (prev !== finalDialogueEnglish) {
                      prev = finalDialogueEnglish;
                      finalDialogueEnglish = finalDialogueEnglish.replace(/[가-힣]/g, '').trim();
                    }
                  }
                  
                  // 번역이 실패했거나 빈 값이면 기본값
                  if (!finalDialogueEnglish || finalDialogueEnglish.trim() === '' || /[가-힣]/.test(finalDialogueEnglish)) {
                    const sceneTitle = parsed.title || scene.scene_title || `Scene ${idx + 1}`;
                    finalDialogueEnglish = `Scene ${idx + 1} dialogue`;
                  }
                  
            // 이미지 스크립트 생성: 단순하게 번역된 대사를 그대로 사용
            const koreanDesc = `${dialogueText}에 대한 비주얼 장면, 평온하고 따뜻한 분위기`;
            const englishDesc = `Visual scene based on: "${finalDialogueEnglish}", peaceful and warm atmosphere, professional video production quality`;
            
            const imageScript = `${koreanDesc} / ${englishDesc}`;
                  
                  return {
                    id: idx + 1,
                    checked: true,
                    title: parsed.title,
                    subtitle: parsed.subtitle || '',
                    dialogue: parsed.dialogue,
                    imageScript: imageScript,
                    modification: ''
                  };
                }
              }
            } catch (e) {
              console.error(`시나리오 ${idx + 1} 생성 실패:`, e);
            }
            
            // AI 생성 실패 시 기본값: 대사를 단순하게 번역
            const dialogueText = scene.script.substring(0, 300).replace(/\n/g, ' ').trim();
            
            // 대사를 영어로 번역
            let dialogueEnglish = '';
            if (dialogueText && dialogueText.trim()) {
              if (/[가-힣]/.test(dialogueText)) {
                dialogueEnglish = await translateDialogue(dialogueText);
                // 번역 실패 시 짧게 잘라서 재시도
                if (!dialogueEnglish || dialogueEnglish.trim() === '' || /[가-힣]/.test(dialogueEnglish)) {
                  const shortText = dialogueText.substring(0, 150).trim();
                  if (shortText) {
                    dialogueEnglish = await translateDialogue(shortText);
                  }
                }
              } else {
                dialogueEnglish = dialogueText.trim();
              }
            }
            
            // 한글 완전 제거
            if (dialogueEnglish) {
              dialogueEnglish = dialogueEnglish.replace(/[가-힣]/g, '').trim();
              let prev = '';
              while (prev !== dialogueEnglish) {
                prev = dialogueEnglish;
                dialogueEnglish = dialogueEnglish.replace(/[가-힣]/g, '').trim();
              }
            }
            
            // 번역 실패 시 기본값
            if (!dialogueEnglish || dialogueEnglish.trim() === '' || /[가-힣]/.test(dialogueEnglish)) {
              dialogueEnglish = `Scene ${idx + 1} dialogue`;
            }
            
            // 이미지 스크립트 생성: 단순하게 번역된 대사를 그대로 사용
            const koreanDesc = dialogueText ? `${dialogueText}에 대한 비주얼 장면, 평온하고 따뜻한 분위기` : '씬 내용에 대한 비주얼 장면';
            let englishDesc = `Visual scene based on: "${dialogueEnglish}", peaceful and warm atmosphere, professional video production quality`;
            
            // 영문 부분에서 한글 완전 제거 (여러 번 반복)
            englishDesc = englishDesc.replace(/[가-힣]/g, '').trim();
            let prev = '';
            while (prev !== englishDesc) {
              prev = englishDesc;
              englishDesc = englishDesc.replace(/[가-힣]/g, '').trim();
            }
            
            const imageScript = `${koreanDesc} / ${englishDesc}`;
            
            return {
              id: idx + 1,
              checked: true,
              title: scene.scene_title || `씬 ${idx + 1}`,
              subtitle: '',
              dialogue: dialogueText,
              imageScript: `${koreanDesc} / ${englishDesc}`,
              modification: ''
            };
          })
        );
        
        // 생성된 시나리오가 5개 미만이면 빈 시나리오로 채우기
        while (generatedScenarios.length < 5) {
          generatedScenarios.push({
            id: generatedScenarios.length + 1,
            checked: true,
            title: '',
            subtitle: '',
            dialogue: '',
            imageScript: '',
            modification: ''
          });
        }
        
        setThumbnailScenarios(generatedScenarios);
        // localStorage에 저장
        if (typeof window !== 'undefined') {
          localStorage.setItem('step4ThumbnailScenarios', JSON.stringify(generatedScenarios));
        }
        
        // 썸네일 시나리오의 정보를 씬별 분할 미리보기에도 반영
        const sceneList = generatedScenarios.map((scenario, idx) => {
          if (scenario.dialogue) {
            return scenario.dialogue;
          }
          return scenario.title || `씬 ${idx + 1}`;
        });
        setScenes(sceneList);
      } else {
        // API 키가 없으면 기본 시나리오 생성 (대사 발췌 기반 한글/영문 이미지 스크립트 자동 생성)
        // API 키가 없어도 번역은 시도 (endpoint가 정의되어 있으면)
        const defaultScenarios = await Promise.all(scenariosToGenerate.map(async (scene, idx) => {
          const hasScript = !!(scene.script && scene.script.trim());
          const scriptPreview = hasScript
            ? scene.script.substring(0, 200).replace(/\n/g, ' ').trim()
            : '';
          const dialogueText = hasScript
            ? scriptPreview + (scene.script.length > 200 ? '...' : '')
            : '';
          
          // 번역 시도
          let dialogueEnglish = '';
          if (dialogueText && apiKey) {
            try {
              const translatePrompt = `Translate the following Korean text to English. Return ONLY the English translation, no explanations, no Korean characters:\n\n${dialogueText.substring(0, 300)}`;
              const translateResponse = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ role: 'user', parts: [{ text: translatePrompt }] }],
                  generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
                })
              });
              if (translateResponse.ok) {
                const translateData = await translateResponse.json();
                let translated = translateData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
                // 한글 제거
                translated = translated.replace(/[가-힣]/g, '').trim();
                if (translated && translated.length > 10 && /[a-zA-Z]/.test(translated)) {
                  dialogueEnglish = translated;
                }
              }
            } catch (e) {
              console.error('번역 실패:', e);
            }
          }
          
          // 번역 실패 시 기본값
          if (!dialogueEnglish || dialogueEnglish.trim() === '' || /[가-힣]/.test(dialogueEnglish)) {
            dialogueEnglish = `Scene ${idx + 1} dialogue`;
          }
          
          // 이미지 스크립트 생성: 단순하게 번역된 대사를 그대로 사용
          const koreanDesc = dialogueText
            ? `${dialogueText}에 대한 비주얼 장면, 평온하고 따뜻한 분위기`
            : '';
          const englishDesc = `Visual scene based on: "${dialogueEnglish}", peaceful and warm atmosphere, professional video production quality`;

          return {
            id: idx + 1,
            checked: true,
            title: scene.scene_title || `시나리오 ${idx + 1}`,
            subtitle: '',
            dialogue: dialogueText,
            imageScript: dialogueText ? `${koreanDesc} / ${englishDesc}` : '',
            modification: ''
          };
        }));
        
        // 5개 미만이면 빈 시나리오로 채우기
        while (defaultScenarios.length < 5) {
          defaultScenarios.push({
            id: defaultScenarios.length + 1,
            checked: true,
            title: '',
            subtitle: '',
            dialogue: '',
            imageScript: '',
            modification: ''
          });
        }
        
        setThumbnailScenarios(defaultScenarios);
        // localStorage에 저장
        if (typeof window !== 'undefined') {
          localStorage.setItem('step4ThumbnailScenarios', JSON.stringify(defaultScenarios));
        }
        
        // 썸네일 시나리오의 정보를 씬별 분할 미리보기에도 반영
        const sceneList = defaultScenarios.map((scenario, idx) => {
          if (scenario.dialogue) {
            return scenario.dialogue;
          }
          return scenario.title || `씬 ${idx + 1}`;
        });
        setScenes(sceneList);
      }
    } catch (e) {
      console.error('썸네일 시나리오 생성 실패:', e);
    } finally {
      setIsGeneratingThumbnails(false);
    }
  }

  function handleThumbnailChange(index, field, value) {
    const newScenarios = [...thumbnailScenarios];
    if (field === 'checked') {
      newScenarios[index].checked = value;
    } else {
      newScenarios[index][field] = value;
    }
    setThumbnailScenarios(newScenarios);
    // localStorage에 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem('step4ThumbnailScenarios', JSON.stringify(newScenarios));
    }
  }

  function handleReset() {
    if (confirm('모든 데이터를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      // 상태 초기화
      setScriptText('');
      setJsonData(null);
      setStep3Data(null);
      setScenes([]);
      setThumbnailScenarios([
        { id: 1, checked: true, title: '', subtitle: '', dialogue: '', imageScript: '', modification: '' },
        { id: 2, checked: true, title: '', subtitle: '', dialogue: '', imageScript: '', modification: '' },
        { id: 3, checked: true, title: '', subtitle: '', dialogue: '', imageScript: '', modification: '' },
        { id: 4, checked: true, title: '', subtitle: '', dialogue: '', imageScript: '', modification: '' },
        { id: 5, checked: true, title: '', subtitle: '', dialogue: '', imageScript: '', modification: '' }
      ]);
      setCharacters([
        {
          id: 1,
          name: '내레이터',
          role: '',
          age: '',
          gender: '',
          description: '',
          checked: true,
          modification: ''
        },
        {
          id: 2,
          name: '주인공',
          role: '',
          age: '',
          gender: '',
          description: '',
          checked: true,
          modification: ''
        }
      ]);
      
      // localStorage 초기화
      if (typeof window !== 'undefined') {
        localStorage.removeItem('step3Blueprint');
        localStorage.removeItem('final_script');
        localStorage.removeItem('currentFormat');
        localStorage.removeItem('currentDuration');
        localStorage.removeItem('step3OriginalScript');
        localStorage.removeItem('step4JsonPayload');
        localStorage.removeItem('step4Characters');
        localStorage.removeItem('step4ThumbnailScenarios');
      }
      
      alert('모든 데이터가 초기화되었습니다.');
    }
  }

  function handleDownloadAll() {
    try {
      const data = {
        thumbnailScenarios: thumbnailScenarios.map((scenario, idx) => ({
          id: scenario.id,
          title: scenario.title,
          subtitle: scenario.subtitle,
          dialogue: scenario.dialogue,
          imageScript: scenario.imageScript,
          modification: scenario.modification
        })),
        characters: characters.map((char) => ({
          name: char.name,
          role: char.role,
          age: char.age,
          gender: char.gender,
          description: char.description,
          modification: char.modification
        })),
        scenes: scenes.map((scene, idx) => ({
          sceneNumber: idx + 1,
          content: scene
        }))
      };

      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `전체_이미지_스크립트_대사_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('다운로드 실패:', e);
      alert('다운로드 중 오류가 발생했습니다.');
    }
  }

  function splitScriptByScenes(scriptText, sceneTitles) {
    if (!scriptText || !scriptText.trim()) return [];
    
    // [씬 1], [씬 2] 형식으로 분할
    const scenePattern = /\[씬\s*(\d+)\]/g;
    const scenes = [];
    let lastIndex = 0;
    let match;
    let currentSceneNum = null;
    let currentScript = '';

    // 모든 씬 마커 찾기
    const sceneMarkers = [];
    while ((match = scenePattern.exec(scriptText)) !== null) {
      sceneMarkers.push({
        num: parseInt(match[1], 10),
        index: match.index
      });
    }

    if (sceneMarkers.length === 0) {
      // 씬 마커가 없으면 전체를 하나의 씬으로
      return [{
        scene_num: 1,
        script: scriptText.trim(),
        scene_title: sceneTitles && sceneTitles[0] ? sceneTitles[0] : '씬 1'
      }];
    }

    // 각 씬별로 스크립트 추출
    for (let i = 0; i < sceneMarkers.length; i++) {
      const marker = sceneMarkers[i];
      const nextMarker = sceneMarkers[i + 1];
      
      const startIndex = marker.index;
      const endIndex = nextMarker ? nextMarker.index : scriptText.length;
      
      // 씬 마커 텍스트 제거하고 스크립트만 추출
      let sceneScript = scriptText.substring(startIndex, endIndex);
      sceneScript = sceneScript.replace(/\[씬\s*\d+\]\s*/, '').trim();
      
      if (sceneScript.length > 0) {
        scenes.push({
          scene_num: marker.num,
          script: sceneScript,
          scene_title: (sceneTitles && sceneTitles[marker.num - 1]) ? sceneTitles[marker.num - 1] : `씬 ${marker.num}`
        });
      }
    }

    // 씬 마커가 있지만 첫 번째 씬 이전에 내용이 있는 경우
    if (sceneMarkers.length > 0 && sceneMarkers[0].index > 0) {
      const firstPart = scriptText.substring(0, sceneMarkers[0].index).trim();
      if (firstPart.length > 0) {
        scenes.unshift({
          scene_num: 1,
          script: firstPart,
          scene_title: (sceneTitles && sceneTitles[0]) ? sceneTitles[0] : '씬 1'
        });
      }
    }

    return scenes.sort((a, b) => a.scene_num - b.scene_num);
  }

  function generateImagePrompt(scene, blueprint, fromStep2) {
    const tone = 'professional';
    let expertContext = '';
    if (fromStep2 && fromStep2.expertSummary) {
      expertContext = ' Based on expert analysis: ' + fromStep2.expertSummary.substring(0, 100);
    }
    const target = blueprint && blueprint.target ? blueprint.target : 'general audience';
    const basePrompt = 'A professional video scene for ' + target + '. ' + expertContext;
    const sceneDesc = scene.scene_title || 'Scene ' + scene.scene_num;
    const visualStyle = 'Cinematic composition, natural lighting, warm color palette, professional video production quality, clear focus on the main subject, balanced framing.';
    return basePrompt + ' Scene: ' + sceneDesc + '. ' + visualStyle;
  }

  function generateVisualDescription(scene, blueprint) {
    const sceneScript = scene.script || '';
    const optimizedDescription = sceneScript.substring(0, 200).replace(/\[씬\s*\d+\]/g, '').trim();
    const seniorOptimizationKeywords = 'warm and bright lighting, high contrast for better visibility, clear and friendly facial expressions, 8k resolution, cinematic quality, senior-friendly composition';
    
    let finalDescription = optimizedDescription;
    if (finalDescription) {
      finalDescription += '. ' + seniorOptimizationKeywords;
    } else {
      const title = blueprint && blueprint.title ? blueprint.title : 'Content';
      const hook = blueprint && blueprint.hook ? blueprint.hook.substring(0, 80) : '';
      finalDescription = 'Scene composition focusing on ' + (scene.scene_title || 'main content') + '. Visual elements should reflect the theme: ' + title + '. ' + (hook ? 'Atmosphere: ' + hook.substring(0, 60) : '');
      finalDescription += '. ' + seniorOptimizationKeywords;
    }
    
    return finalDescription;
  }

  async function extractJson() {
    if (!step3Data) {
      alert('3단계 데이터가 없습니다. 대본 생성 페이지에서 다시 시작해 주세요.');
      return;
    }
    const script = step3Data.final_script || step3Data.script || '';
    const sceneTitles = step3Data.scenes || [];
    if (!script.trim()) {
      alert('대본 내용이 비어 있습니다. 3단계에서 대본을 생성한 후 다시 시도해 주세요.');
      return;
    }

    let builtScenes = [];

    // 1) 썸네일이 4개 이상이면 썸네일 기준으로 전송해 씬4까지 모두 번역 (씬4 영문 적용 보장)
    const thumbList = (thumbnailScenarios || []).filter(s => s.id != null).slice(0, 10);
    if (thumbList.length >= 4) {
      builtScenes = thumbList.map(s => {
        const dialogue = (s.dialogue || '').trim();
        return {
          scene_num: s.id,
          script: dialogue.length > 0 ? dialogue : `Scene ${s.id} (no dialogue)`,
          scene_title: s.title || sceneTitles[(s.id || 0) - 1] || `씬 ${s.id}`,
        };
      });
      console.log('[4-1 JSON 생성] 썸네일 시나리오 기준 전송 (씬4 포함):', builtScenes.length, '개 씬');
    }

    // 2) 그렇지 않으면 promptScenes 또는 스크립트 분할 결과 사용
    if (!builtScenes.length && promptScenes && promptScenes.length >= 2) {
      const fromPromptScenes = promptScenes
        .map((s) => ({
          scene_num: s.scene_num,
          script: (s.script != null ? String(s.script) : s.dialogue_ko != null ? String(s.dialogue_ko) : '').trim(),
          scene_title: s.scene_title || sceneTitles[s.scene_num - 1] || `씬 ${s.scene_num}`,
        }))
        .filter((s) => s.script.length > 0);
      if (fromPromptScenes.length >= 2) {
        builtScenes = fromPromptScenes;
        console.log('[4-1 JSON 생성] 기존 씬 목록 사용 (전체 번역):', builtScenes.length, '개 씬');
      }
    }

    if (!builtScenes.length) {
      builtScenes = splitScriptByScenes(script, sceneTitles);
    }
    // [씬 N] 없이 1개만 나왔는데 씬 제목이 2개 이상이면 대본을 씬 수만큼 분할해 전송 (전체 번역되도록)
    if (builtScenes.length === 1 && sceneTitles.length >= 2) {
      const paragraphs = script.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      if (paragraphs.length >= 2) {
        const useParagraphs = paragraphs.slice(0, Math.max(paragraphs.length, sceneTitles.length));
        builtScenes = useParagraphs.map((para, idx) => ({
          scene_num: idx + 1,
          script: para.trim(),
          scene_title: sceneTitles[idx] || '씬 ' + (idx + 1)
        }));
      } else if (script.trim().length > 100) {
        const n = Math.min(sceneTitles.length, 10);
        const chunkSize = Math.max(50, Math.floor(script.trim().length / n));
        const parts = [];
        let rest = script.trim();
        for (let i = 0; i < n && rest.length > 0; i++) {
          if (i === n - 1) {
            parts.push(rest);
            break;
          }
          const cut = rest.slice(0, chunkSize);
          const lastNewline = cut.lastIndexOf('\n');
          const splitAt = lastNewline > chunkSize / 2 ? lastNewline + 1 : chunkSize;
          parts.push(rest.slice(0, splitAt).trim());
          rest = rest.slice(splitAt).trim();
        }
        const chunked = parts.map((p, idx) => ({
          scene_num: idx + 1,
          script: p,
          scene_title: sceneTitles[idx] || `씬 ${idx + 1}`
        })).filter(s => s.script.length > 0);
        if (chunked.length >= 2) builtScenes = chunked;
      }
    }
    if (!builtScenes.length) {
      const paragraphs = script.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      if (paragraphs.length > 0) {
        builtScenes = paragraphs.map((para, idx) => ({
          scene_num: idx + 1,
          script: para.trim(),
          scene_title: sceneTitles[idx] || '씬 ' + (idx + 1)
        }));
      } else {
        builtScenes = [{ scene_num: 1, script: script.trim(), scene_title: sceneTitles[0] || '씬 1' }];
      }
    }
    if (!builtScenes.length) {
      alert('씬 데이터를 찾을 수 없습니다. 대본 형식을 확인해 주세요.');
      return;
    }

    console.log('[4-1 JSON 생성] 전송 씬 수:', builtScenes.length, builtScenes.map(s => ({ scene_num: s.scene_num, scriptLen: s.script.length })));

    setIsExtractingJson(true);
    // 강제로 현재 호스트 기반으로 API Base 생성 (캐시 문제 방지)
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
    const apiBase = (hostname === 'localhost' || hostname === '127.0.0.1') 
      ? 'http://localhost:4000'
      : `${protocol}//${hostname}:4000`;
    console.log('[4-1 JSON 생성] 현재 위치:', typeof window !== 'undefined' ? window.location.href : 'SSR');
    console.log('[4-1 JSON 생성] API Base (강제 감지):', apiBase);
    console.log('[4-1 JSON 생성] 호출 엔드포인트:', `${apiBase}/api/extract-json`);
    
    try {
      // 1. 연결 테스트: /api/ping 먼저 호출
      try {
        const pingRes = await fetch(`${apiBase}/api/ping`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!pingRes.ok) {
          throw new Error(`서버 연결 실패 (ping: ${pingRes.status})`);
        }
        const pingData = await pingRes.json().catch(() => ({}));
        console.log('[4-1 JSON 생성] 서버 연결 확인:', pingData);
      } catch (pingErr) {
        console.error('[4-1 JSON 생성] ping 실패:', pingErr);
        throw new Error(`서버 연결 실패: ${pingErr.message || '네트워크 오류'}. API Base: ${apiBase}`);
      }

      // 2. 번역 서비스 상태 확인 (선택사항, 실패해도 계속 진행)
      try {
        const translateStatusRes = await fetch(`${apiBase}/api/translate-status`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const translateStatus = await translateStatusRes.json().catch(() => ({}));
        if (translateStatus.status === 'error') {
          console.warn('[4-1 JSON 생성] 번역 서비스 경고:', translateStatus.message);
          // 번역 서비스가 없어도 경고만 표시하고 계속 진행 (서버에서 에러 처리)
        } else {
          console.log('[4-1 JSON 생성] 번역 서비스 확인:', translateStatus);
        }
      } catch (translateStatusErr) {
        console.warn('[4-1 JSON 생성] 번역 서비스 상태 확인 실패 (계속 진행):', translateStatusErr);
      }

      // 2. JSON 추출 요청
      const res = await fetch(`${apiBase}/api/extract-json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, scenes: builtScenes }),
        signal: AbortSignal.timeout(120000), // 120초 타임아웃
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || res.statusText || `JSON 추출 요청 실패 (${res.status})`);
      }
      const jsonScenes = data.scenes || [];
      if (!jsonScenes.length) {
        throw new Error('서버에서 씬 데이터를 반환하지 않았습니다.');
      }
      
      // 서버 응답 데이터 검증 및 로깅
      console.log('[4-1 JSON 생성] 서버 응답 데이터:', {
        sceneCount: jsonScenes.length,
        translationUsed: data.translationServiceUsed,
        warning: data.warning,
        firstScene: jsonScenes[0] ? {
          scene_num: jsonScenes[0].scene_num,
          dialogue_ko_preview: jsonScenes[0].dialogue_ko?.slice(0, 50),
          image_script_en_preview: jsonScenes[0].image_script_en?.slice(0, 100),
          image_script_en_full: jsonScenes[0].image_script_en, // 전체 텍스트 확인용
          hasKorean: /[가-힣]/.test(jsonScenes[0].image_script_en || ''),
        } : null,
      });
      
      // 번역 사용 여부 확인 및 로깅
      if (data.translationServiceUsed) {
        console.log('[4-1 JSON 생성] ✅ 번역 서비스가 사용되었습니다.');
      } else {
        console.warn('[4-1 JSON 생성] ⚠️ 번역 서비스가 사용되지 않았습니다. 기본 영문 텍스트가 사용되었습니다.');
      }
      
      // 번역 서비스 미사용 경고 표시
      if (data.warning) {
        console.warn('[4-1 JSON 생성] 번역 서비스 경고:', data.warning);
        alert(`⚠️ 경고: ${data.warning}\n\n기본 영문 텍스트로 JSON이 생성되었습니다. 번역 서비스가 준비되면 "재생성" 버튼을 클릭하세요.`);
      }
      
      // image_script_en에 한글이 포함된 경우 강제로 기본 영문 텍스트로 대체
      const cleanedScenes = jsonScenes.map(scene => {
        const hasKoreanInImageScript = /[가-힣]/.test(scene.image_script_en || '');
        if (hasKoreanInImageScript) {
          console.warn(`[4-1 JSON 생성] 씬 ${scene.scene_num}의 image_script_en에 한글 포함, 기본 영문 텍스트로 대체`);
          // 기본 영문 텍스트 생성 (한글 대사 기반)
          const defaultEn = `A healthy senior person ${scene.dialogue_ko ? 'speaking' : ''} in a bright and comfortable environment. No text, no captions, no typography, no watermark.`;
          return {
            ...scene,
            image_script_en: defaultEn,
            image_prompt: defaultEn,
            visual_description: defaultEn,
          };
        }
        return scene;
      });
      
      const newJsonData = { scenes: cleanedScenes };
      setJsonData(newJsonData);
      setPromptScenes(cleanedScenes);
      setShowPromptReview(true);
      localStorage.setItem('step42JsonData', JSON.stringify(newJsonData));

      // 썸네일 이미지 시나리오(thumbnailScenarios) + 씬별 분할 미리보기에 번역된 이미지 스크립트 반영 (scene_num으로 매칭해 씬4 등 모두 적용)
      setThumbnailScenarios(prev => {
        const next = [...prev];
        cleanedScenes.forEach((scene) => {
          const idx = next.findIndex(s => s.id === scene.scene_num || String(s.id) === String(scene.scene_num));
          if (idx >= 0 && (scene.image_script_en || scene.image_prompt)) {
            next[idx] = {
              ...next[idx],
              dialogue: scene.dialogue_ko ?? scene.script ?? next[idx].dialogue,
              imageScript: scene.image_script_en ?? scene.image_prompt ?? next[idx].imageScript,
              title: scene.scene_title || next[idx].title,
            };
          }
        });
        try { localStorage.setItem('step4ThumbnailScenarios', JSON.stringify(next)); } catch (e) {}
        return next;
      });
    } catch (e) {
      console.error('[4-1 JSON 생성] 오류:', e);
      let errorMsg = e.name === 'TimeoutError' 
        ? '요청 시간 초과 (120초). 번역 서비스가 느릴 수 있습니다.'
        : e.message || '알 수 없는 오류';
      
      // 번역 서비스 관련 에러인 경우 추가 안내
      if (errorMsg.includes('번역') || errorMsg.includes('LibreTranslate') || errorMsg.includes('연결')) {
        errorMsg += '\n\n번역 서비스 연결 문제일 수 있습니다.';
        errorMsg += '\n서버 로그를 확인하거나 번역 서비스 상태를 확인하세요.';
      }
      
      alert(`JSON 추출 중 오류가 발생했습니다:\n\n${errorMsg}\n\nAPI Base: ${apiBase}`);
    } finally {
      setIsExtractingJson(false);
    }
  }

  function copyJson() {
    if (!jsonData) {
      alert('복사할 JSON 데이터가 없습니다.');
      return;
    }
    const jsonStr = JSON.stringify(jsonData, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      alert('복사 완료!');
    }).catch(() => {
      alert('복사에 실패했습니다. 수동으로 선택하여 복사해 주세요.');
    });
  }

  const NO_TEXT_PHRASE = 'No text, no captions, no typography, no watermark.';
  function hasKorean(str) {
    return typeof str === 'string' && /[가-힣]/.test(str);
  }

  function handlePromptChange(sceneNum, field, value) {
    const newScenes = promptScenes.map(scene => {
      if (scene.scene_num !== sceneNum) return scene;
      const updated = { ...scene, [field]: value };
      if (field === 'image_script_en') {
        updated.image_prompt = value;
        updated.visual_description = value;
      }
      if (field === 'dialogue_ko') updated.script = value;
      return updated;
    });
    setPromptScenes(newScenes);
    const newJsonData = { scenes: newScenes };
    setJsonData(newJsonData);
    localStorage.setItem('step42JsonData', JSON.stringify(newJsonData));
  }

  async function handleTranslateSceneToEn(sceneNum) {
    const scene = promptScenes.find(s => s.scene_num === sceneNum);
    if (!scene) return;
    const sourceText = (scene.dialogue_ko ?? scene.script ?? '').trim();
    if (!sourceText) {
      alert('해당 씬의 대사(한글)가 없습니다.');
      return;
    }
    setTranslatingSceneNum(sceneNum);
    const apiBase = getApiBase();
    try {
      const res = await fetch(`${apiBase}/api/translate-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sourceText }),
        signal: AbortSignal.timeout(30000), // 30초 타임아웃
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || res.statusText || `번역 실패 (${res.status})`);
      }
      let en = (data.en || '').trim();
      if (en && !en.endsWith(NO_TEXT_PHRASE)) en += '. ' + NO_TEXT_PHRASE;
      handlePromptChange(sceneNum, 'image_script_en', en);
    } catch (e) {
      console.error('[영문 변환] 실패:', e);
      const errorMsg = e.name === 'TimeoutError'
        ? '번역 요청 시간 초과 (30초)'
        : e.message || '알 수 없는 오류';
      alert(`영문 변환 실패:\n\n${errorMsg}\n\nAPI Base: ${apiBase}`);
    } finally {
      setTranslatingSceneNum(null);
    }
  }

  function handleGoToStep42() {
    if (!jsonData) {
      if (!confirm('JSON 데이터가 추출되지 않았습니다. 그래도 다음 단계로 이동하시겠습니까?')) {
        return;
      }
    }
    router.push('/step-4-2');
  }

  function handleGoToPreviousStep() {
    router.push('/step-3');
  }

  return (
    <>
      <Head>
        <title>4-1. JSON 생성</title>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-logo" onClick={() => router.push('/ai-automation-project')}>
            HANRA STUDIO
          </div>

          <div className="sidebar-card">
            <div className="workflow-title">진행 단계</div>
            <ul className="workflow-list">
              <li><Link href="/ai-automation-project" className="workflow-item">1. 주제 추천</Link></li>
              <li><Link href="/step-2" className="workflow-item">2. AI 대본 생성</Link></li>
              <li><Link href="/step-3" className="workflow-item">3. 대본 직접 입력</Link></li>
              <li><Link href="/step-4-1" className="workflow-item active">4-1. JSON 생성</Link></li>
              <li><Link href="/step-4-2" className="workflow-item">4-2. 이미지 생성</Link></li>
              <li><Link href="/step-6" className="workflow-item">5. TTS 생성</Link></li>
              <li><Link href="/step-5-2" className="workflow-item">5-2. BGM 삽입</Link></li>
              <li><Link href="/step-7" className="workflow-item">6. 영상 렌더링</Link></li>
              <li><Link href="/step-8" className="workflow-item">7. 제목/설명 작성</Link></li>
              <li><Link href="/step-9" className="workflow-item">8. 썸네일 생성기</Link></li>
              <li><Link href="/step-10" className="workflow-item">9. 최종 제작</Link></li>
              <li><Link href="/step-11" className="workflow-item">10. 쇼츠 자동 변환</Link></li>
              <li><Link href="/step-12" className="workflow-item">11. 채널 매니저</Link></li>
              <li><Link href="/step-13" className="workflow-item">12. 작업 보관함</Link></li>
            </ul>
          </div>
        </aside>

        <main className="main">
          <div className="header-row">
            <div className="title-area">
              <div className="header-top-row">
                <button className="btn-previous-step" type="button" onClick={handleGoToPreviousStep}>
                  ← 이전 단계
                </button>
                <h1>4-1. JSON 생성</h1>
              </div>
              <p className="subtitle">대본을 씬별로 분할하여 이미지 생성용 JSON 데이터를 추출합니다</p>
            </div>
            <div className="header-actions">
              {promptScenes.some(s => hasKorean(s.image_script_en ?? s.image_prompt ?? '')) && (
                <span className="header-korean-warning">이미지 스크립트에 한글 포함</span>
              )}
              <button
                className="btn-primary"
                type="button"
                onClick={extractJson}
                disabled={isExtractingJson || !step3Data}
                title={!step3Data ? '3단계 데이터가 필요합니다' : (promptScenes.some(s => hasKorean(s.image_script_en ?? s.image_prompt ?? '')) ? '전체 JSON 재생성 (영문 변환)' : '')}
              >
                {isExtractingJson ? 'JSON 생성 중...' : (promptScenes.some(s => hasKorean(s.image_script_en ?? s.image_prompt ?? '')) ? '재생성' : '4-1 JSON 생성')}
              </button>
              <button className="btn-reset" type="button" onClick={handleReset}>
                리셋
              </button>
              <button className="btn-download-all" type="button" onClick={handleDownloadAll}>
                전체 이미지 스크립트, 대사 다운로드
              </button>
            </div>
          </div>

          {/* 이미지 자동 생성 안내 */}
          <section className="content-card image-auto-notice">
            <div className="image-auto-notice-content">
              <span className="image-auto-text">이미지 자동 생성 준비가 완료되었습니다. 분석된 내용을 확인하고, 수정사항을 입력하세요.</span>
            </div>
          </section>

          {/* 캐릭터 분석 리스트 */}
          <section className="content-card character-section">
            <div className="character-section-header">
              <span className="character-section-icon">👥</span>
              <h2 className="character-section-title">캐릭터 분석 리스트</h2>
            </div>
            {isAnalyzingCharacters ? (
              <div className="analyzing-message">대본을 분석하여 캐릭터를 추출하는 중...</div>
            ) : (
              <div className="character-list">
                {characters.map((char, idx) => (
                  <div key={char.id} className="character-card">
                    <div className="character-header">
                      <input
                        type="checkbox"
                        checked={char.checked}
                        onChange={(e) => handleCharacterChange(idx, 'checked', e.target.checked)}
                        className="character-checkbox"
                      />
                      <div className="character-title-group">
                        <span className="character-name">{char.name || (idx === 0 ? '내레이터' : '주인공')}</span>
                        {(char.age || char.gender) && (
                          <span className="character-age-gender">{char.age} {char.gender}</span>
                        )}
                      </div>
                      <button className="btn-copy-character" onClick={() => copyCharacterDescription(idx)}>COPY</button>
                    </div>
                    <textarea
                      className="character-description"
                      value={char.character_prompt_en ?? char.description}
                      onChange={(e) => handleCharacterChange(idx, 'character_prompt_en', e.target.value)}
                      placeholder="캐릭터 설명 (영문, 이미지 생성용)"
                      rows={4}
                    />
                    {char.description_ko && (
                      <div className="character-description-ko">한글 원문: {char.description_ko.slice(0, 150)}{char.description_ko.length > 150 ? '…' : ''}</div>
                    )}
                    <input
                      type="text"
                      className={`character-modification ${char.modification ? 'has-content' : ''}`}
                      placeholder="외모나 특징에 대한 수정사항을 입력하세요..."
                      value={char.modification}
                      onChange={(e) => handleCharacterChange(idx, 'modification', e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 썸네일 이미지 시나리오 */}
          <section className="content-card thumbnail-section">
            <div className="thumbnail-section-header">
              <span className="thumbnail-section-icon">🎬</span>
              <h2 className="thumbnail-section-title">썸네일 이미지 시나리오</h2>
            </div>
            {isGeneratingThumbnails ? (
              <div className="analyzing-message">대본을 분석하여 썸네일 시나리오를 생성하는 중...</div>
            ) : (
              <div className="thumbnail-scenario-list">
                {thumbnailScenarios.map((scenario, idx) => (
                  <div key={scenario.id} className="thumbnail-scenario-card">
                    <div className="thumbnail-scenario-header">
                      <input
                        type="checkbox"
                        checked={scenario.checked}
                        onChange={(e) => handleThumbnailChange(idx, 'checked', e.target.checked)}
                        className="thumbnail-checkbox"
                      />
                      <div className="thumbnail-title-group">
                        <span className="thumbnail-number">Scene {scenario.id}</span>
                        <span className="thumbnail-title">{scenario.title}</span>
                        {scenario.subtitle && (
                          <span className="thumbnail-subtitle">{scenario.subtitle}</span>
                        )}
                      </div>
                    </div>
                    <div className="thumbnail-content-grid">
                      <div className="thumbnail-dialogue-section">
                        <div className="thumbnail-field-label">대사 발췌</div>
                        <textarea
                          className="thumbnail-dialogue-textarea"
                          value={scenario.dialogue}
                          onChange={(e) => handleThumbnailChange(idx, 'dialogue', e.target.value)}
                          rows={Math.max(4, Math.ceil(scenario.dialogue.length / 50))}
                          style={{ minHeight: '80px' }}
                        />
                      </div>
                      <div className="thumbnail-script-section">
                        <div className="thumbnail-field-label">이미지 스크립트 (묘사)</div>
                        <textarea
                          className="thumbnail-script-textarea"
                          value={scenario.imageScript}
                          onChange={(e) => handleThumbnailChange(idx, 'imageScript', e.target.value)}
                          rows={Math.max(4, Math.ceil(scenario.imageScript.length / 50))}
                          style={{ minHeight: '80px' }}
                        />
                      </div>
                    </div>
                    <div className="thumbnail-modification-section">
                      <input
                        type="text"
                        className={`thumbnail-modification-input ${scenario.modification ? 'has-content' : ''}`}
                        placeholder="장면 구성이나 배경에 대한 수정사항 입력..."
                        value={scenario.modification}
                        onChange={(e) => handleThumbnailChange(idx, 'modification', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {showPromptReview && promptScenes.length > 0 && (
            <div className="content-card">
              <div className="field-label">씬별 프롬프트 검토</div>
              <p className="section-desc">대사 발췌는 한글, 이미지 스크립트는 영문만 표시·수정합니다.</p>
              <div className="prompt-list">
                {promptScenes.map((scene) => (
                  <div key={scene.scene_num} className="prompt-item">
                    <div className="prompt-item-header">
                      <span className="prompt-scene-num">씬 {scene.scene_num}</span>
                      <span className="prompt-scene-title">{scene.scene_title || '씬 ' + scene.scene_num}</span>
                    </div>
                    <div className="prompt-field">
                      <div className="prompt-field-label">대사 발췌 (한글)</div>
                      <textarea
                        className="prompt-field-input"
                        value={scene.dialogue_ko ?? scene.script ?? ''}
                        onChange={(e) => handlePromptChange(scene.scene_num, 'dialogue_ko', e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="prompt-field">
                      <div className="prompt-field-label">이미지 스크립트 (영문)</div>
                      <textarea
                        className={`prompt-field-input ${hasKorean(scene.image_script_en ?? scene.image_prompt ?? '') ? 'prompt-field-input-has-korean' : ''}`}
                        value={scene.image_script_en ?? scene.image_prompt ?? ''}
                        onChange={(e) => handlePromptChange(scene.scene_num, 'image_script_en', e.target.value)}
                        rows={3}
                      />
                      {hasKorean(scene.image_script_en ?? scene.image_prompt ?? '') && (
                        <div className="prompt-field-korean-warning">
                          <span className="prompt-field-korean-warning-text">이미지 스크립트에 한글이 포함되어 있습니다. 영문만 사용해 주세요.</span>
                          <div className="prompt-field-korean-actions">
                            <button type="button" className="btn-regenerate-json" onClick={extractJson} disabled={isExtractingJson}>
                              {isExtractingJson ? '생성 중…' : '재생성'}
                            </button>
                            <button type="button" className="btn-translate-to-en" onClick={() => handleTranslateSceneToEn(scene.scene_num)} disabled={translatingSceneNum !== null}>
                              {translatingSceneNum === scene.scene_num ? '변환 중…' : '영문 변환 실행'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="prompt-field">
                      <div className="prompt-field-label">시각적 묘사 (영문)</div>
                      <textarea
                        className="prompt-field-input"
                        value={scene.visual_description ?? ''}
                        onChange={(e) => handlePromptChange(scene.scene_num, 'visual_description', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <section className="content-card">
            <div className="field-label">씬(Scene)별 분할 미리보기</div>
            <p className="section-desc">2단계에서 작성한 영상 뼈대(Storyline)를 기준으로 씬별 구성을 확인합니다.</p>
            <div className="scene-grid">
              {thumbnailScenarios.length > 0 ? (
                thumbnailScenarios.map((scenario, idx) => (
                  <div className="scene-card" key={`scenario-${scenario.id}-${idx}`}>
                    <div className="scene-title">Scene {scenario.id}</div>
                    {scenario.title && (
                      <div className="scene-subtitle">{scenario.title}</div>
                    )}
                    {scenario.subtitle && (
                      <div className="scene-subtitle-text">{scenario.subtitle}</div>
                    )}
                    {scenario.dialogue && (
                      <div className="scene-dialogue">
                        <strong>대사:</strong> {scenario.dialogue}
                      </div>
                    )}
                    {scenario.imageScript && (
                      <div className="scene-image-script">
                        <strong>이미지 스크립트:</strong> {scenario.imageScript}
                      </div>
                    )}
                    {!scenario.title && !scenario.dialogue && !scenario.imageScript && (
                      <div className="scene-body">씬 {idx + 1}</div>
                    )}
                  </div>
                ))
              ) : (
                scenes.map((scene, idx) => (
                  <div className="scene-card" key={`${scene}-${idx}`}>
                    <div className="scene-title">씬 {idx + 1}</div>
                    <div className="scene-body">{scene}</div>
                  </div>
                ))
              )}
            </div>
          </section>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button className="btn-secondary" type="button" onClick={handleGoToPreviousStep}>
              ← 이전 단계
            </button>
            <button className="btn-primary" type="button" onClick={handleGoToStep42}>4-2. 이미지 생성 단계로 이동</button>
          </div>
        </main>
      </div>

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
          transition: background 0.2s, color 0.2s, border-color 0.2s;
        }
        .workflow-item:hover { background: #f7fafc; border-color: #cbd5e0; color: #2d3748; }
        .workflow-item.active {
          background: linear-gradient(135deg, #e9d8fd 0%, #e2e8f0 100%);
          border-color: #b794f4;
          color: #553c9a;
          font-weight: 600;
        }
        .workflow-list li:nth-child(3) .workflow-item {
          margin-top: 10px;
          border-top: 1px dashed #e2e8f0;
          padding-top: 14px;
        }
        .main { flex: 1; padding: 24px 32px 40px; overflow-y: auto; }
        .header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .header-top-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .header-korean-warning {
          font-size: 12px;
          color: #c53030;
          font-weight: 500;
          padding: 4px 8px;
          background: #fff5f5;
          border-radius: 6px;
          border: 1px solid #fc8181;
        }
        .btn-reset {
          padding: 8px 16px;
          background: #ef4444;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-reset:hover {
          background: #dc2626;
        }
        .title-area h1 {
          font-size: 24px;
          font-weight: 700;
          color: #222;
          margin-bottom: 4px;
        }
        .btn-previous-step {
          padding: 6px 14px;
          background: #718096;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-previous-step:hover {
          background: #4a5568;
        }
        .btn-secondary {
          padding: 10px 16px;
          background: #718096;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-secondary:hover {
          background: #4a5568;
        }
        .subtitle {
          font-size: 14px;
          color: #666;
          margin: 0;
        }
        .content-card {
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          margin-bottom: 20px;
        }
        .summary-card {
          background: #fff7fb;
          border-color: #fed7e2;
        }
        .field-label {
          font-size: 14px;
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 8px;
        }
        .btn-download-all {
          padding: 8px 16px;
          background: #805ad5;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-download-all:hover {
          background: #6b46c1;
        }
        .section-desc {
          font-size: 13px;
          color: #666;
          margin-bottom: 12px;
          line-height: 1.5;
        }
        .summary-text {
          font-size: 13px;
          color: #333;
          line-height: 1.6;
          white-space: pre-line;
          max-height: 200px;
          overflow-y: auto;
          padding: 12px;
          background: rgba(255,255,255,0.9);
          border-radius: 8px;
          border: 1px solid #fed7e2;
        }
        .json-editor {
          width: 100%;
          min-height: 300px;
          padding: 16px;
          background: #1e1e1e;
          color: #d4d4d4;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.6;
          border: 1px solid #3e3e3e;
          border-radius: 8px;
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-x: auto;
          margin-bottom: 12px;
        }
        .btn-copy {
          padding: 8px 16px;
          background: #4a5568;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 12px;
        }
        .btn-copy:hover { background: #2d3748; }
        .btn-primary {
          padding: 10px 16px;
          background: #e53935;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-primary:hover { background: #c62828; }
        .prompt-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .prompt-item {
          padding: 12px;
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }
        .prompt-item-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .prompt-scene-num {
          font-size: 12px;
          font-weight: 700;
          color: #553c9a;
          background: #e9d8fd;
          padding: 2px 8px;
          border-radius: 4px;
        }
        .prompt-scene-title {
          font-size: 13px;
          font-weight: 600;
          color: #2d3748;
        }
        .prompt-field {
          margin-bottom: 8px;
        }
        .prompt-field-label {
          font-size: 12px;
          font-weight: 700;
          color: #4a5568;
          margin-bottom: 4px;
        }
        .prompt-field-input {
          width: 100%;
          padding: 8px;
          border: 1px solid #cbd5e0;
          border-radius: 6px;
          font-size: 13px;
          font-family: inherit;
          resize: vertical;
          min-height: 60px;
        }
        .prompt-field-input:focus {
          outline: none;
          border-color: #805ad5;
          box-shadow: 0 0 0 3px rgba(128,90,213,0.1);
        }
        .prompt-field-input-has-korean {
          border-color: #e53e3e;
          background: #fff5f5;
        }
        .prompt-field-korean-warning {
          margin-top: 8px;
          padding: 10px 12px;
          background: #fff5f5;
          border: 1px solid #fc8181;
          border-radius: 6px;
          color: #c53030;
        }
        .prompt-field-korean-warning-text {
          display: block;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 8px;
        }
        .prompt-field-korean-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .btn-regenerate-json, .btn-translate-to-en {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid transparent;
        }
        .btn-regenerate-json {
          background: #805ad5;
          color: #fff;
          border-color: #805ad5;
        }
        .btn-regenerate-json:hover:not(:disabled) {
          background: #6b46c1;
        }
        .btn-regenerate-json:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .btn-translate-to-en {
          background: #2b6cb0;
          color: #fff;
          border-color: #2b6cb0;
        }
        .btn-translate-to-en:hover:not(:disabled) {
          background: #2c5282;
        }
        .btn-translate-to-en:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .scene-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 8px;
        }
        .scene-card {
          background: #f7fafc;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          padding: 10px;
        }
        .scene-title {
          font-size: 13px;
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 4px;
        }
        .scene-subtitle {
          font-size: 12px;
          font-weight: 600;
          color: #553c9a;
          margin-bottom: 4px;
        }
        .scene-subtitle-text {
          font-size: 11px;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 6px;
        }
        .scene-dialogue {
          font-size: 11px;
          color: #4a5568;
          line-height: 1.5;
          margin-bottom: 6px;
        }
        .scene-dialogue strong {
          color: #2d3748;
        }
        .scene-image-script {
          font-size: 11px;
          color: #4a5568;
          line-height: 1.5;
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px solid #e2e8f0;
        }
        .scene-image-script strong {
          color: #2d3748;
        }
        .scene-body {
          font-size: 12px;
          color: #4a5568;
          line-height: 1.5;
        }
        .image-auto-notice {
          margin-bottom: 20px;
          background: #2a2d3a;
          border: none;
          padding: 8px 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .image-auto-notice-content {
          display: flex;
          align-items: center;
        }
        .image-auto-text {
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
          letter-spacing: 0.2px;
          line-height: 1.4;
        }
        .character-section {
          margin-bottom: 24px;
        }
        .character-section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .character-section-icon {
          font-size: 24px;
        }
        .character-section-title {
          font-size: 18px;
          font-weight: 700;
          color: #2d3748;
          margin: 0;
        }
        .analyzing-message {
          padding: 20px;
          text-align: center;
          color: #666;
          font-size: 14px;
        }
        .character-list {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        .character-card {
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 16px;
          position: relative;
        }
        .character-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          justify-content: space-between;
        }
        .character-checkbox {
          width: 20px;
          height: 20px;
          cursor: pointer;
          accent-color: #ff1493;
        }
        .character-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }
        .character-header .btn-copy-character {
          margin-left: auto;
        }
        .character-name {
          font-size: 16px;
          font-weight: 700;
          color: #2d3748;
        }
        .character-age-gender {
          font-size: 13px;
          color: #718096;
        }
        .character-description {
          width: 100%;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          font-size: 13px;
          font-family: inherit;
          resize: vertical;
          margin-bottom: 12px;
          color: #333;
          line-height: 1.6;
        }
        .character-description:focus {
          outline: none;
          border-color: #805ad5;
          box-shadow: 0 0 0 3px rgba(128,90,213,0.1);
        }
        .character-modification {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 13px;
          font-family: inherit;
          margin-bottom: 12px;
          background: #fff;
          color: #333;
          transition: all 0.2s;
        }
        .character-modification:focus {
          outline: none;
          border-color: #805ad5;
          box-shadow: 0 0 0 3px rgba(128,90,213,0.1);
        }
        .character-modification::placeholder {
          color: #a0aec0;
        }
        .character-modification.has-content {
          background: #f0f9ff;
          border-color: #3b82f6;
          color: #1e40af;
          font-weight: 500;
          box-shadow: 0 1px 3px rgba(59,130,246,0.1);
        }
        .character-modification.has-content:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
          background: #eff6ff;
        }
        .btn-copy-character {
          padding: 4px 10px;
          background: #4a5568;
          color: #fff;
          border: none;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          height: 24px;
          line-height: 1;
          white-space: nowrap;
        }
        .btn-copy-character:hover {
          background: #2d3748;
        }
        .thumbnail-section {
          margin-bottom: 24px;
        }
        .thumbnail-section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .thumbnail-section-icon {
          font-size: 24px;
        }
        .thumbnail-section-title {
          font-size: 18px;
          font-weight: 700;
          color: #2d3748;
          margin: 0;
        }
        .thumbnail-scenario-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .thumbnail-scenario-card {
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 16px;
        }
        .thumbnail-scenario-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .thumbnail-checkbox {
          width: 20px;
          height: 20px;
          cursor: pointer;
          accent-color: #805ad5;
        }
        .thumbnail-title-group {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .thumbnail-number {
          font-size: 16px;
          font-weight: 700;
          color: #2d3748;
        }
        .thumbnail-title {
          font-size: 16px;
          font-weight: 600;
          color: #553c9a;
        }
        .thumbnail-subtitle {
          font-size: 14px;
          font-weight: 700;
          color: #2d3748;
        }
        .thumbnail-content-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 12px;
        }
        .thumbnail-dialogue-section,
        .thumbnail-script-section {
          display: flex;
          flex-direction: column;
        }
        .thumbnail-field-label {
          font-size: 13px;
          font-weight: 700;
          color: #4a5568;
          margin-bottom: 8px;
        }
        .thumbnail-dialogue-textarea,
        .thumbnail-script-textarea {
          width: 100%;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          font-size: 13px;
          font-family: inherit;
          resize: vertical;
          color: #333;
          line-height: 1.6;
          min-height: 80px;
        }
        .thumbnail-dialogue-textarea:focus,
        .thumbnail-script-textarea:focus {
          outline: none;
          border-color: #805ad5;
          box-shadow: 0 0 0 3px rgba(128,90,213,0.1);
        }
        .thumbnail-modification-section {
          margin-top: 12px;
        }
        .thumbnail-modification-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 13px;
          font-family: inherit;
          background: #fff;
          color: #333;
          transition: all 0.2s;
        }
        .thumbnail-modification-input:focus {
          outline: none;
          border-color: #805ad5;
          box-shadow: 0 0 0 3px rgba(128,90,213,0.1);
        }
        .thumbnail-modification-input::placeholder {
          color: #a0aec0;
        }
        .thumbnail-modification-input.has-content {
          background: #f0f9ff;
          border-color: #3b82f6;
          color: #1e40af;
          font-weight: 500;
          box-shadow: 0 1px 3px rgba(59,130,246,0.1);
        }
        .thumbnail-modification-input.has-content:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
          background: #eff6ff;
        }
        @media (max-width: 768px) {
          .thumbnail-content-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
