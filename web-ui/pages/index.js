import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import StudioLayout from '../components/StudioLayout';
import { createProjectFromTopic, createProjectForDirectScript } from '../lib/api';

/** 기본 주제 */
const TOPIC_CATEGORIES = [
  { id: 'game', label: '게임 가이드', icon: '🎮' },
  { id: 'study', label: '공부 팁', icon: '🎓' },
  { id: 'news', label: '뉴스/시사 요약', icon: '📰' },
  { id: 'motivation', label: '동기부여', icon: '🏆' },
  { id: 'reaction', label: '리액션 영상', icon: '📌' },
  { id: 'makeup', label: '메이크업 튜토리얼', icon: '💄' },
  { id: 'pets', label: '반려동물', icon: '🐾' },
  { id: 'vlog', label: '브이로그', icon: '📷' },
  { id: 'travel', label: '여행 가이드', icon: '✈️' },
  { id: 'movie', label: '영화/드라마 리뷰', icon: '🎬' },
  { id: 'cooking', label: '요리 레시피', icon: '👨‍🍳' },
  { id: 'finance', label: '재테크 기초', icon: '💰' },
  { id: 'unboxing', label: '제품 언박싱', icon: '📦' },
  { id: 'fashion', label: '패션 코디', icon: '👗' },
  { id: 'trading', label: '홈 트레이딩', icon: '📊' },
  { id: 'ai', label: 'AI 도구 리뷰', icon: '🤖' },
  { id: 'asmr', label: 'ASMR', icon: '🎧' },
  { id: 'it', label: 'IT 기기 비교', icon: '📦' },
];

/** 틈새 주제 (25개) */
const NICHE_TOPICS = [
  { id: '1in-media', label: '1인 미디어', icon: '📌' },
  { id: '3d-print', label: '3D 프린팅', icon: '📌' },
  { id: 'furniture-refresh', label: '가구 리폼', icon: '📌' },
  { id: 'classic-game', label: '고전 게임', icon: '🎮' },
  { id: 'craft-invest', label: '공예 재테크', icon: '💰' },
  { id: 'solo-camp', label: '나홀로 캠핑', icon: '⛺' },
  { id: 'data-analysis', label: '데이터 분석', icon: '📌' },
  { id: 'digital-drawing', label: '디지털 드로잉', icon: '📌' },
  { id: 'digital-nomad', label: '디지털 노마드', icon: '📌' },
  { id: 'meditation', label: '명상 테라피', icon: '🧘' },
  { id: 'minimal-life', label: '미니멀 라이프', icon: '📌' },
  { id: 'unmanned-startup', label: '무인 창업', icon: '💰' },
  { id: 'us-dividend', label: '미국 배당주', icon: '💰' },
  { id: 'real-estate-auction', label: '부동산 경매', icon: '💰' },
  { id: 'vegan-business', label: '비건 비즈니스', icon: '📌' },
  { id: 'small-business-mkt', label: '소상공인 마케팅', icon: '📌' },
  { id: 'smart-home', label: '스마트홈', icon: '🏠' },
  { id: 'senior-it', label: '시니어 IT', icon: '👴' },
  { id: 'plant-invest', label: '식물 재테크', icon: '🌱' },
  { id: 'psychology', label: '심리 상담', icon: '🧘' },
  { id: 'wine-sommelier', label: '와인 소믈리에', icon: '🍷' },
  { id: 'retirement-plan', label: '은퇴 설계', icon: '👴' },
  { id: 'used-car', label: '중고차 관리', icon: '📌' },
  { id: 'eco-startup', label: '친환경 창업', icon: '📌' },
  { id: 'career-consult', label: '커리어 컨설팅', icon: '📌' },
  { id: 'toefl-ielts', label: '토플/아이엘츠', icon: '📌' },
  { id: 'special-lang', label: '특수 외국어', icon: '📌' },
  { id: 'personal-brand', label: '퍼스널 브랜딩', icon: '📌' },
  { id: 'collab-tool-review', label: '협업툴 리뷰', icon: '📌' },
  { id: 'renewable-energy', label: '재생 에너지', icon: '📌' },
  { id: 'gov-support', label: '정부 지원금', icon: '📌' },
  { id: 'vr-ar', label: 'VR/AR 작업', icon: '📌' },
  { id: 'ai-automation', label: 'AI 자동화', icon: '🤖' },
];

/** 운영 채널 */
const CHANNEL_TOPICS = [
  { id: 'news-channel', label: '뉴스 채널', icon: '📰' },
  { id: 'shopping-shorts', label: '쇼핑 쇼츠', icon: '📌' },
  { id: 'ranking-channel', label: '순위 채널(Top 10)', icon: '📌' },
  { id: 'senior-health', label: '시니어 건강', icon: '👴' },
  { id: 'senior-story', label: '시니어 썰', icon: '👴' },
];

