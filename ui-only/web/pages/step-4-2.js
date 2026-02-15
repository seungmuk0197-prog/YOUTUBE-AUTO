import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ProviderSelector, { getStoredProvider, toNormalizedProvider } from '../components/ProviderSelector';
import { getApiBase } from '../utils/apiBase';

export default function Step42Page() {
  const router = useRouter();
  const [selectedWorldview, setSelectedWorldview] = useState('기본 설정');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [selectedProvider, setSelectedProvider] = useState(() => (typeof window !== 'undefined' ? getStoredProvider() : 'openai'));
  const [isGenerating, setIsGenerating] = useState(false);
  const [manualPrompts, setManualPrompts] = useState(null);
  const [queuedJob, setQueuedJob] = useState(null);
  const [imageUrls, setImageUrls] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [sceneImages, setSceneImages] = useState([]);
  const [selectAllScenes, setSelectAllScenes] = useState(false);
  const [selectAllCharacters, setSelectAllCharacters] = useState(false);
  const [characterImages, setCharacterImages] = useState([
    { id: 1, type: 'narrator', name: '내레이터 (멘토)', imageUrl: null, checked: true },
    { id: 2, type: 'protagonist', name: '주인공 1', imageUrl: null, checked: true },
    { id: 3, type: 'protagonist', name: '주인공 2', imageUrl: null, checked: false },
    { id: 4, type: 'supporting', name: '조연 1', imageUrl: null, checked: false },
    { id: 5, type: 'supporting', name: '조연 2', imageUrl: null, checked: false },
    { id: 6, type: 'extra', name: '추가 캐릭터 1', imageUrl: null, checked: false },
    { id: 7, type: 'extra', name: '추가 캐릭터 2', imageUrl: null, checked: false }
  ]);

  const worldviews = [
    {
      id: 'basic',
      title: '기본 설정',
      description: '자연스럽고 선명한 기본 스타일',
      stylePrompt: 'Natural and vivid basic style with clear lighting and realistic colors.'
    },
    {
      id: 'joseon',
      title: '조선시대 사극',
      description: '전통적 건축 의복 등, 자연광 활용',
      stylePrompt: 'Joseon Dynasty historical drama style. Characters wear traditional Korean hanbok (옛날 한복), traditional architecture with wooden structures and tiled roofs, natural lighting, period-appropriate props and settings, historical Korean aesthetic.'
    },
    {
      id: 'mystery',
      title: '미스테리 스릴러',
      description: '저조도, 영수층 돈, 음영 그림자',
      stylePrompt: 'Mystery thriller style. Low lighting, dark shadows, dramatic contrast, receipts and money layers visible, eerie atmosphere, suspenseful composition.'
    },
    {
      id: 'silent1920',
      title: '20년대 무성영화',
      description: '흑백, 높은 콘트라스트, 빈티지 필름 그레인',
      stylePrompt: '1920s silent film style. Black and white, high contrast, vintage film grain texture, dramatic lighting, classic cinematic composition.'
    },
    {
      id: 'modern',
      title: '현대 드라마',
      description: '차분한 색상, 비비드한 질감, 자연스러운 색감',
      stylePrompt: 'Modern drama style. Calm colors, vivid textures, natural color palette, contemporary settings, realistic lighting.'
    },
    {
      id: 'crime',
      title: '범죄 드라마',
      description: '차갑고 어두운 화질, 낮은 채도와 콘트라스트',
      stylePrompt: 'Crime drama style. Cold and dark picture quality, low saturation and contrast, gritty atmosphere, urban settings.'
    },
    {
      id: 'watercolor',
      title: '수채화풍 아날로그 일러스트',
      description: '부드럽고 감성적인 수채화 텍스처',
      stylePrompt: 'Watercolor style analog illustration. Soft and emotional watercolor texture, flowing colors, artistic brush strokes, dreamy aesthetic.'
    },
    {
      id: 'graphite',
      title: '흑연 드로잉 스케치북',
      description: '거친 연필 선이 살아있는 스케치 스타일',
      stylePrompt: 'Graphite drawing sketchbook style. Rough pencil lines, sketchy texture, monochrome gray tones, artistic sketch aesthetic.'
    },
    {
      id: 'ink',
      title: '동양 수묵화 모노크롬',
      description: '여백의 미가 돋보이는 먹물 그림',
      stylePrompt: 'Oriental ink wash painting monochrome. Ink painting highlighting the beauty of empty space, traditional East Asian art style, black ink on white paper, minimalist composition.'
    },
    {
      id: 'buddhist',
      title: '불교 미니멀리즘',
      description: '사실적인 한국 사찰과 실제 사람, 불상과 사찰 배경 스타일',
      stylePrompt: 'Buddhist minimalism style. Realistic Korean temples and real people, Buddha statues and temple background style, serene and peaceful atmosphere, traditional Korean Buddhist architecture.'
    },
    {
      id: 'animal',
      title: '귀여운 동물 캐릭터',
      description: '웹툰 스타일의 의인화된 동물 캐릭터 일러스트',
      stylePrompt: 'Cute animal character style. Webtoon style anthropomorphic animal character illustration, adorable and friendly, vibrant colors, cartoon aesthetic.'
    },
    {
      id: 'classic1950',
      title: '50년대 클래식영화',
      description: '테크니컬러 색감, 부드러운 조명',
      stylePrompt: '1950s classic film style. Technicolor palette, soft lighting, vintage Hollywood aesthetic, warm tones, classic cinematic composition.'
    },
    {
      id: 'northkorea',
      title: '북한 드라마',
      description: '빈티지 영화 스타일, 강렬한 색감과 연출구도',
      stylePrompt: 'North Korean drama style. Vintage film style, strong colors and directorial composition, period-appropriate settings, dramatic staging.'
    },
    {
      id: 'horror',
      title: '공포/서스펜스',
      description: '어두운 조명, 음산한 분위기, 불안감 구도',
      stylePrompt: 'Horror/suspense style. Dark lighting, eerie atmosphere, composition for uneasiness, dramatic shadows, unsettling mood.'
    },
    {
      id: 'camcorder90',
      title: '90년대 캠코더',
      description: 'VHS 화질, 모노 화면 등, 낮은 노이즈 및 질감',
      stylePrompt: '1990s camcorder style. VHS quality, mono screen, low noise and texture, home video aesthetic, nostalgic feel.'
    },
    {
      id: 'melodrama',
      title: '멜로 드라마',
      description: '부드러운 콘트라스트, 따스하고 화사한 스타일',
      stylePrompt: 'Melodrama style. Soft contrast, warm and bright style, romantic atmosphere, gentle lighting, emotional composition.'
    },
    {
      id: 'cyberpunk',
      title: '사이버펑크 네온',
      description: '네온 색상, 비 오는 모습, 미래적인 분위기',
      stylePrompt: 'Cyberpunk neon style. Neon colors, rainy scenes, futuristic atmosphere, urban nightscape, high-tech low-life aesthetic.'
    },
    {
      id: 'webtoon',
      title: '디지털 웹툰',
      description: '선명한 라인과 화려한 색감의 웹툰 스타일',
      stylePrompt: 'Digital webtoon style. Clear lines and vivid colors, Korean webtoon aesthetic, digital illustration, vibrant and dynamic.'
    },
    {
      id: 'joseon2d',
      title: '조선시대 풍속화 기반 2D 애니',
      description: '조선시대 화풍 스타일, 2D 셀애니메이션',
      stylePrompt: '2D animation based on Joseon Dynasty genre painting. Joseon Dynasty painting style, 2D cel animation, traditional Korean art meets modern animation, characters in hanbok.'
    },
    {
      id: 'neoncity',
      title: '네온시티 시티팝',
      description: '80년대 레트로 퓨처, 화려한 야경',
      stylePrompt: 'Neon city city pop style. 80s retro future, colorful nightscape, vibrant neon lights, urban cityscape, nostalgic retro aesthetic.'
    },
    {
      id: 'renaissance',
      title: '르네상스 성화',
      description: '성경 인물은 성화풍, 현대인물은 실사풍',
      stylePrompt: 'Renaissance sacred art style. Biblical characters in sacred art style, modern characters in realistic style, classical painting technique, religious art aesthetic.'
    }
  ];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSelectedProvider(getStoredProvider());
      const saved = localStorage.getItem('step4SelectedWorldview');
      if (saved) {
        setSelectedWorldview(saved);
      }
      const savedRatio = localStorage.getItem('step4AspectRatio');
      if (savedRatio) {
        setAspectRatio(savedRatio);
      }
      const savedImages = localStorage.getItem('step4GeneratedImages');
      if (savedImages) {
        try {
          const parsed = JSON.parse(savedImages);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setGeneratedImages(parsed);
          }
        } catch (e) {
          console.error('생성된 이미지 데이터 복원 실패:', e);
        }
      }
      const savedCharacterImages = localStorage.getItem('step4CharacterImages');
      if (savedCharacterImages) {
        try {
          const parsed = JSON.parse(savedCharacterImages);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCharacterImages(parsed);
          }
        } catch (e) {
          console.error('캐릭터 이미지 데이터 복원 실패:', e);
        }
      }

      // 4-1에서 분석된 캐릭터 정보를 가져와서 이름 업데이트
      updateCharacterNamesFromScript();

      // 4-1에서 저장된 썸네일 시나리오 데이터를 씬별 이미지로 변환
      loadSceneImages();
    }
  }, []);

  function loadSceneImages() {
    try {
      const thumbnailScenarios = JSON.parse(localStorage.getItem('step4ThumbnailScenarios') || '[]');
      const step4JsonPayload = JSON.parse(localStorage.getItem('step4JsonPayload') || 'null');
      
      let scenes = [];
      
      if (thumbnailScenarios && thumbnailScenarios.length > 0) {
        // 썸네일 시나리오를 씬별 이미지로 변환
        scenes = thumbnailScenarios.map((scenario, idx) => {
          const imageScript = scenario.imageScript || '';
          let koreanScript = '';
          let englishScript = '';
          
          if (imageScript.includes(' / ')) {
            const parts = imageScript.split(' / ');
            koreanScript = parts[0].trim();
            englishScript = parts.slice(1).join(' / ').trim();
          } else {
            // 한글이 포함되어 있으면 한글, 아니면 영문으로 간주
            if (/[가-힣]/.test(imageScript)) {
              koreanScript = imageScript;
            } else {
              englishScript = imageScript;
            }
          }
          
          return {
            id: scenario.id || idx + 1,
            sceneTitle: scenario.title || `씬 ${idx + 1}`,
            imageUrl: null,
            koreanScript: koreanScript,
            englishScript: englishScript,
            checked: scenario.checked !== undefined ? scenario.checked : true
          };
        });
      } else if (step4JsonPayload && step4JsonPayload.scenes) {
        // step4JsonPayload에서 씬 데이터 가져오기
        scenes = step4JsonPayload.scenes.map((scene, idx) => {
          const visualDesc = scene.visual_description || '';
          const imagePrompt = scene.image_prompt || '';
          
          return {
            id: scene.scene_num || idx + 1,
            sceneTitle: scene.scene_title || `씬 ${scene.scene_num || idx + 1}`,
            imageUrl: null,
            koreanScript: visualDesc || '',
            englishScript: imagePrompt || '',
            checked: true
          };
        });
      }
      
      // 씬이 없거나 8개 미만이면 최소 8개 빈 씬 생성
      if (scenes.length === 0 || scenes.length < 8) {
        const defaultScenes = [
          { id: 1, sceneTitle: '씬 1', imageUrl: null, koreanScript: '', englishScript: '', checked: false },
          { id: 2, sceneTitle: '씬 2', imageUrl: null, koreanScript: '', englishScript: '', checked: false },
          { id: 3, sceneTitle: '씬 3', imageUrl: null, koreanScript: '', englishScript: '', checked: false },
          { id: 4, sceneTitle: '씬 4', imageUrl: null, koreanScript: '', englishScript: '', checked: false },
          { id: 5, sceneTitle: '씬 5', imageUrl: null, koreanScript: '', englishScript: '', checked: false },
          { id: 6, sceneTitle: '씬 6', imageUrl: null, koreanScript: '', englishScript: '', checked: false },
          { id: 7, sceneTitle: '씬 7', imageUrl: null, koreanScript: '', englishScript: '', checked: false },
          { id: 8, sceneTitle: '씬 8', imageUrl: null, koreanScript: '', englishScript: '', checked: false }
        ];
        if (scenes.length === 0) {
          scenes = defaultScenes;
        } else {
          // 기존 씬은 유지하고 부족한 만큼 추가
          while (scenes.length < 8) {
            const nextId = scenes.length + 1;
            scenes.push({ id: nextId, sceneTitle: `씬 ${nextId}`, imageUrl: null, koreanScript: '', englishScript: '', checked: false });
          }
        }
      }
      
      setSceneImages(scenes);
      if (typeof window !== 'undefined') {
        localStorage.setItem('step4SceneImages', JSON.stringify(scenes));
      }
    } catch (e) {
      console.error('씬 이미지 로드 실패:', e);
      // 기본 8개 빈 씬 생성
      const defaultScenes = [
        { id: 1, sceneTitle: '씬 1', imageUrl: null, koreanScript: '', englishScript: '', checked: false },
        { id: 2, sceneTitle: '씬 2', imageUrl: null, koreanScript: '', englishScript: '', checked: false },
        { id: 3, sceneTitle: '씬 3', imageUrl: null, koreanScript: '', englishScript: '', checked: false },
        { id: 4, sceneTitle: '씬 4', imageUrl: null, koreanScript: '', englishScript: '', checked: false },
        { id: 5, sceneTitle: '씬 5', imageUrl: null, koreanScript: '', englishScript: '', checked: false },
        { id: 6, sceneTitle: '씬 6', imageUrl: null, koreanScript: '', englishScript: '', checked: false },
        { id: 7, sceneTitle: '씬 7', imageUrl: null, koreanScript: '', englishScript: '', checked: false },
        { id: 8, sceneTitle: '씬 8', imageUrl: null, koreanScript: '', englishScript: '', checked: false }
      ];
      setSceneImages(defaultScenes);
    }
  }

  // 캐릭터 정보가 변경될 때마다 이름 업데이트
  useEffect(() => {
    if (typeof window !== 'undefined') {
      updateCharacterNamesFromScript();
    }
  }, [characterImages.length]);

  function updateCharacterNamesFromScript() {
    try {
      const characters = JSON.parse(localStorage.getItem('step4Characters') || '[]');
      if (characters && characters.length > 0) {
        setCharacterImages(prevImages => {
          const updatedCharacterImages = [...prevImages];
          
          // 내레이터 찾기
          const narrator = characters.find(c => 
            c.name.includes('내레이터') || 
            c.name.includes('멘토') ||
            (c.role && c.role.includes('코치'))
          );
          if (narrator && updatedCharacterImages[0]) {
            updatedCharacterImages[0].name = narrator.name;
          }

          // 주인공 찾기 (최대 2개)
          // 주인공은 내레이터가 아닌 캐릭터 중에서 찾기
          const protagonists = characters.filter(c => 
            (c.name.includes('주인공') || c.name.includes('직장인')) &&
            !c.name.includes('내레이터') && 
            !c.name.includes('멘토')
          );
          
          // 주인공이 없으면 내레이터가 아닌 첫 번째 캐릭터를 주인공으로
          if (protagonists.length === 0) {
            const nonNarrators = characters.filter(c => 
              !c.name.includes('내레이터') && 
              !c.name.includes('멘토')
            );
            if (nonNarrators.length > 0 && updatedCharacterImages[1]) {
              updatedCharacterImages[1].name = nonNarrators[0].name || '주인공 1';
            }
            if (nonNarrators.length > 1 && updatedCharacterImages[2]) {
              updatedCharacterImages[2].name = nonNarrators[1].name || '주인공 2';
            }
          } else {
            if (protagonists.length > 0 && updatedCharacterImages[1]) {
              updatedCharacterImages[1].name = protagonists[0].name || '주인공 1';
            }
            if (protagonists.length > 1 && updatedCharacterImages[2]) {
              updatedCharacterImages[2].name = protagonists[1].name || '주인공 2';
            }
          }

          // 조연 찾기 (최대 2개)
          const supporting = characters.filter(c => c.name.includes('조연'));
          if (supporting.length > 0 && updatedCharacterImages[3]) {
            updatedCharacterImages[3].name = supporting[0].name || '조연 1';
          }
          if (supporting.length > 1 && updatedCharacterImages[4]) {
            updatedCharacterImages[4].name = supporting[1].name || '조연 2';
          }

          // 나머지 캐릭터를 추가 캐릭터로 할당
          const remaining = characters.filter(c => 
            !c.name.includes('내레이터') && 
            !c.name.includes('멘토') &&
            !c.name.includes('주인공') &&
            !c.name.includes('직장인') &&
            !c.name.includes('조연')
          );
          if (remaining.length > 0 && updatedCharacterImages[5]) {
            updatedCharacterImages[5].name = remaining[0].name || '추가 캐릭터 1';
          }
          if (remaining.length > 1 && updatedCharacterImages[6]) {
            updatedCharacterImages[6].name = remaining[1].name || '추가 캐릭터 2';
          }

          // localStorage에 저장
          if (typeof window !== 'undefined') {
            localStorage.setItem('step4CharacterImages', JSON.stringify(updatedCharacterImages));
          }

          return updatedCharacterImages;
        });
      }
    } catch (e) {
      console.error('캐릭터 이름 업데이트 실패:', e);
    }
  }

  function handleWorldviewSelect(title) {
    setSelectedWorldview(title);
    if (typeof window !== 'undefined') {
      localStorage.setItem('step4SelectedWorldview', title);
    }
  }

  function handleAspectRatioSelect(ratio) {
    setAspectRatio(ratio);
    if (typeof window !== 'undefined') {
      localStorage.setItem('step4AspectRatio', ratio);
    }
  }

  function handleCharacterImageChange(index, field, value) {
    const newCharacterImages = [...characterImages];
    if (field === 'checked') {
      newCharacterImages[index].checked = value;
    } else if (field === 'imageUrl') {
      newCharacterImages[index].imageUrl = value;
    } else if (field === 'name') {
      newCharacterImages[index].name = value;
    }
    setCharacterImages(newCharacterImages);
    
    // 체크박스 변경 시 전체 선택 상태 업데이트
    if (field === 'checked') {
      const allChecked = newCharacterImages.every(img => img.checked);
      setSelectAllCharacters(allChecked);
    }
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('step4CharacterImages', JSON.stringify(newCharacterImages));
    }
  }

  function handleCharacterImageUpload(index, event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        handleCharacterImageChange(index, 'imageUrl', e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  function getCharInfoForSlot(character, characters) {
    if (!character || !Array.isArray(characters)) return null;
    if (character.type === 'narrator') {
      return characters.find(c => c.name.includes('내레이터') || c.name.includes('멘토')) || characters[0];
    }
    if (character.type === 'protagonist') {
      const protagonists = characters.filter(c =>
        c.name.includes('주인공') || (!c.name.includes('내레이터') && !c.name.includes('멘토') && !c.name.includes('조연'))
      );
      if (character.name.includes('1') || character.name === '주인공 1') return protagonists[0] || characters[1] || characters[0];
      return protagonists[1] || protagonists[0] || characters[1] || characters[0];
    }
    if (character.type === 'supporting') {
      const supporting = characters.filter(c => c.name.includes('조연'));
      if (character.name.includes('1') || character.name === '조연 1') return supporting[0];
      return supporting[1] || supporting[0];
    }
    return characters.find(c => c.name === character.name) || characters[character.id - 1];
  }

  async function generateCharacterImage(index) {
    const character = characterImages[index];
    const characters = JSON.parse(localStorage.getItem('step4Characters') || '[]');
    const charInfo = getCharInfoForSlot(character, characters);
    if (!charInfo || !charInfo.description) {
      alert('캐릭터 정보가 없습니다. 4-1 페이지에서 먼저 캐릭터를 분석해주세요.');
      return;
    }
    const worldviewInfo = worldviews.find(w => w.title === selectedWorldview);
    const worldviewStylePrompt = worldviewInfo?.stylePrompt || '';
    let imagePrompt = charInfo.description;
    if (worldviewStylePrompt) imagePrompt += ' ' + worldviewStylePrompt;
    imagePrompt += ' Character portrait, consistent character design, high quality, detailed.';

    const apiProviders = ['openai', 'imagen4', 'nanobanana', 'nanobanana_pro'];
    const provider = toNormalizedProvider(selectedProvider);
    if (!apiProviders.includes(provider)) {
      alert('캐릭터 이미지 생성은 OpenAI·이메젠4·나노바나나(프로) 선택 시에만 가능합니다.');
      return;
    }
    try {
      const apiBase = getApiBase();
      const sizeFromRatio = aspectRatio === '16:9' ? '1024x576' : aspectRatio === '9:16' ? '576x1024' : '1024x1024';
      console.log('provider:', provider);
      const res = await fetch(`${apiBase}/api/images/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, prompt: imagePrompt, aspectRatio, size: sizeFromRatio, n: 1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText || '요청 실패');
      const url = data.images && data.images[0] ? (data.images[0].url || data.images[0].path) : null;
      if (url) {
        handleCharacterImageChange(index, 'imageUrl', url);
      } else {
        alert('이미지가 반환되지 않았습니다.');
      }
    } catch (e) {
      console.error('캐릭터 이미지 생성 실패:', e);
      alert('캐릭터 이미지 생성 실패: ' + (e.message || ''));
    }
  }

  async function generateCharacterImagesBatch() {
    const characters = JSON.parse(localStorage.getItem('step4Characters') || '[]');
    const worldviewInfo = worldviews.find(w => w.title === selectedWorldview);
    const stylePrompt = worldviewInfo?.stylePrompt || '';
    const apiBase = getApiBase();
    const sizeFromRatio = aspectRatio === '16:9' ? '1024x576' : aspectRatio === '9:16' ? '576x1024' : '1024x1024';
    const toGenerate = characterImages
      .map((char, idx) => ({ char, idx }))
      .filter(({ char }) => char.checked && !char.imageUrl);
    if (toGenerate.length === 0) return;
    const provider = toNormalizedProvider(selectedProvider);
    for (const { char, idx } of toGenerate) {
      const charInfo = getCharInfoForSlot(char, characters);
      let prompt = charInfo?.description
        ? charInfo.description + (stylePrompt ? ' ' + stylePrompt : '') + ' Character portrait, consistent character design, high quality, detailed.'
        : char.name + ' character portrait, high quality, detailed.';
      try {
        console.log('provider:', provider);
        const res = await fetch(`${apiBase}/api/images/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, prompt, aspectRatio, size: sizeFromRatio, n: 1 }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.images && data.images.length > 0) {
          const url = data.images[0].url || data.images[0].path;
          if (url) {
            setCharacterImages((prev) => {
              const next = prev.map((c, i) => (i === idx ? { ...c, imageUrl: url } : c));
              if (typeof window !== 'undefined') localStorage.setItem('step4CharacterImages', JSON.stringify(next));
              return next;
            });
          }
        }
      } catch (e) {
        console.error('캐릭터 이미지 배치 생성 실패', idx, e);
      }
    }
  }

  function handleGoToPreviousStep() {
    router.push('/step-4-1');
  }

  async function generateImages() {
    setIsGenerating(true);
    setManualPrompts(null);
    setQueuedJob(null);
    setImageUrls('');
    // 다음 틱에 실행해 '이미지 생성 중' 팝업이 먼저 그려지도록 함
    await new Promise((r) => setTimeout(r, 0));
    try {
      const thumbnailScenarios = JSON.parse(localStorage.getItem('step4ThumbnailScenarios') || '[]');
      if (!thumbnailScenarios || thumbnailScenarios.length === 0) {
        alert('썸네일 시나리오가 없습니다. 4-1 페이지에서 먼저 시나리오를 생성해주세요.');
        setIsGenerating(false);
        return;
      }
      const worldviewInfo = worldviews.find(w => w.title === selectedWorldview);
      const worldviewStylePrompt = worldviewInfo?.stylePrompt || '';
      const scenes = thumbnailScenarios.map(s => {
        let imageScript = s.imageScript || '';
        if (worldviewStylePrompt && imageScript) {
          if (imageScript.includes(' / ')) {
            const parts = imageScript.split(' / ');
            imageScript = `${parts[0]} ${worldviewInfo?.title || ''} 스타일로. / ${(parts[1] || parts[0])} ${worldviewStylePrompt}`;
          } else {
            imageScript = `${imageScript} ${worldviewStylePrompt}`;
          }
        }
        return {
          id: s.id,
          scene_num: s.id,
          imageScript,
          image_script: imageScript,
          dialogue: s.dialogue,
          title: s.title,
          checked: s.checked !== false,
        };
      });
      const apiBase = getApiBase();
      // API 서버 연결 확인 (연결 실패 시 바로 빠져나가는 것 방지)
      const pingController = new AbortController();
      const pingTimeout = setTimeout(() => pingController.abort(), 5000);
      try {
        const pingRes = await fetch(`${apiBase}/api/ping`, { method: 'GET', signal: pingController.signal });
        clearTimeout(pingTimeout);
        if (!pingRes.ok) throw new Error('서버 응답 이상');
      } catch (pingErr) {
        clearTimeout(pingTimeout);
        console.error('[이미지 생성] API 서버 연결 실패:', pingErr);
        const tip = `API 서버에 연결할 수 없습니다.\n\n• 서버가 실행 중인지 확인하세요. (포트 4000)\n• 주소: ${apiBase}\n\n터미널에서: cd apps/ai-automation/server && npm start`;
        alert(tip);
        setIsGenerating(false);
        return;
      }
      const payload = {
        provider: toNormalizedProvider(selectedProvider),
        aspectRatio: String(aspectRatio),
        scenes: scenes.map((s) => ({
          id: s.id,
          scene_num: s.scene_num ?? s.id,
          imageScript: String(s.imageScript ?? ''),
          image_script: String(s.image_script ?? s.imageScript ?? ''),
          dialogue: String(s.dialogue ?? ''),
          title: String(s.title ?? ''),
          checked: s.checked !== false,
        })),
      };
      let body;
      try {
        body = JSON.stringify(payload);
      } catch (e) {
        console.error('JSON 직렬화 실패:', e);
        throw new Error('요청 데이터를 직렬화할 수 없습니다.');
      }
      console.log('provider:', payload.provider);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      const res = await fetch(`${apiBase}/api/images/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      const endpoint = `${apiBase}/api/images/generate`;
      if (!res.ok) {
        const serverError = data.error != null ? String(data.error) : (data && typeof data === 'object' ? JSON.stringify(data) : res.statusText || '요청 실패');
        throw new Error(`[${res.status}] ${serverError}\n엔드포인트: ${endpoint}`);
      }
      
      // queued job (imagefx/whisk/midjourney)
      if (data.status === 'queued' && data.jobId) {
        setQueuedJob({
          jobId: data.jobId,
          provider: data.provider,
          instructions: data.instructions,
          prompt: data.prompt,
        });
        return;
      }
      
      // 기존 manual 모드 (imagen4 등 - prompts만 반환)
      if (data.manual === true && data.prompts) {
        setManualPrompts({ provider: data.provider || selectedProvider, prompts: data.prompts });
        return;
      }
      
      // auto 모드 (이미지 즉시 반환)
      if (data.images && Array.isArray(data.images)) {
        const ratio = aspectRatio === '16:9' ? { width: 16, height: 9 } : { width: 9, height: 16 };
        const images = data.images.map((img, idx) => ({
          scenarioId: img.sceneId ?? idx + 1,
          title: `씬 ${img.sceneId ?? idx + 1}`,
          worldview: selectedWorldview,
          aspectRatio,
          width: ratio.width,
          height: ratio.height,
          imageUrl: img.url || img.path || null,
        }));
        setGeneratedImages(images);
        if (typeof window !== 'undefined') {
          localStorage.setItem('step4GeneratedImages', JSON.stringify(images));
        }
        // 씬별 이미지 그리드에 반영 (GEN → 실제 이미지)
        setSceneImages((prev) => {
          const next = prev.map((scene) => {
            const found = images.find((img) => String(img.scenarioId) === String(scene.id) || (img.scenarioId === scene.id));
            return found && found.imageUrl ? { ...scene, imageUrl: found.imageUrl } : scene;
          });
          if (typeof window !== 'undefined') {
            localStorage.setItem('step4SceneImages', JSON.stringify(next));
          }
          return next;
        });
        // 캐릭터 이미지 자동 생성 (선택된 캐릭터만, API provider일 때)
        const apiProviders = ['openai', 'imagen4', 'nanobanana', 'nanobanana_pro'];
        if (apiProviders.includes(toNormalizedProvider(selectedProvider))) {
          generateCharacterImagesBatch();
        }
        return;
      }
      
      if (data.jobId) {
        alert(`생성 작업이 시작되었습니다. (jobId: ${data.jobId}) 폴링 UI는 추후 연동 예정입니다.`);
        return;
      }
      setManualPrompts({ provider: selectedProvider, prompts: [] });
    } catch (e) {
      console.error('이미지 생성 실패:', e);
      let msg = e.message || '';
      if (e.name === 'AbortError') msg = '요청 시간이 초과되었습니다(120초). 씬 수를 줄이거나 다시 시도해 주세요.';
      else if (msg === 'Failed to fetch' || (e.message && e.message.includes('fetch'))) {
        const apiBase = getApiBase();
        msg = `네트워크 오류(서버 미접속).\n엔드포인트: ${apiBase}/api/images/generate\n서버(포트 4000)가 실행 중인지 확인하세요.`;
      }
      alert('이미지 생성 중 오류가 발생했습니다.\n\n' + msg);
    } finally {
      setIsGenerating(false);
    }
  }

  async function completeManualJob() {
    if (!queuedJob || !queuedJob.jobId) return;
    setIsCompleting(true);
    try {
      const apiBase = getApiBase();
      const formData = new FormData();
      formData.append('jobId', queuedJob.jobId);
      if (imageUrls.trim()) {
        formData.append('imageUrls', imageUrls.trim());
      }
      const fileInput = document.getElementById('manual-image-upload');
      if (fileInput?.files && fileInput.files.length > 0) {
        Array.from(fileInput.files).forEach(file => {
          formData.append('images', file);
        });
      }
      const res = await fetch(`${apiBase}/api/images/manual/complete`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || res.statusText || '완료 처리 실패');
      }
      if (data.status === 'done' && data.images) {
        const ratio = aspectRatio === '16:9' ? { width: 16, height: 9 } : { width: 9, height: 16 };
        const images = data.images.map((img) => ({
          scenarioId: img.sceneId ?? 0,
          title: `씬 ${img.sceneId ?? 0}`,
          worldview: selectedWorldview,
          aspectRatio,
          width: ratio.width,
          height: ratio.height,
          imageUrl: img.url || null,
        }));
        setGeneratedImages(images);
        if (typeof window !== 'undefined') {
          localStorage.setItem('step4GeneratedImages', JSON.stringify(images));
          localStorage.setItem(`step4Job_${queuedJob.jobId}`, JSON.stringify(data));
        }
        setQueuedJob(null);
        setImageUrls('');
        alert('이미지 업로드가 완료되었습니다.');
      }
    } catch (e) {
      console.error('완료 처리 실패:', e);
      alert('완료 처리 중 오류가 발생했습니다. ' + (e.message || ''));
    } finally {
      setIsCompleting(false);
    }
  }

  return (
    <>
      <Head>
        <title>4-2. 이미지 생성</title>
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
              <li><Link href="/step-4-1" className="workflow-item">4-1. JSON 생성</Link></li>
              <li><Link href="/step-4-2" className="workflow-item active">4-2. 이미지 생성</Link></li>
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
          {/* 이미지 생성 중 팝업 */}
          {isGenerating && (
            <div
              className="generating-overlay"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
              }}
              aria-hidden="false"
            >
              <div
                style={{
                  background: '#fff',
                  padding: '28px 40px',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                  textAlign: 'center',
                  minWidth: '260px',
                }}
              >
                <div
                  className="generating-spinner"
                  style={{
                    width: 40,
                    height: 40,
                    border: '3px solid #e5e7eb',
                    borderTopColor: '#7c3aed',
                    borderRadius: '50%',
                    margin: '0 auto 16px',
                    animation: 'generating-spin 0.8s linear infinite',
                  }}
                />
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                  이미지 생성 중...
                </p>
                <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#6b7280' }}>
                  완료될 때까지 잠시 기다려 주세요.
                </p>
              </div>
            </div>
          )}
          <div className="header-row">
            <div className="title-area">
              <div className="header-top-row">
                <button className="btn-previous-step" type="button" onClick={handleGoToPreviousStep}>
                  ← 이전 단계
                </button>
                <h1>4-2. 이미지 생성</h1>
              </div>
              <p className="subtitle">세계관을 선택하여 이미지 생성 스타일을 설정합니다</p>
            </div>
          </div>

          {/* 이미지 생성 버튼 및 결과 */}
          <section className="content-card image-generation-section">
            <div className="generation-controls">
              <div className="generation-info">
                <p className="generation-text">
                  선택된 세계관: <strong>{selectedWorldview}</strong> |
                  비율: <strong>{aspectRatio}</strong>
                </p>
              </div>
              <ProviderSelector selectedProvider={selectedProvider} onSelect={setSelectedProvider} />
              <button 
                className="btn-generate-images" 
                type="button" 
                onClick={generateImages}
                disabled={isGenerating}
              >
                {isGenerating ? '이미지 생성 중...' : '이미지 생성하기'}
              </button>
            </div>
            {queuedJob && (
              <div className="queued-job-modal" style={{ marginTop: '16px', padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb' }}>
                <p style={{ marginBottom: '8px', fontWeight: 600 }}>작업 대기 중 (Job ID: {queuedJob.jobId})</p>
                <p style={{ marginBottom: '8px', fontSize: '14px', color: '#6b7280' }}>{queuedJob.instructions}</p>
                <div style={{ marginBottom: '12px', padding: '12px', background: '#fff', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                  <p style={{ marginBottom: '4px', fontSize: '12px', color: '#9ca3af' }}>프롬프트:</p>
                  <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{queuedJob.prompt}</pre>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
                    이미지 URL (쉼표로 구분):
                  </label>
                  <textarea
                    value={imageUrls}
                    onChange={(e) => setImageUrls(e.target.value)}
                    placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                    style={{ width: '100%', minHeight: '60px', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
                    또는 파일 업로드:
                  </label>
                  <input
                    id="manual-image-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ fontSize: '14px' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={completeManualJob}
                    disabled={isCompleting || (!imageUrls.trim() && (!document.getElementById('manual-image-upload')?.files || document.getElementById('manual-image-upload').files.length === 0))}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #10b981', background: '#ecfdf5', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {isCompleting ? '처리 중...' : '완료 처리'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(queuedJob.prompt).then(() => alert('프롬프트가 클립보드에 복사되었습니다.'));
                      }
                    }}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #6366f1', background: '#eef2ff', cursor: 'pointer' }}
                  >
                    프롬프트 복사
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQueuedJob(null);
                      setImageUrls('');
                    }}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #9ca3af', background: '#fff', cursor: 'pointer' }}
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
            {manualPrompts && (
              <div className="manual-prompts-modal" style={{ marginTop: '16px', padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb' }}>
                <p style={{ marginBottom: '8px', fontWeight: 600 }}>선택된 앱({manualPrompts.provider})에서 생성하세요</p>
                <p style={{ marginBottom: '12px', fontSize: '14px', color: '#6b7280' }}>프롬프트를 복사하거나 다운로드한 뒤 해당 서비스에 붙여넣어 사용하세요.</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-copy-prompts"
                    onClick={() => {
                      const text = JSON.stringify(manualPrompts.prompts, null, 2);
                      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(text).then(() => alert('프롬프트가 클립보드에 복사되었습니다.'));
                      } else {
                        alert('복사 기능을 사용할 수 없습니다. 다운로드를 이용해 주세요.');
                      }
                    }}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #6366f1', background: '#eef2ff', cursor: 'pointer' }}
                  >
                    프롬프트 복사
                  </button>
                  <button
                    type="button"
                    className="btn-download-prompts"
                    onClick={() => {
                      const text = JSON.stringify(manualPrompts.prompts, null, 2);
                      const blob = new Blob([text], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `prompts_${manualPrompts.provider}_${Date.now()}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #10b981', background: '#ecfdf5', cursor: 'pointer' }}
                  >
                    프롬프트 다운로드
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualPrompts(null)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #9ca3af', background: '#fff', cursor: 'pointer' }}
                  >
                    닫기
                  </button>
                </div>
              </div>
            )}

            {generatedImages.length > 0 && (
              <div className="generated-images-grid" style={{ marginTop: '16px' }}>
                {generatedImages.map((img, idx) => (
                  <div key={idx} className="generated-image-card">
                    <div className="image-placeholder" style={{ aspectRatio: `${img.width}/${img.height}` }}>
                      {img.imageUrl ? (
                        <img src={img.imageUrl} alt={img.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                      ) : (
                        <>
                          <div className="placeholder-text">{img.aspectRatio === '16:9' ? '가로형' : '세로형'}</div>
                          <div className="placeholder-info">{img.title}</div>
                        </>
                      )}
                    </div>
                    <div className="image-meta">
                      <span className="meta-worldview">{img.worldview}</span>
                      <span className="meta-ratio">{img.aspectRatio}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 캐릭터 이미지 */}
          <section className="content-card character-image-section">
            <div className="character-image-header">
              <div className="character-image-header-left">
                <span className="character-image-bar"></span>
                <h2 className="character-image-title">캐릭터 이미지</h2>
              </div>
              <div className="character-image-actions">
                <button 
                  className="btn-select-all-characters"
                  onClick={() => {
                    const newValue = !selectAllCharacters;
                    setSelectAllCharacters(newValue);
                    const updated = characterImages.map(img => ({ ...img, checked: newValue }));
                    setCharacterImages(updated);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('step4CharacterImages', JSON.stringify(updated));
                    }
                  }}
                >
                  캐릭터 전체 선택
                </button>
                <button 
                  className="btn-download-characters"
                  onClick={() => {
                    const selected = characterImages.filter(img => img.checked);
                    if (selected.length === 0) {
                      alert('선택된 캐릭터가 없습니다.');
                      return;
                    }
                    alert(`${selected.length}개의 캐릭터 이미지를 다운로드합니다. (실제 구현 시 다운로드 기능 필요)`);
                  }}
                >
                  ↓ 캐릭터 다운로드
                </button>
              </div>
            </div>
            <div className="character-image-grid">
              {characterImages.map((char, idx) => (
                <div key={char.id} className="character-image-item">
                  <div className="character-image-wrapper">
                    <input
                      type="checkbox"
                      checked={char.checked}
                      onChange={(e) => handleCharacterImageChange(idx, 'checked', e.target.checked)}
                      className="character-image-checkbox"
                    />
                    <div className="character-image-placeholder" onClick={() => document.getElementById(`file-input-${idx}`)?.click()}>
                      {char.imageUrl ? (
                        <img src={char.imageUrl} alt={char.name} className="character-image-preview" />
                      ) : (
                        <div className="character-image-wait">WAIT</div>
                      )}
                      <input
                        type="file"
                        id={`file-input-${idx}`}
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => handleCharacterImageUpload(idx, e)}
                      />
                    </div>
                    <button
                      className="btn-generate-character-image"
                      onClick={() => generateCharacterImage(idx)}
                      title="AI로 이미지 생성"
                    >
                      생성
                    </button>
                  </div>
                  <input
                    type="text"
                    className="character-image-name-input"
                    value={char.name}
                    onChange={(e) => handleCharacterImageChange(idx, 'name', e.target.value)}
                    placeholder="캐릭터 이름"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* 세계관 선택 */}
          <section className="content-card worldview-section">
            <div className="worldview-header">
              <div className="worldview-header-left">
                <span className="worldview-bullet">●</span>
                <h2 className="worldview-title">세계관 (선택)</h2>
              </div>
              <div className="aspect-ratio-selector">
                <button
                  className={`aspect-ratio-btn ${aspectRatio === '16:9' ? 'selected' : ''}`}
                  onClick={() => handleAspectRatioSelect('16:9')}
                >
                  16:9 (가로형)
                </button>
                <button
                  className={`aspect-ratio-btn ${aspectRatio === '9:16' ? 'selected' : ''}`}
                  onClick={() => handleAspectRatioSelect('9:16')}
                >
                  9:16 (세로형)
                </button>
              </div>
            </div>
            <div className="worldview-grid">
              {worldviews.map((worldview) => (
                <div
                  key={worldview.id}
                  className={`worldview-card ${selectedWorldview === worldview.title ? 'selected' : ''}`}
                  onClick={() => handleWorldviewSelect(worldview.title)}
                >
                  <div className="worldview-card-title">{worldview.title}</div>
                  <div className="worldview-card-description">{worldview.description}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 씬별 이미지 */}
          <section className="content-card scene-images-section">
            <div className="scene-images-header">
              <h2 className="scene-images-title">씬별 이미지</h2>
              <div className="scene-images-actions">
                <button 
                  className="btn-select-all-scenes"
                  onClick={() => {
                    const newValue = !selectAllScenes;
                    setSelectAllScenes(newValue);
                    const updated = sceneImages.map(img => ({ ...img, checked: newValue }));
                    setSceneImages(updated);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('step4SceneImages', JSON.stringify(updated));
                    }
                  }}
                >
                  씬 전체 선택
                </button>
                <button 
                  className="btn-download-all-scenes"
                  onClick={() => {
                    const selected = sceneImages.filter(img => img.checked);
                    if (selected.length === 0) {
                      alert('선택된 씬이 없습니다.');
                      return;
                    }
                    alert(`${selected.length}개의 씬 이미지를 다운로드합니다. (실제 구현 시 다운로드 기능 필요)`);
                  }}
                >
                  ↓ 씬 다운로드
                </button>
              </div>
            </div>
            <div className="scene-images-grid">
              {sceneImages.map((scene, idx) => (
                <div key={scene.id} className="scene-image-card">
                  <div className="scene-image-header">
                    <div className="scene-image-badge">
                      {scene.id}. {scene.sceneTitle}
                    </div>
                    <input
                      type="checkbox"
                      checked={scene.checked}
                      onChange={(e) => {
                        const updated = [...sceneImages];
                        updated[idx].checked = e.target.checked;
                        setSceneImages(updated);
                        setSelectAllScenes(updated.every(img => img.checked));
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('step4SceneImages', JSON.stringify(updated));
                        }
                      }}
                      className="scene-image-checkbox"
                    />
                  </div>
                  <div className="scene-image-placeholder">
                    {scene.imageUrl ? (
                      <img src={scene.imageUrl} alt={scene.sceneTitle} className="scene-image-preview" />
                    ) : (
                      <div className="scene-image-gen">GEN</div>
                    )}
                  </div>
                  {scene.koreanScript && (
                    <div className="scene-korean-script-text">{scene.koreanScript}</div>
                  )}
                  {scene.englishScript && (
                    <div className="scene-english-script-text">{scene.englishScript}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>

      <style jsx global>{`
        @keyframes generating-spin {
          to { transform: rotate(360deg); }
        }
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
        .title-area h1 {
          font-size: 24px;
          font-weight: 700;
          color: #222;
          margin-bottom: 4px;
        }
        .subtitle {
          font-size: 14px;
          color: #666;
          margin: 0;
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
        .content-card {
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          margin-bottom: 20px;
        }
        .worldview-section {
          margin-bottom: 24px;
        }
        .worldview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .worldview-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .worldview-bullet {
          font-size: 16px;
          color: #2d3748;
        }
        .worldview-title {
          font-size: 18px;
          font-weight: 700;
          color: #2d3748;
          margin: 0;
        }
        .aspect-ratio-selector {
          display: flex;
          gap: 8px;
        }
        .aspect-ratio-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          background: #e2e8f0;
          color: #4a5568;
        }
        .aspect-ratio-btn:hover {
          background: #cbd5e0;
        }
        .aspect-ratio-btn.selected {
          background: #805ad5;
          color: #ffffff;
        }
        .worldview-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .worldview-card {
          flex: 1 1 calc(14.285% - 7px);
          min-width: 120px;
          max-width: 150px;
          background: #f7fafc;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 10px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .worldview-card:hover {
          border-color: #cbd5e0;
          background: #edf2f7;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .worldview-card.selected {
          background: #f0f4ff;
          border-color: #805ad5;
          box-shadow: 0 0 0 3px rgba(128,90,213,0.1);
        }
        .worldview-card-title {
          font-size: 12px;
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 3px;
          line-height: 1.3;
        }
        .worldview-card.selected .worldview-card-title {
          color: #553c9a;
        }
        .worldview-card-description {
          font-size: 10px;
          color: #4a5568;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .worldview-card.selected .worldview-card-description {
          color: #4a5568;
        }
        @media (max-width: 1400px) {
          .worldview-card {
            flex: 1 1 calc(16.666% - 7px);
            max-width: 140px;
          }
        }
        @media (max-width: 1200px) {
          .worldview-card {
            flex: 1 1 calc(20% - 7px);
            max-width: 150px;
          }
        }
        @media (max-width: 900px) {
          .worldview-card {
            flex: 1 1 calc(25% - 6px);
            max-width: 160px;
          }
        }
        @media (max-width: 768px) {
          .worldview-card {
            flex: 1 1 calc(33.333% - 6px);
            max-width: 180px;
          }
        }
        @media (max-width: 480px) {
          .worldview-card {
            flex: 1 1 calc(50% - 4px);
            max-width: none;
          }
        }
        .image-generation-section {
          margin-top: 24px;
          background: linear-gradient(135deg, #f0f4ff 0%, #e9d8fd 100%);
          border-color: #c4b5fd;
          padding: 12px 16px;
        }
        .generation-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0;
        }
        .generation-info {
          flex: 1;
        }
        .generation-text {
          font-size: 13px;
          color: #4a5568;
          margin: 0;
        }
        .generation-text strong {
          color: #553c9a;
          font-weight: 700;
        }
        .btn-generate-images {
          padding: 8px 20px;
          background: #805ad5;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-generate-images:hover:not(:disabled) {
          background: #6b46c1;
        }
        .btn-generate-images:disabled {
          background: #cbd5e0;
          cursor: not-allowed;
        }
        .generated-images-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
          margin-top: 20px;
        }
        .generated-image-card {
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }
        .image-placeholder {
          width: 100%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #fff;
          min-height: 150px;
        }
        .placeholder-text {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .placeholder-info {
          font-size: 12px;
          opacity: 0.9;
        }
        .image-meta {
          padding: 10px;
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #4a5568;
        }
        .meta-worldview {
          font-weight: 600;
        }
        .meta-ratio {
          color: #805ad5;
          font-weight: 600;
        }
        .character-image-section {
          margin-bottom: 24px;
        }
        .character-image-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .character-image-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .character-image-actions {
          display: flex;
          gap: 12px;
        }
        .btn-select-all-characters,
        .btn-download-characters {
          padding: 8px 16px;
          background: #fff;
          color: #805ad5;
          border: 2px solid #805ad5;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-select-all-characters:hover,
        .btn-download-characters:hover {
          background: #f0f4ff;
        }
        .character-image-bar {
          width: 4px;
          height: 20px;
          background: #ff1493;
          border-radius: 2px;
        }
        .character-image-title {
          font-size: 18px;
          font-weight: 700;
          color: #2d3748;
          margin: 0;
        }
        .character-image-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 20px;
        }
        .character-image-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .character-image-wrapper {
          position: relative;
          width: 100%;
          max-width: 150px;
        }
        .character-image-checkbox {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 20px;
          height: 20px;
          z-index: 10;
          cursor: pointer;
          accent-color: #ff1493;
        }
        .character-image-placeholder {
          width: 100%;
          aspect-ratio: 1;
          background: #2a2d3a;
          border: 2px solid #ff1493;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.2s;
        }
        .character-image-placeholder:hover {
          border-color: #ff69b4;
          transform: scale(1.02);
        }
        .character-image-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .character-image-wait {
          font-size: 14px;
          font-weight: 600;
          color: #a0aec0;
          letter-spacing: 2px;
        }
        .btn-generate-character-image {
          width: 100%;
          margin-top: 8px;
          padding: 6px 12px;
          background: #805ad5;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-generate-character-image:hover {
          background: #6b46c1;
        }
        .character-image-name-input {
          width: 100%;
          margin-top: 8px;
          padding: 6px 8px;
          font-size: 12px;
          color: #2d3748;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          text-align: center;
          transition: all 0.2s;
        }
        .character-image-name-input:focus {
          outline: none;
          border-color: #805ad5;
          box-shadow: 0 0 0 2px rgba(128,90,213,0.1);
        }
        .character-image-name-input::placeholder {
          color: #a0aec0;
        }
        .scene-images-section {
          margin-top: 24px;
          margin-bottom: 24px;
          background: transparent;
          border: none;
          padding: 0;
          box-shadow: none;
        }
        .scene-images-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .scene-images-title {
          font-size: 18px;
          font-weight: 700;
          color: #2d3748;
          margin: 0;
        }
        .scene-images-actions {
          display: flex;
          gap: 12px;
        }
        .btn-select-all-scenes,
        .btn-download-all-scenes {
          padding: 8px 16px;
          background: #fff;
          color: #805ad5;
          border: 2px solid #805ad5;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-select-all-scenes:hover,
        .btn-download-all-scenes:hover {
          background: #f0f4ff;
        }
        .scene-images-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          grid-auto-rows: auto;
          width: 100%;
        }
        @media (max-width: 1400px) {
          .scene-images-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 1024px) {
          .scene-images-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 640px) {
          .scene-images-grid {
            grid-template-columns: 1fr;
          }
        }
        .scene-image-card {
          position: relative;
          background: linear-gradient(to right, rgba(17, 11, 36, 0.5) 0%, rgba(17, 11, 36, 0.5) 50%, #110b24 50%, #110b24 100%);
          border: 2px solid rgba(108, 99, 255, 0.6);
          border-radius: 10px;
          padding: 10px;
          transition: all 0.2s;
          box-shadow: 0 0 15px rgba(108, 99, 255, 0.3);
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }
        .scene-image-card:hover {
          border-color: rgba(173, 114, 255, 0.8);
          box-shadow: 0 0 20px rgba(173, 114, 255, 0.4);
        }
        .scene-image-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }
        .scene-image-badge {
          background: #000000;
          color: #ffffff;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }
        .scene-image-checkbox {
          width: 16px;
          height: 16px;
          cursor: pointer;
          accent-color: #5d7eff;
          z-index: 10;
        }
        .scene-image-placeholder {
          width: 100%;
          aspect-ratio: 16/9;
          background: #110b24;
          border: none;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
          overflow: hidden;
          min-height: 100px;
        }
        .scene-image-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .scene-image-gen {
          font-size: 36px;
          font-weight: 800;
          color: rgba(176, 190, 197, 0.4);
          letter-spacing: 4px;
          font-family: sans-serif;
        }
        .scene-korean-script-text {
          font-size: 11px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.5;
          margin-bottom: 6px;
          padding-left: 2px;
        }
        .scene-english-script-text {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.3);
          line-height: 1.4;
          padding-left: 2px;
          max-height: 60px;
          overflow-y: auto;
        }
        @media (max-width: 1200px) {
          .scene-images-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 768px) {
          .scene-images-grid {
            grid-template-columns: 1fr;
          }
          .scene-images-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .scene-images-actions {
            width: 100%;
            flex-direction: column;
          }
          .btn-select-all-scenes,
          .btn-download-all-scenes {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
