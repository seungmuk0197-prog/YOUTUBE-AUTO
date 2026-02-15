import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import StudioLayout from '../components/StudioLayout';
import { apiGet, apiPost } from '../lib/api';
import { formatDate, unwrapProject, getProjectName } from '../lib/projectUtils';

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [topicTab, setTopicTab] = useState('basic');
  const [trendTab, setTrendTab] = useState('weekly');

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet('projects');
      const list = Array.isArray(data) ? data : data.projects || [];
      setProjects(list);
    } catch (err) {
      setError('프로젝트를 불러올 수 없습니다. 백엔드 서버(localhost:5000)가 실행 중인지 확인하세요.');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  async function handleNewProject() {
    const name = newName.trim();
    if (!name) { alert('프로젝트 이름을 입력하세요.'); return; }
    try {
      setCreating(true);
      const data = await apiPost('projects', { topic: name });
      const np = unwrapProject(data);
      setModalOpen(false);
      setNewName('');
      if (np?.id) router.push(`/projects/${np.id}/script`);
      else await loadProjects();
    } catch (err) {
      alert('프로젝트 생성 실패: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setCreating(false);
    }
  }

  const topicCategories = [
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
  const trendingTopics = [
    { rank: 1, title: 'OpenAI Sora 3.0 리뷰', category: '테크/AI', categoryColor: '#68d391', views: '350만+', tags: ['OpenAI', 'Sora', '영상AI', '리뷰'] },
    { rank: 2, title: 'GTA VI 히든 퀘스트 공략', category: '게임', categoryColor: '#fc8181', views: '280만+', tags: ['GTA6', '히든퀘스트', '공략', '팁'] },
    { rank: 3, title: '초저가 다이소 꿀템', category: '라이프/쇼핑', categoryColor: '#63b3ed', views: '210만+', tags: ['다이소', '꿀템', '저가', '추천'] },
    { rank: 4, title: '올해 최고의 K-POP 컴백', category: '엔터테인먼트', categoryColor: '#b794f4', views: '190만+', tags: ['K-POP', '컴백', '신곡', '트렌드'] },
    { rank: 5, title: '프리미어리그 경기 하이라이트', category: '스포츠', categoryColor: '#f6ad55', views: '170만+', tags: ['프리미어리그', '하이라이트', '골모음', '축구'] },
    { rank: 6, title: '집에서 만드는 간단 레시피', category: '푸드', categoryColor: '#68d391', views: '150만+', tags: ['자취요리', '간단레시피', '집밥', '요리'] },
  ];

  return (
    <StudioLayout activeStep="topic">
      <div className="page-header">
        <h1>AI 자동화 프로젝트</h1>
        <p className="page-desc">작업한 내용을 저장하고 관리하세요</p>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {/* 주제 생성 */}
      <div className="content-card ai-section">
        <h2 className="section-title">주제 생성</h2>
        <p className="section-desc">
          키워드를 입력하지 않으면 선택한 카테고리 기준으로 주제를 생성합니다.
        </p>
        <div style={{ marginBottom: '16px' }}>
          <button type="button" className="btn-outline-dark">대본 직접 넣기</button>
        </div>
        <div className="topic-tabs">
          {[
            { key: 'basic', label: '기본 주제' },
            { key: 'niche', label: '틈새 주제' },
            { key: 'channel', label: '운영 채널' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`topic-tab ${topicTab === key ? 'active' : ''}`}
              onClick={() => setTopicTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="topic-grid-wrap">
          <div className="topic-category-grid">
            {topicCategories.map((cat) => (
              <button key={cat.id} type="button" className="topic-category-btn">
                <span className="topic-cat-icon">{cat.icon}</span>
                <span className="topic-cat-label">{cat.label}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn-deselect">선택 해제</button>
        </div>
      </div>

      {/* 주간 급상승 토픽 TOP 20 */}
      <div className="content-card ai-section">
        <div className="trend-header">
          <span className="trend-date">적용: 2026.02.02 ~ 2026.02.08</span>
          <div className="trend-tabs">
            <button
              type="button"
              className={`trend-tab ${trendTab === 'weekly' ? 'active' : ''}`}
              onClick={() => setTrendTab('weekly')}
            >
              주간 급상승
            </button>
            <button
              type="button"
              className={`trend-tab ${trendTab === 'daily' ? 'active' : ''}`}
              onClick={() => setTrendTab('daily')}
            >
              일간 핫이슈
            </button>
          </div>
        </div>
        <h2 className="section-title">
          주간 급상승 토픽 TOP 20 <span className="flame">🔥</span>
        </h2>
        <div className="trending-grid">
          {trendingTopics.map((t) => (
            <div key={t.rank} className="trending-card">
              <div className="trending-rank">{t.rank}</div>
              <div className="trending-body">
                <div className="trending-title">{t.title}</div>
                <div className="trending-meta">
                  <span className="trending-category" style={{ background: t.categoryColor }}>{t.category}</span>
                  <span className="trending-views">{t.views}</span>
                </div>
                <div className="trending-tags">
                  {t.tags.map((tag) => (
                    <span key={tag} className="trending-tag">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Project Modal */}
      {modalOpen && (
        <div onClick={() => setModalOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#fff', borderRadius: '14px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            width: '90%', maxWidth: '460px', padding: '24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#2d3748' }}>새 프로젝트</h2>
              <button onClick={() => setModalOpen(false)} style={{
                width: '30px', height: '30px', border: '1px solid #e2e8f0', background: '#f7fafc',
                borderRadius: '6px', fontSize: '18px', cursor: 'pointer', color: '#718096',
              }}>x</button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">프로젝트 이름 (주제) <span style={{ color: '#e53e3e' }}>*</span></label>
              <input
                type="text" className="form-input"
                placeholder="예: 우주 다큐멘터리"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNewProject()}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setModalOpen(false)}>취소</button>
              <button className="btn-primary" style={{ width: 'auto' }} onClick={handleNewProject} disabled={creating}>
                {creating ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </StudioLayout>
  );
}