/** 주간 급상승 토픽 TOP 20 - 카테고리별 색상: 테크/AI(청록), 게임(빨강), 라이프/쇼핑(초록), 스포츠(주황), 엔터테인먼트(보라), 푸드(연두) */
const TRENDING_TOPICS = [
  { rank: 1, title: 'OpenAI Sora 3.0 리뷰', category: '테크/AI', categoryColor: '#319795', views: '350만+', tags: ['OpenAI', 'Sora', '영상AI', '리뷰'] },
  { rank: 2, title: 'GTA VI 히든 퀘스트 공략', category: '게임', categoryColor: '#e53e3e', views: '280만+', tags: ['GTA6', '히든퀘스트', '공략', '팁'] },
  { rank: 3, title: '초저가 다이소 꿀템', category: '라이프/쇼핑', categoryColor: '#38a169', views: '210만+', tags: ['다이소', '꿀템', '저가', '추천'] },
  { rank: 4, title: '올해 최고의 K-POP 컴백', category: '엔터테인먼트', categoryColor: '#805ad5', views: '190만+', tags: ['K-POP', '컴백', '신곡', '트렌드'] },
  { rank: 5, title: '프리미어리그 경기 하이라이트', category: '스포츠', categoryColor: '#dd6b20', views: '170만+', tags: ['프리미어리그', '하이라이트', '골모음', '축구'] },
  { rank: 6, title: '집에서 만드는 간단 레시피', category: '푸드', categoryColor: '#48bb78', views: '150만+', tags: ['자취요리', '간단레시피', '집밥', '요리'] },
  { rank: 7, title: 'ChatGPT 5 활용 꿀팁', category: '테크/AI', categoryColor: '#319795', views: '140만+', tags: ['ChatGPT', '업무자동화', '프롬프트', '활용'] },
  { rank: 8, title: '에르다 전설 공략', category: '게임', categoryColor: '#e53e3e', views: '130만+', tags: ['에르다', 'RPG', '공략', '팁'] },
  { rank: 9, title: '올해 인기 겨울 코트', category: '라이프/쇼핑', categoryColor: '#38a169', views: '120만+', tags: ['패션', '겨울', '코트', '추천'] },
  { rank: 10, title: '넷플릭스 2월 신작', category: '엔터테인먼트', categoryColor: '#805ad5', views: '110만+', tags: ['넷플릭스', '드라마', '영화', '신작'] },
  { rank: 11, title: 'NBA 올스타전 하이라이트', category: '스포츠', categoryColor: '#dd6b20', views: '100만+', tags: ['NBA', '농구', '올스타', '하이라이트'] },
  { rank: 12, title: '간편 도시락 레시피', category: '푸드', categoryColor: '#48bb78', views: '95만+', tags: ['도시락', '레시피', '간편요리', '집밥'] },
  { rank: 13, title: '클로드 AI 사용법', category: '테크/AI', categoryColor: '#319795', views: '90만+', tags: ['Claude', 'AI', '사용법', '비교'] },
  { rank: 14, title: '스타필드 DLC 공략', category: '게임', categoryColor: '#e53e3e', views: '85만+', tags: ['스타필드', 'DLC', '공략', 'RPG'] },
  { rank: 15, title: '2026 트렌드 키워드', category: '라이프/쇼핑', categoryColor: '#38a169', views: '80만+', tags: ['트렌드', '키워드', '마케팅', '2026'] },
  { rank: 16, title: '유튜브 쇼츠 인기 편집법', category: '엔터테인먼트', categoryColor: '#805ad5', views: '75만+', tags: ['쇼츠', '편집', '유튜브', '팁'] },
  { rank: 17, title: '월드컵 예선 하이라이트', category: '스포츠', categoryColor: '#dd6b20', views: '70만+', tags: ['월드컵', '축구', '예선', '하이라이트'] },
  { rank: 18, title: '다이어트 식단 추천', category: '푸드', categoryColor: '#48bb78', views: '65만+', tags: ['다이어트', '식단', '건강', '추천'] },
  { rank: 19, title: 'GPT-5 vs 클로드 비교', category: '테크/AI', categoryColor: '#319795', views: '60만+', tags: ['GPT-5', 'Claude', '비교', 'AI'] },
  { rank: 20, title: '인디게임 추천', category: '게임', categoryColor: '#e53e3e', views: '55만+', tags: ['인디게임', '추천', '스팀', '할인'] },
];

/** 일간 핫이슈 TOP 20 - 적용일 단일 (예: 2026.02.04) */
const DAILY_HOT_TOPICS = [
  { rank: 1, title: '오늘의 AI 핫툴 업데이트', category: '테크/AI', categoryColor: '#319795', views: '120만+', tags: ['신기능', '돌추천', '자동화', '업데이트'] },
  { rank: 2, title: 'Top 10 소비 트렌드', category: '라이프/쇼핑', categoryColor: '#38a169', views: '98만+', tags: ['Top10', '소비', '트렌드', '쇼핑'] },
  { rank: 3, title: '최신 게임 업데이트', category: '게임', categoryColor: '#e53e3e', views: '85만+', tags: ['게임', '업데이트', '신작', '리뷰'] },
  { rank: 4, title: '일일 엔터테인먼트 뉴스', category: '엔터테인먼트', categoryColor: '#805ad5', views: '75만+', tags: ['엔터', '뉴스', '최신', '이슈'] },
  { rank: 5, title: '오늘의 스포츠 하이라이트', category: '스포츠', categoryColor: '#dd6b20', views: '65만+', tags: ['스포츠', '하이라이트', '경기', '뉴스'] },
  { rank: 6, title: '일일 푸드 트렌드', category: '푸드', categoryColor: '#48bb78', views: '55만+', tags: ['푸드', '트렌드', '레시피', '추천'] },
  { rank: 7, title: '오늘의 테크 뉴스', category: '테크/AI', categoryColor: '#319795', views: '50만+', tags: ['테크', '뉴스', 'IT', '최신'] },
  { rank: 8, title: '일일 게임 리뷰', category: '게임', categoryColor: '#e53e3e', views: '48만+', tags: ['게임', '리뷰', '평가', '추천'] },
  { rank: 9, title: '오늘의 쇼핑 정보', category: '라이프/쇼핑', categoryColor: '#38a169', views: '45만+', tags: ['쇼핑', '정보', '추천', '할인'] },
  { rank: 10, title: '일일 엔터 소식', category: '엔터테인먼트', categoryColor: '#805ad5', views: '42만+', tags: ['엔터', '소식', '연예', '뉴스'] },
  { rank: 11, title: '오늘의 스포츠 결과', category: '스포츠', categoryColor: '#dd6b20', views: '40만+', tags: ['스포츠', '결과', '경기', '스코어'] },
  { rank: 12, title: '일일 레시피 추천', category: '푸드', categoryColor: '#48bb78', views: '38만+', tags: ['레시피', '요리', '맛집', '추천'] },
  { rank: 13, title: '오늘의 AI 트렌드', category: '테크/AI', categoryColor: '#319795', views: '35만+', tags: ['AI', '트렌드', '기술', '혁신'] },
  { rank: 14, title: '일일 게임 공략', category: '게임', categoryColor: '#e53e3e', views: '33만+', tags: ['게임', '공략', '팁', '가이드'] },
  { rank: 15, title: '오늘의 라이프스타일', category: '라이프/쇼핑', categoryColor: '#38a169', views: '30만+', tags: ['라이프', '스타일', '일상', '트렌드'] },
  { rank: 16, title: '일일 엔터 인터뷰', category: '엔터테인먼트', categoryColor: '#805ad5', views: '28만+', tags: ['인터뷰', '연예', '이슈', '인터뷰'] },
  { rank: 17, title: '오늘의 스포츠 분석', category: '스포츠', categoryColor: '#dd6b20', views: '25만+', tags: ['스포츠', '분석', '전술', '리뷰'] },
  { rank: 18, title: '일일 푸드 리뷰', category: '푸드', categoryColor: '#48bb78', views: '23만+', tags: ['푸드', '리뷰', '맛집', '추천'] },
  { rank: 19, title: '오늘의 테크 가이드', category: '테크/AI', categoryColor: '#319795', views: '20만+', tags: ['테크', '가이드', '튜토리얼', '팁'] },
  { rank: 20, title: '일일 게임 뉴스', category: '게임', categoryColor: '#e53e3e', views: '18만+', tags: ['게임', '뉴스', '업데이트', '이벤트'] },
];

const SECTION_GAP = 16;

export default function HomePage() {
  const router = useRouter();
  const [confirmedTitle, setConfirmedTitle] = useState('');
  const [topicData, setTopicData] = useState(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [creatingDirectScript, setCreatingDirectScript] = useState(false);
  const [topicTab, setTopicTab] = useState('basic');
  const [trendTab, setTrendTab] = useState('weekly');
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [scriptUrl, setScriptUrl] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [scriptUrlLoading, setScriptUrlLoading] = useState(false);
  const [scriptGenerating, setScriptGenerating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null); // { id, label, icon }
  const [selectedTrend, setSelectedTrend] = useState(null);       // { rank, title, ... }
  const [isInputFocused, setIsInputFocused] = useState(false);
  const scriptTextareaRef = useRef(null);
  
  // 제목 제안 관련 상태
  const [topicInput, setTopicInput] = useState(''); // 사용자가 입력한 주제
  const [titleSuggestions, setTitleSuggestions] = useState([]); // API에서 받은 15개 제목
  const [suggestionsLoading, setSuggestionsLoading] = useState(false); // 제목 생성 중
  const [selectedTitle, setSelectedTitle] = useState(null); // 사용자가 선택한 제목
  const [generationProgress, setGenerationProgress] = useState(0); // 생성 진행률 (0-100)
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0); // 남은 시간 (초)
  const [generationStartTime, setGenerationStartTime] = useState(null); // 생성 시작 시간

  /** 주제 직접 선택 해제: 선택 상태 초기화 + localStorage 제거 */
  const handleClearTopicSelection = () => {
    setSelectedCategory(null);
    if (typeof window !== 'undefined') localStorage.removeItem('selectedTopic');
  };

  /** 전체 해제: 모든 입력 및 선택 초기화 */
  const handleResetAll = () => {
    setScriptText('');
    setScriptUrl('');
    setSelectedCategory(null);
    setSelectedTrend(null);
    setScriptModalOpen(false);
    setConfirmedTitle('');
    setTopicInput('');
    setTitleSuggestions([]);
    setSelectedTitle(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('selectedTopic');
      localStorage.removeItem('currentProjectData');
    }
  };
  
  // 진행 상태 업데이트 useEffect
  useEffect(() => {
    if (!suggestionsLoading || !generationStartTime) {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - generationStartTime) / 1000; // 경과 시간 (초)
      const estimatedTotal = 12; // 예상 총 소요 시간 (초)
      const progress = Math.min((elapsed / estimatedTotal) * 100, 95); // 최대 95%까지
      const remaining = Math.max(estimatedTotal - elapsed, 0);

      setGenerationProgress(progress);
      setEstimatedTimeRemaining(Math.ceil(remaining));
    }, 100); // 100ms마다 업데이트

    return () => clearInterval(interval);
  }, [suggestionsLoading, generationStartTime]);

  /** 제목 제안 받기 */
  async function handleGenerateTitles() {
    const topic = topicInput.trim() || scriptText.trim();
    if (!topic || suggestionsLoading) {
      if (!topic) {
        alert('주제를 입력해주세요.');
      }
      return;
    }
    
    // 진행 상태 초기화
    setGenerationProgress(0);
    setEstimatedTimeRemaining(12);
    setGenerationStartTime(Date.now());
    setSuggestionsLoading(true);
    
    try {
      console.log('[HomePage] Requesting title suggestions for topic:', topic);
      
      let res;
      try {
        res = await fetch('/api/title-suggestions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Request-Id': `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          },
          body: JSON.stringify({ topic }),
        });
      } catch (fetchError) {
        console.error('[HomePage] Fetch error:', fetchError);
        throw new Error(`백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요. (${fetchError.message})`);
      }
      
      console.log('[HomePage] Title suggestions response status:', res.status);
      
      let data;
      try {
        const text = await res.text();
        console.log('[HomePage] Title suggestions response text:', text.substring(0, 500));
        
        if (!text || text.trim().length === 0) {
          throw new Error('서버에서 빈 응답을 받았습니다.');
        }
        
        // HTML 에러 페이지인지 확인
        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<!doctype')) {
          throw new Error(`서버가 HTML 에러 페이지를 반환했습니다. (상태: ${res.status})`);
        }
        
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('[HomePage] Failed to parse response as JSON:', parseError);
        if (parseError instanceof SyntaxError) {
          throw new Error(`서버 응답을 파싱할 수 없습니다. (상태: ${res.status}, 응답이 JSON 형식이 아닙니다)`);
        }
        throw parseError;
      }
      
      if (!res.ok) {
        const errorMsg = data?.error || `HTTP ${res.status}: ${res.statusText}`;
        console.error('[HomePage] Title suggestions API error:', errorMsg);
        throw new Error(errorMsg);
      }
      
      if (!data?.ok) {
        const errorMsg = data?.error || '제목 생성 실패';
        console.error('[HomePage] Title suggestions API returned ok=false:', errorMsg);
        throw new Error(errorMsg);
      }
      
      if (!data.titles || !Array.isArray(data.titles) || data.titles.length === 0) {
        console.error('[HomePage] Title suggestions empty or invalid:', data);
        throw new Error('제목 후보를 받지 못했습니다. 다시 시도해주세요.');
      }
      
      // 완료 상태로 설정
      setGenerationProgress(100);
      setEstimatedTimeRemaining(0);
      
      // 약간의 딜레이 후 결과 표시 (UI 애니메이션을 위해)
      setTimeout(() => {
        setTitleSuggestions(data.titles);
        setSelectedTitle(null);
        console.log('[HomePage] Title suggestions generated successfully:', data.titles.length, 'titles');
      }, 300);
    } catch (e) {
      console.error('TITLE_SUGGESTIONS_FAILED', e);
      const errorMessage = e.message || '제목 생성 중 오류가 발생했습니다.';
      alert(`제목 제안 실패: ${errorMessage}\n\n백엔드 서버가 실행 중인지 확인해주세요.`);
    } finally {
      setTimeout(() => {
        setSuggestionsLoading(false);
        setGenerationProgress(0);
        setEstimatedTimeRemaining(0);
        setGenerationStartTime(null);
      }, 500);
    }
  }

  // 현재 활성 섹션 판별 ('script' | 'category' | 'trend' | null)
  const activeSection = scriptText.trim().length > 0 ? 'script'
    : selectedCategory ? 'category'
      : selectedTrend ? 'trend'
        : null;
  
  // 제목 제안 플로우 상태
  const hasSuggestions = titleSuggestions.length > 0;
  const canConfirm = !!selectedTitle || !!activeSection; // 제목 선택 또는 기존 플로우

  // 제목 확정 및 프로젝트 생성 핸들러 (단일 진실 소스)
  async function handleConfirmTitle() {
    if (creatingProject) return;
    
    // 선택된 제목 사용 (우선순위 1)
    let title = '';
    if (selectedTitle) {
      title = selectedTitle.trim();
    } else {
      // 레거시 호환: scriptText > selectedCategory > selectedTrend 순서
      if (scriptText.trim()) {
        title = scriptText.trim();
      } else if (selectedCategory?.label) {
        title = selectedCategory.label;
      } else if (selectedTrend?.title) {
        title = selectedTrend.title;
      }
    }
    
    if (!title) {
      if (titleSuggestions.length > 0) {
        alert('제목 후보 중 하나를 선택해주세요.');
      } else {
        alert('주제를 입력하거나 선택해주세요.');
      }
      return;
    }
    
    setConfirmedTitle(title);
    setCreatingProject(true);
    
    // topicData 수집
    const topicDataObj = {
      source: titleSuggestions.length > 0 ? 'suggested-title' : activeSection,
      topicInput: topicInput || scriptText,
      suggestions: titleSuggestions.length > 0 ? titleSuggestions : null,
      selectedTitle: selectedTitle || title,
      topic: title,
      script: activeSection === 'script' ? scriptText : null,
      timestamp: new Date().toISOString(),
      metadata: {
        category: selectedCategory,
        trend: selectedTrend
      }
    };
    setTopicData(topicDataObj);
    
    try {
      // 프로젝트 생성 (주제추천 확정 시에만)
      const project = await createProjectFromTopic(title, topicDataObj);
      
      // 프로젝트 생성 성공 시 2단계(대본 기획)로 바로 이동
      if (project && project.id) {
        console.log('[HomePage] Project created successfully, navigating to script-planning step', { projectId: project.id });
        router.replace(`/script-planning?projectId=${project.id}`);
      } else {
        console.error('[HomePage] Project created but missing id', { project });
        alert('프로젝트 생성은 성공했지만 프로젝트 ID를 받지 못했습니다. 프로젝트 목록에서 확인해주세요.');
        router.push('/projects');
      }
    } catch (e) {
      console.error('CREATE_PROJECT_FROM_TOPIC_FAILED', e);
      alert(`프로젝트 생성 실패: ${e.message || '알 수 없는 오류'}`);
      setCreatingProject(false);
    }
  }
  
  // 3. 대본생성부터 시작 (직접 작성/타겟팅 대본이 있을 때)
  async function handleStartFromScriptGeneration() {
    if (creatingDirectScript || creatingProject) return;
    setCreatingDirectScript(true);
    try {
      const project = await createProjectForDirectScript('직접 입력 대본');
      if (project?.id) {
        router.replace(`/script-generation?projectId=${project.id}`);
      } else {
        alert('프로젝트 생성에 실패했습니다.');
      }
    } catch (e) {
      console.error('createProjectForDirectScript failed', e);
      alert(`프로젝트 생성 실패: ${e.message || '알 수 없는 오류'}`);
    } finally {
      setCreatingDirectScript(false);
    }
  }

  // 레거시 호환: handleConfirmTopic도 handleConfirmTitle로 리다이렉트
  const handleConfirmTopic = handleConfirmTitle;

  // 레거시 호환: 원클릭 완전자동화 (제목 확정 후 프로젝트 생성)
  const handleFullAuto = () => {
    handleConfirmTopic();
  };

  // 레거시 호환: 대본 기획으로 이동 (제목 확정 후 프로젝트 생성)
  const handleScriptPlanning = () => {
    handleConfirmTopic();
  };

  // 액션 버튼 컴포넌트
  const ActionButtons = () => (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: '16px',
      marginTop: '24px',
      padding: '20px',
      background: '#FAFAFA',
      borderRadius: '12px',
      border: '1px solid #eee',
      animation: 'fadeIn 0.5s ease-out'
    }}>
      <button
        type="button"
        onClick={handleConfirmTitle}
        disabled={creatingProject || !canConfirm}
        style={{
          background: creatingProject || !canConfirm ? '#cbd5e0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '14px 32px',
          borderRadius: '10px',
          border: 'none',
          fontWeight: 700,
          fontSize: '16px',
          boxShadow: creatingProject || !canConfirm ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
          cursor: (creatingProject || !canConfirm) ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'transform 0.2s, box-shadow 0.2s',
          opacity: (creatingProject || !canConfirm) ? 0.6 : 1,
        }}
        onMouseEnter={(e) => { 
          if (!creatingProject && canConfirm) {
            e.currentTarget.style.transform = 'translateY(-2px)'; 
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'; 
          }
        }}
        onMouseLeave={(e) => { 
          e.currentTarget.style.transform = 'translateY(0)'; 
          e.currentTarget.style.boxShadow = creatingProject || !canConfirm ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)'; 
        }}
        title={creatingProject ? '프로젝트 생성 중...' : canConfirm ? '제목을 확정하고 프로젝트를 시작합니다' : '제목을 선택하거나 주제를 입력해주세요'}
      >
        <span>{creatingProject ? '⏳' : '🚀'}</span> 
        {creatingProject ? '프로젝트 생성 중...' : '제목 확정하고 시작하기'}
      </button>
      <button
        type="button"
        onClick={handleStartFromScriptGeneration}
        disabled={creatingDirectScript || creatingProject}
        style={{
          background: (creatingDirectScript || creatingProject) ? '#cbd5e0' : 'transparent',
          color: (creatingDirectScript || creatingProject) ? '#718096' : '#667eea',
          padding: '12px 24px',
          borderRadius: '10px',
          border: `2px solid ${(creatingDirectScript || creatingProject) ? '#e2e8f0' : '#667eea'}`,
          fontWeight: 600,
          fontSize: '14px',
          cursor: (creatingDirectScript || creatingProject) ? 'not-allowed' : 'pointer',
          opacity: (creatingDirectScript || creatingProject) ? 0.6 : 1,
        }}
        title="직접 작성한 대본이나 타겟팅한 대본이 있으면 3. 대본생성부터 입력할 수 있습니다"
      >
        {creatingDirectScript ? '⏳ 생성 중...' : '✍️ 이미 대본이 있으면 3. 대본생성부터 시작'}
      </button>
    </div>
  );

  // 섹션 스타일 (비활성 시 흐릿하게 + 클릭 불가)
  const getSectionStyle = (sectionName) => {
    if (activeSection && activeSection !== sectionName) {
      return {
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginBottom: SECTION_GAP + 'px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        opacity: 0.5, pointerEvents: 'none', transition: 'opacity 0.2s',
      };
    }
    return {
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginBottom: SECTION_GAP + 'px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      transition: 'opacity 0.2s',
    };
  };

  /** HTML에서 대략적인 텍스트만 추출 */
  function htmlToPlainText(html) {
    if (!html || !html.trim().includes('<')) return html;
    const div = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (div) {
      div.innerHTML = html;
      return (div.textContent || div.innerText || html.replace(/<[^>]+>/g, '')).trim();
    }
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** URL에서 텍스트 가져오기 (드래그 앤 드롭 등) */
  async function fetchTextFromUrl(url) {
    setScriptUrlLoading(true);
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(res.statusText);
      const raw = await res.text();
      const text = htmlToPlainText(raw);
      setScriptText((prev) => (prev ? prev + '\n\n' + text : text));
    } catch (e) {
      setScriptText((prev) => (prev ? prev + '\n\n' + url : url));
    } finally {
      setScriptUrlLoading(false);
    }
  }

  function handleScriptDrop(e) {
    e.preventDefault();
    const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || '';
    const url = (uri.split(/\s+/)[0] || '').trim();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      fetchTextFromUrl(url);
    }
  }

  // 프로젝트 목록 로드 제거 (주제추천 화면에서는 불필요)

  return (
    <StudioLayout
      title="HANRA STUDIO"
      activeStep="topic"
      onStepClick={() => { }}
    >
      <div className="page-header" style={{ marginBottom: SECTION_GAP + 'px' }}>
        <div>
          <h1>AI 자동화 프로젝트</h1>
          <p>작업한 내용을 저장하고 관리하세요</p>
        </div>
        <button className="reset-button" type="button" onClick={handleResetAll} disabled={!activeSection && !hasSuggestions}>
          전체 해제
        </button>
      </div>

      <section className="section-card">
        <header>
          <div>
            <p className="section-label">1. 주제 입력</p>
            <p className="section-desc">키워드를 입력하지 않으면 선택한 카테고리 기준으로 주제를 생성합니다.</p>
          </div>
          <button className="ghost-button" onClick={() => setScriptModalOpen(true)}>대본 직접 넣기</button>
        </header>

        <div className="input-row">
          <input
            type="text"
            ref={scriptTextareaRef}
            value={topicInput || scriptText}
            onChange={(e) => {
              const value = e.target.value;
              setTopicInput(value);
              setScriptText(value);
            }}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleScriptDrop}
            disabled={activeSection && activeSection !== 'script'}
            placeholder="주제를 입력하세요..."
            className="topic-input"
          />
          <button
            type="button"
            onClick={handleGenerateTitles}
            disabled={suggestionsLoading || (!topicInput.trim() && !scriptText.trim())}
            className="primary-button"
          >
            {suggestionsLoading ? '⏳ 생성 중...' : '💡 제목 제안 받기'}
          </button>
        </div>

        {titleSuggestions.length > 0 && (
          <div className="title-suggestions-panel">
            <div className="title-suggestions-header">
              <div>
                <p className="title-suggestions-label">
                  AI가 제안한 제목 ({titleSuggestions.length}개)
                </p>
                <p className="title-suggestions-subtitle">
                  "{(topicInput || scriptText).trim() || '입력된 키워드'}"을(를) 기반으로 생성한 제목입니다.
                </p>
              </div>
              <button
                type="button"
                className="link-button"
                onClick={handleGenerateTitles}
                disabled={suggestionsLoading}
                title="키워드로 다시 생성"
              >
                다시 생성
              </button>
            </div>
            <div className="title-suggestions-grid">
              {titleSuggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion}-${index}`}
                  type="button"
                  className={`title-suggestion-card ${selectedTitle === suggestion ? 'selected' : ''}`}
                  onClick={() => setSelectedTitle(suggestion)}
                >
                  <span className="title-suggestion-index">{index + 1}</span>
                  <span className="title-suggestion-text">{suggestion}</span>
                </button>
              ))}
            </div>
            <p className="title-suggestions-hint">
              선택한 제목이 프로젝트 이름 및 다음 단계의 기반 텍스트로 사용됩니다.
            </p>
          </div>
        )}

        {(activeSection === 'script' || hasSuggestions) && <ActionButtons />}
      </section>

      <section className="section-card">
        <header>
          <div>
            <p className="section-label">2. 주제 직접 선택</p>
            <p className="section-desc">
              1번에서 입력하지 않으셨다면 아래 카테고리에서 직접 선택할 수 있습니다.
            </p>
          </div>
          <button className="ghost-button" onClick={handleClearTopicSelection} disabled={!selectedCategory}>
            선택 해제
          </button>
        </header>

        <div className="category-tabs">
          {[
            { key: 'basic', label: '기본 주제' },
            { key: 'niche', label: '틈새 주제' },
            { key: 'channel', label: '운영 채널' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTopicTab(key)}
              className={`tab-button ${topicTab === key ? 'active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="category-grid">
          {(topicTab === 'niche' ? NICHE_TOPICS : topicTab === 'channel' ? CHANNEL_TOPICS : TOPIC_CATEGORIES).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory((prev) => (prev?.id === cat.id ? null : cat))}
              className={`category-card ${selectedCategory?.id === cat.id ? 'selected' : ''}`}
            >
              <span className="category-icon">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {activeSection === 'category' && <ActionButtons />}
      </section>

      <section className="section-card">
        <header>
          <div>
            <p className="section-label">3. 주간 급상승 트렌드 TOP 20</p>
            <p className="section-desc">주간/일간 급상승 트렌드에서 원하는 주제를 골라보세요.</p>
          </div>
          <div className="section-header-right">
            <div className="date-label">
              {trendTab === 'weekly' ? '적용: 2026.02.02 ~ 2026.02.08' : '적용: 2026.02.04'}
            </div>
            <div className="trend-tabs">
              <button className={`tab-button ${trendTab === 'weekly' ? 'active' : ''}`} onClick={() => setTrendTab('weekly')}>
                주간 급상승
              </button>
              <button className={`tab-button ${trendTab === 'daily' ? 'active' : ''}`} onClick={() => setTrendTab('daily')}>
                일간 핫이슈
              </button>
            </div>
          </div>
        </header>

        <div className="trending-grid">
          {(trendTab === 'weekly' ? TRENDING_TOPICS : DAILY_HOT_TOPICS).map((topic) => (
            <button
              key={`${trendTab}-${topic.rank}`}
              onClick={() => setSelectedTrend((prev) => (prev?.rank === topic.rank ? null : topic))}
              className={`trend-card ${selectedTrend?.rank === topic.rank ? 'selected' : ''}`}
            >
              <div className="trend-card-header">
                <span className="rank">{topic.rank}</span>
                <span className="views">{topic.views}</span>
              </div>
              <p className="trend-title">{topic.title}</p>
              <div className="trend-meta">
                <span className="trend-tag">{topic.category}</span>
                {topic.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="trend-tag light">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {activeSection === 'trend' && <ActionButtons />}
      </section>


      {/* 대본 직접 넣기 모달: 3가지 옵션 */}
      {scriptModalOpen && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px' }} onClick={() => setScriptModalOpen(false)}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1a202c', marginBottom: '20px' }}>대본 직접 넣기</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                type="button"
                onClick={() => { setScriptModalOpen(false); setTimeout(() => scriptTextareaRef.current?.focus(), 100); }}
                style={{ padding: '12px 16px', border: '1px solid #e2e8f0', background: '#f7fafc', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: '#2d3748', cursor: 'pointer', textAlign: 'left' }}
              >
                완성 대본 붙여넣기
              </button>
              <label style={{ padding: '12px 16px', border: '1px solid #e2e8f0', background: '#f7fafc', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: '#2d3748', cursor: 'pointer', textAlign: 'left' }}>
                파일 업로드 (.txt, .docx, .pdf)
                <input type="file" accept=".txt,.docx,.pdf" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setScriptModalOpen(false); /* TODO: 파일 내용 로드 후 textarea에 반영 */ } e.target.value = ''; }} />
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: '#718096' }}>URL 연결 (구글 독스, 노션 등)</span>
                <input
                  type="url"
                  placeholder="https://..."
                  value={scriptUrl}
                  onChange={(e) => setScriptUrl(e.target.value)}
                  style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}
                />
                <button type="button" onClick={() => { setScriptModalOpen(false); /* TODO: URL에서 대본 가져오기 */ }} style={{ padding: '10px 16px', border: '1px solid #667eea', background: '#667eea', color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>연결</button>
              </div>
            </div>
            <button type="button" onClick={() => setScriptModalOpen(false)} style={{ marginTop: '16px', padding: '8px 16px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', fontSize: '13px', color: '#718096', cursor: 'pointer' }}>닫기</button>
          </div>
        </div>
      )}

      {/* 제목 미리보기 (확정된 제목이 있을 때만 표시) */}
      {confirmedTitle && (
        <div style={{ 
          background: '#f0f9ff', 
          border: '1px solid #0ea5e9', 
          borderRadius: '12px', 
          padding: '16px', 
          marginTop: '24px',
          boxShadow: '0 2px 12px rgba(14, 165, 233, 0.1)'
        }}>
          <div style={{ fontSize: '14px', color: '#0369a1', fontWeight: 600, marginBottom: '8px' }}>
            확정된 제목:
          </div>
          <div style={{ fontSize: '18px', color: '#0c4a6e', fontWeight: 700 }}>
            {confirmedTitle}
          </div>
        </div>
      )}

      {/* 제목 생성 중 팝업 모달 */}
      {suggestionsLoading && (
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
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              animation: 'fadeIn 0.3s ease-out',
            }}
          >
            {/* 제목 */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div
                style={{
                  fontSize: '24px',
                  marginBottom: '8px',
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              >
                🤖
              </div>
              <h3
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#1a202c',
                  marginBottom: '8px',
                }}
              >
                AI 제목 생성 중...
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: '#718096',
                  margin: 0,
                }}
              >
                {estimatedTimeRemaining > 0
                  ? `약 ${estimatedTimeRemaining}초 남았습니다`
                  : '거의 완료되었습니다'}
              </p>
            </div>

            {/* 진행 상태바 */}
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  background: '#e2e8f0',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${generationProgress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease-out',
                    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '8px',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    color: '#718096',
                  }}
                >
                  진행률
                </span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#667eea',
                  }}
                >
                  {Math.round(generationProgress)}%
                </span>
              </div>
            </div>

            {/* 상태 메시지 */}
            <div
              style={{
                textAlign: 'center',
                padding: '12px',
                background: '#f7fafc',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#4a5568',
              }}
            >
              {generationProgress < 30
                ? '주제를 분석하고 있습니다...'
                : generationProgress < 60
                ? '제목 후보를 생성하고 있습니다...'
                : generationProgress < 90
                ? '최적의 제목을 선별하고 있습니다...'
                : '거의 완료되었습니다!'}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 22px 26px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
          margin-bottom: ${SECTION_GAP}px;
        }
        .page-header h1 {
          font-size: 24px;
          margin: 0 0 4px;
          color: #1f2937;
        }
        .page-header p {
          margin: 0;
          font-size: 14px;
          color: #718096;
        }
        .reset-button {
          padding: 8px 18px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: transparent;
          font-weight: 600;
          color: #4a5568;
          cursor: pointer;
          transition: all 0.2s;
        }
        .reset-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .section-card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          padding: 24px;
          margin-bottom: 16px;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
        }
        .section-card header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 20px;
          gap: 16px;
        }
        .section-label {
          font-weight: 700;
          margin: 0;
          color: #1f2937;
          font-size: 16px;
        }
        .section-desc {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.4;
        }
        .input-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .topic-input {
          flex: 1;
          min-width: 0;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid #cbd5e0;
          font-size: 15px;
          transition: border 0.2s;
        }
        .topic-input:focus {
          border-color: #667eea;
          outline: none;
        }
        .primary-button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 0 28px;
          font-weight: 600;
          cursor: pointer;
        }
        .ghost-button {
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 10px;
          padding: 8px 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .section-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .date-label {
          font-size: 13px;
          color: #64748b;
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid #e2e8f0;
          background: #f9fafb;
        }
        .category-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .tab-button {
          border-radius: 999px;
          padding: 8px 16px;
          border: 1px solid #e2e8f0;
          background: #fff;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .tab-button.active {
          background: #eef2ff;
          border-color: #c7d2fe;
          color: #4338ca;
        }
        .category-grid {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 10px;
        }
        .category-card {
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #fff;
          padding: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          font-weight: 500;
          color: #1f2937;
          cursor: pointer;
          transition: border 0.2s, box-shadow 0.2s;
        }
        .category-card.selected {
          border-color: #ff6b6b;
          box-shadow: 0 2px 14px rgba(255, 107, 107, 0.15);
        }
        .category-icon {
          font-size: 22px;
        }
        .title-suggestions-panel {
          margin-top: 20px;
          padding: 18px;
          background: #f8fafc;
          border-radius: 16px;
          border: 1px solid #dbeafe;
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
        }
        .title-suggestions-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 14px;
        }
        .title-suggestions-label {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
        }
        .title-suggestions-subtitle {
          margin: 4px 0 0;
          font-size: 13px;
          color: #475569;
        }
        .link-button {
          border: none;
          background: transparent;
          color: #4338ca;
          font-weight: 700;
          cursor: pointer;
          padding: 6px 12px;
          border-radius: 8px;
          transition: background 0.2s;
        }
        .link-button:disabled {
          color: #cbd5e0;
          cursor: not-allowed;
        }
        .link-button:not(:disabled):hover {
          background: rgba(67, 56, 202, 0.08);
        }
        .title-suggestions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 10px;
        }
        .title-suggestion-card {
          border-radius: 12px;
          border: 1px solid transparent;
          background: #fff;
          padding: 12px 14px;
          text-align: left;
          cursor: pointer;
          transition: border 0.2s, transform 0.2s, box-shadow 0.2s;
          display: flex;
          gap: 10px;
          align-items: flex-start;
          min-height: 70px;
        }
        .title-suggestion-card:hover {
          border-color: #c7d2fe;
          transform: translateY(-2px);
          box-shadow: 0 8px 18px rgba(99, 102, 241, 0.18);
        }
        .title-suggestion-card.selected {
          border-color: #4338ca;
          background: #eef2ff;
          box-shadow: 0 10px 18px rgba(67, 56, 202, 0.3);
        }
        .title-suggestion-index {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #e0e7ff;
          color: #312e81;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          flex-shrink: 0;
        }
        .title-suggestion-text {
          font-size: 14px;
          color: #0f172a;
          line-height: 1.4;
        }
        .title-suggestions-hint {
          margin: 12px 0 0;
          font-size: 12px;
          color: #475569;
        }
        .trending-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px;
        }
        .trend-card {
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          padding: 16px;
          text-align: left;
          background: #fff;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: border 0.2s, transform 0.2s;
        }
        .trend-card.selected {
          border-color: #f97316;
          transform: translateY(-2px);
        }
        .trend-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          color: #64748b;
        }
        .rank {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #eef2ff;
          color: #4338ca;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }
        .views {
          font-weight: 600;
        }
        .trend-title {
          font-size: 15px;
          font-weight: 700;
          color: #1f2937;
          margin: 0;
          line-height: 1.4;
        }
        .trend-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .trend-tag {
          padding: 3px 10px;
          border-radius: 999px;
          background: #f5f5f5;
          font-size: 11px;
          font-weight: 600;
        }
        .trend-tag.light {
          background: #edf2ff;
          color: #4338ca;
        }
      `}</style>

    </StudioLayout>
  );
}
