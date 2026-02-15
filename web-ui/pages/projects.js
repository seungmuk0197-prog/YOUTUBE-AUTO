import { useEffect, useState, useMemo, useCallback, Fragment } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import StudioLayout from '../components/StudioLayout';
import { fetchProjects, createProject, createProjectForDirectScript, batchDeleteProjects, deleteProject, toggleProjectPin, touchProject, archiveProject, unarchiveProject, batchArchiveProjects, batchUnarchiveProjects, fetchProjectStats, getPreviewUrl, API_ORIGIN } from '../lib/api';
import { getDisplayTitle } from '../lib/projectUtils';

/**
 * [web-ui] 프로젝트 목록 전용 페이지
 * 경로: web-ui/pages/projects.js
 * 상단 "프로젝트 목록" 클릭 시 이 페이지로 이동. 즐겨찾기/보관은 이 페이지 + web-ui/lib/api.js 사용.
 */
export default function ProjectsPage() {
  const router = useRouter();
  const [allProjects, setAllProjects] = useState([]); // 원본 전체 프로젝트 (단일 소스)
  const [loading, setLoading] = useState(true);
  const [selectedProjectIds, setSelectedProjectIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  
  // 검색/정렬/필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt-desc'); // createdAt-desc, createdAt-asc, name-asc, completion-desc
  const [filterStatus, setFilterStatus] = useState('active'); // all, active, archived, hasScript, hasImages, completed
  const [isArchiving, setIsArchiving] = useState(false);
  const [isUnarchiving, setIsUnarchiving] = useState(false);
  const [stats, setStats] = useState(null);
  const [creatingDirectScript, setCreatingDirectScript] = useState(false);

  useEffect(() => {
    loadProjects();
    loadStats();
    
    // 이미지 생성 완료 이벤트 리스너 추가
    const handleImagesUpdated = (event) => {
      const { projectId } = event.detail;
      console.log(`Images updated for project ${projectId}, refetching projects...`);
      loadProjects();
      loadStats();
    };
    
    // 프로젝트 제목 업데이트 이벤트 리스너 (제목 수정 후 목록 자동 갱신)
    const handleProjectTitleUpdated = () => {
      console.log('[ProjectsPage] Project title updated event received, refetching projects...');
      loadProjects();
    };
    
    window.addEventListener('projectImagesUpdated', handleImagesUpdated);
    window.addEventListener('projectTitleUpdated', handleProjectTitleUpdated);
    
    return () => {
      window.removeEventListener('projectImagesUpdated', handleImagesUpdated);
      window.removeEventListener('projectTitleUpdated', handleProjectTitleUpdated);
    };
  }, []);

  // URL 쿼리 filter=active 반영 (사이드바 "프로젝트 목록" 클릭 시 활성 목록 표시)
  useEffect(() => {
    if (router.isReady && router.query.filter === 'active') {
      setFilterStatus('active');
    }
  }, [router.isReady, router.query.filter]);

  // 필터 변경 시마다 loadProjects 호출 금지 → 클릭 시 리렌더/refetch 폭주 방지. 초기 1회만 로드.

  async function loadStats() {
    try {
      const serverStats = await fetchProjectStats();
      if (serverStats && serverStats.totalProjects !== undefined) {
        setStats(serverStats);
      } else {
        // 프론트에서 계산
        calculateStats();
      }
    } catch (error) {
      console.warn('Failed to load stats, calculating on frontend:', error);
      calculateStats();
    }
  }

  // 보관 여부 단일 기준 (status 문자열/객체 모두 처리)
  function isProjectArchived(p) {
    return p.archived === true || p.status === 'archived' || (p.status && typeof p.status === 'object' && p.status.archived === true);
  }
  function isProjectPinned(p) {
    return p.pinned === true || p.isPinned === true || (p.status && typeof p.status === 'object' && p.status.isPinned === true);
  }

  function calculateStats() {
    const total = allProjects.length;
    const active = allProjects.filter(p => !isProjectArchived(p)).length;
    const archived = allProjects.filter(isProjectArchived).length;
    const completed = allProjects.filter(p => p.hasVideo === true).length;
    
    const scenesCounts = allProjects
      .map(p => p.scenesCount || p.scenes?.length || 0)
      .filter(c => c > 0);
    const avgScenesCount = scenesCounts.length > 0
      ? Math.round(scenesCounts.reduce((a, b) => a + b, 0) / scenesCounts.length * 10) / 10
      : 0;

    const durations = allProjects
      .map(p => {
        if (p.durationSeconds) return p.durationSeconds;
        if (p.scenes?.length > 0) {
          return p.scenes.reduce((sum, s) => sum + (s.durationSec || 0), 0);
        }
        return 0;
      })
      .filter(d => d > 0);
    const avgDurationSeconds = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    setStats({
      totalProjects: total,
      activeProjects: active,
      archivedProjects: archived,
      completedProjects: completed,
      avgScenesCount,
      avgDurationSeconds
    });
  }

  // 통계가 업데이트될 때마다 재계산
  useEffect(() => {
    if (allProjects.length > 0 && !stats) {
      calculateStats();
    } else if (allProjects.length > 0 && stats) {
      calculateStats();
    }
  }, [allProjects]);

  async function loadProjects() {
    try {
      setLoading(true);
      // 항상 전체 목록을 가져오고, 필터링은 useMemo(getFilteredAndSortedProjects)에서 처리
      // (이전 버그: closure가 stale filterStatus를 캡처하여 보관/즐겨찾기 후 refetch 시 잘못된 필터 적용)
      const list = await fetchProjects('all');
      let projectsList = Array.isArray(list) ? list : [];
      // 보관/즐겨찾기 필드 정규화 (KPI·필터와 동일 기준)
      projectsList = projectsList.map(p => {
        const archived = p.archived === true || p.status === 'archived' || (p.status && p.status.archived === true);
        const pinned = p.pinned === true || p.isPinned === true || (p.status && p.status.isPinned === true);
        return { ...p, archived: !!archived, pinned: !!pinned, isPinned: !!pinned };
      });
      setAllProjects(projectsList);
    } catch (e) {
      console.error('Failed to load projects:', e);
      setAllProjects([]);
    } finally {
      setLoading(false);
    }
  }

  // 기획 완료 = blueprint가 있고 내용이 있음 (API 플래그 말고 실제 데이터 기준)
  function hasPlanningActually(project) {
    const bp = project.blueprint;
    if (!bp || typeof bp !== 'object') return false;
    return (bp.topic && String(bp.topic).trim().length > 0) || (bp.length != null && bp.length > 0);
  }
  // 실질 완성 여부: 대본 = script 본문 또는 씬에 나레이션 있음 (API hasScript는 사용하지 않음)
  function hasScriptActually(project) {
    return (project.script && String(project.script).trim().length > 0)
      || (project.scenes?.length > 0 && project.scenes.some(s => (s.text || s.narration_ko || s.narration_en || '').trim().length > 0));
  }
  // JSON 단계 완료 = 씬이 1개 이상이고, 그 중 최소 1개에 이미지프롬프트/텍스트가 있음 (대본만 있으면 JSON 완료 아님)
  function hasScenesJsonActually(project) {
    if (!project.scenes || project.scenes.length === 0) return false;
    return project.scenes.some(s => (s.imagePrompt || s.prompt || '').trim().length > 0)
      || project.scenes.some(s => (s.text || s.narration_ko || s.narration_en || '').trim().length > 0);
  }

  // 프로젝트 완성도 계산 (점수) - 기획 포함, 실질 완성 기준
  function calculateCompletionScore(project) {
    let score = 0;
    if (hasPlanningActually(project)) score += 1;
    if (hasScriptActually(project)) score += 1;
    if (hasScenesJsonActually(project)) score += 1;
    if (project.imagesCount > 0 || project.scenes?.some(s => s.image_path)) score += 1;
    if (project.hasTts === true) score += 1;
    if (project.hasVideo === true) score += 2;
    return score;
  }

  // 프로젝트 진행률 계산 (퍼센트) - 기획 포함, 실질 완성 기준
  function calculateProgressPercent(project) {
    let progress = 0;
    
    // 기획 10%
    if (hasPlanningActually(project)) progress += 10;
    
    // 대본 18%
    if (hasScriptActually(project)) progress += 18;
    
    // JSON 18%
    if (hasScenesJsonActually(project)) progress += 18;
    
    // 이미지 24%
    const imagesCount = project.imagesCount || project.scenes?.filter(s => s.image_path).length || 0;
    const scenesCount = project.scenesCount || project.scenes?.length || 0;
    if (imagesCount > 0) {
      if (scenesCount > 0 && imagesCount >= scenesCount) {
        progress += 24;
      } else if (scenesCount > 0) {
        progress += Math.round((imagesCount / scenesCount) * 24);
      } else {
        progress += 24;
      }
    }
    
    // TTS 14%
    if (project.hasTts === true) progress += 14;

    // 영상 16%
    if (project.hasVideo === true) progress += 16;
    
    return Math.min(progress, 100);
  }

  // 현재 단계 레이블 - 기획 → 대본 → JSON 순서, 실질 완성 기준
  function getCurrentStageLabel(project) {
    if (!hasPlanningActually(project)) {
      return '기획 필요';
    }
    if (!hasScriptActually(project)) {
      return '대본 작성 필요';
    }
    if (!hasScenesJsonActually(project)) {
      return 'JSON 생성 필요';
    }
    if (project.imagesCount === 0) {
      return '이미지 생성 필요';
    }
    if (project.imagesCount < project.scenesCount) {
      return '이미지 생성 진행중';
    }
    // imagesCount >= scenesCount면 이미지 완료 → TTS/영상 체크
    if (project.hasTts !== true) {
      return 'TTS 생성 필요';
    }
    if (project.hasVideo !== true) {
      return '영상 렌더링 필요';
    }
    return '완성';
  }

  // 필터+정렬: 순수 함수, 원본 배열 변경 없음 (복사본만 정렬)
  function getFilteredAndSortedProjects(projectsList, query, sort, filter) {
    let filtered = [...projectsList];
    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter(p => {
        const name = getDisplayTitle(p).toLowerCase();
        const id = (p.id || '').toLowerCase();
        return name.includes(q) || id.includes(q);
      });
    }
    if (filter === 'active') {
      filtered = filtered.filter(p => !isProjectArchived(p));
    } else if (filter === 'archived') {
      filtered = filtered.filter(isProjectArchived);
    } else if (filter === 'favorites') {
      filtered = filtered.filter(isProjectPinned);
    } else if (filter === 'hasScript') {
      filtered = filtered.filter(p => (p.hasScript || p.scenes?.length > 0) && !isProjectArchived(p));
    } else if (filter === 'hasImages') {
      filtered = filtered.filter(p => (p.imagesCount > 0 || p.scenes?.some(s => s.image_path)) && !isProjectArchived(p));
    } else if (filter === 'completed') {
      filtered = filtered.filter(p => (p.hasFinalVideo || p.rendered) && !isProjectArchived(p));
    }
    const sorted = [...filtered].sort((a, b) => {
      if (sort === 'createdAt-desc') {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      if (sort === 'createdAt-asc') {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }
      if (sort === 'name-asc') {
        return getDisplayTitle(a).toLowerCase().localeCompare(getDisplayTitle(b).toLowerCase());
      }
      if (sort === 'completion-desc') {
        return calculateCompletionScore(b) - calculateCompletionScore(a);
      }
      return 0;
    });
    return sorted;
  }

  const projects = useMemo(
    () => getFilteredAndSortedProjects(allProjects, searchQuery, sortBy, filterStatus),
    [allProjects, searchQuery, sortBy, filterStatus]
  );

  // 필터 변경 후 선택 상태 정리 (보이는 목록에 없는 ID만 제거, 루프 방지)
  useEffect(() => {
    if (selectedProjectIds.size === 0) return;
    const visibleIds = new Set(projects.map(p => p.id));
    const newSelected = new Set(Array.from(selectedProjectIds).filter(id => visibleIds.has(id)));
    if (newSelected.size !== selectedProjectIds.size) {
      setSelectedProjectIds(newSelected);
    }
  }, [projects, selectedProjectIds]);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function toggleProjectSelection(projectId, e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const newSelected = new Set(selectedProjectIds);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedProjectIds(newSelected);
  }

  function toggleSelectAll() {
    // 현재 보이는 목록만 전체 선택
    const visibleIds = new Set(projects.map(p => p.id));
    const allVisibleSelected = Array.from(visibleIds).every(id => selectedProjectIds.has(id));
    
    if (allVisibleSelected) {
      // 현재 보이는 것만 해제
      const newSelected = new Set(selectedProjectIds);
      visibleIds.forEach(id => newSelected.delete(id));
      setSelectedProjectIds(newSelected);
    } else {
      // 현재 보이는 것 모두 선택
      const newSelected = new Set(selectedProjectIds);
      visibleIds.forEach(id => newSelected.add(id));
      setSelectedProjectIds(newSelected);
    }
  }

  function handleClearSelection() {
    setSelectedProjectIds(new Set());
  }

  // ID 기반 1건만 갱신 (낙관적 업데이트/롤백용)
  const updateOne = useCallback((projectId, patch) => {
    setAllProjects(prev => prev.map(p => (p.id === projectId ? { ...p, ...patch } : p)));
  }, []);
  // 여러 ID 한 번에 갱신 (배치 보관/해제용)
  const updateMany = useCallback((projectIds, patch) => {
    const idSet = new Set(projectIds);
    setAllProjects(prev => prev.map(p => (idSet.has(p.id) ? { ...p, ...patch } : p)));
  }, []);

  const handleTogglePin = useCallback(async (projectId, currentPinStatus, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const nextPinned = !currentPinStatus;
    updateOne(projectId, { pinned: nextPinned, isPinned: nextPinned });
    try {
      await toggleProjectPin(projectId, nextPinned);
      showToast(nextPinned ? '즐겨찾기 완료' : '즐겨찾기 해제');
    } catch (error) {
      updateOne(projectId, { pinned: currentPinStatus, isPinned: currentPinStatus });
      showToast('즐겨찾기 실패');
      console.error('[togglePinned] failed', error);
    }
  }, [updateOne]);

  async function handleArchiveSelected() {
    if (selectedProjectIds.size === 0) {
      showToast('보관할 프로젝트를 선택해주세요.', 'info');
      return;
    }

    const count = selectedProjectIds.size;
    const projectNames = Array.from(selectedProjectIds)
      .map(id => {
        const p = projects.find(pr => pr.id === id);
        return p?.name || p?.topic || id;
      })
      .slice(0, 3)
      .join(', ');
    const moreText = count > 3 ? ` 외 ${count - 3}개` : '';

    if (!confirm(`선택한 ${count}개 프로젝트를 보관할까요?\n\n${projectNames}${moreText}\n\n보관된 프로젝트는 기본 목록에서 숨겨집니다.\n언제든 복구 가능합니다.`)) {
      return;
    }

    setIsArchiving(true);
    const idsToArchive = Array.from(selectedProjectIds);
    updateMany(idsToArchive, { archived: true, status: 'archived' });
    handleClearSelection();
    try {
      let result = await batchArchiveProjects(idsToArchive);
      if (!result || result.ok === false) {
        const results = [];
        for (const id of idsToArchive) {
          try {
            await archiveProject(id);
            results.push({ id, success: true });
          } catch (err) {
            results.push({ id, success: false, error: err.message });
          }
        }
        result = {
          successCount: results.filter(r => r.success).length,
          failureCount: results.filter(r => !r.success).length
        };
      }
      const successCount = result?.successCount ?? 0;
      const failureCount = result?.failureCount ?? 0;
      if (failureCount > 0) {
        updateMany(idsToArchive, { archived: false, status: 'active' });
        await loadProjects();
        await loadStats();
      }
      if (failureCount === 0 && successCount > 0) {
        showToast(`${successCount}개 프로젝트가 보관되었습니다.`, 'success');
      } else if (successCount > 0) {
        showToast(`${successCount}개 보관 완료, ${failureCount}개 실패`, 'warning');
      } else {
        showToast('보관 실패: 모든 프로젝트 보관에 실패했습니다.', 'error');
        await loadProjects();
        await loadStats();
      }
      if (successCount > 0) await loadStats();
    } catch (error) {
      updateMany(idsToArchive, { archived: false, status: 'active' });
      await loadProjects();
      await loadStats();
      console.error('[ARCHIVE] 보관 오류:', error);
      
      // 최종 에러 처리 (앱이 죽지 않게)
      showToast('보관 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'), 'error');
      
      // 선택 상태는 유지 (사용자가 다시 시도 가능)
      // handleClearSelection() 호출하지 않음
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleUnarchiveSelected() {
    if (selectedProjectIds.size === 0) {
      showToast('보관 해제할 프로젝트를 선택해주세요.', 'info');
      return;
    }

    const count = selectedProjectIds.size;
    const projectNames = Array.from(selectedProjectIds)
      .map(id => {
        const p = projects.find(pr => pr.id === id);
        return p?.name || p?.topic || p?.title || id;
      })
      .slice(0, 3)
      .join(', ');
    const moreText = count > 3 ? ` 외 ${count - 3}개` : '';

    if (!confirm(`선택한 ${count}개 프로젝트를 보관 해제할까요?\n\n${projectNames}${moreText}\n\n보관 해제된 프로젝트는 활성 목록에 다시 나타납니다.`)) {
      return;
    }

    setIsUnarchiving(true);
    try {
      const idsToUnarchive = Array.from(selectedProjectIds);
      console.log(`[UNARCHIVE] 배치 보관 해제 시도: ${idsToUnarchive.length}개 프로젝트`);
      
      // batchUnarchiveProjects를 사용 (이 함수는 절대 throw하지 않음)
      let result = await batchUnarchiveProjects(idsToUnarchive);
      
      // result가 {ok: false}인 경우에도 처리
      if (!result || result.ok === false) {
        // 개별 보관 해제로 폴백 시도
        console.warn('[UNARCHIVE] 배치 보관 해제 실패, 개별 보관 해제로 폴백');
        const results = [];
        for (const id of idsToUnarchive) {
          const unarchiveResult = await unarchiveProject(id);
          if (unarchiveResult.ok) {
            results.push({ id, success: true });
          } else {
            results.push({ id, success: false, error: unarchiveResult.error || 'Unarchive failed' });
          }
        }
        result = {
          ok: true,
          updated: results.filter(r => r.success).map(r => ({ id: r.id })),
          failed: results.filter(r => !r.success).map(r => ({ id: r.id, reason: r.error })),
          successCount: results.filter(r => r.success).length,
          failureCount: results.filter(r => !r.success).length
        };
      }
      
      // result 처리
      const successCount = result?.successCount ?? result?.updated?.length ?? 0;
      const failureCount = result?.failureCount ?? result?.failed?.length ?? 0;
      
      // 목록 + 상단 통계 새로고침 (보관 해제 후 반드시 refetch)
      try {
        await loadProjects();
        await loadStats();
      } catch (loadError) {
        console.error('[UNARCHIVE] 목록 새로고침 실패:', loadError);
      }
      
      // 선택 상태 초기화
      handleClearSelection();
      
      // 성공/실패 메시지 표시
      if (failureCount === 0 && successCount > 0) {
        showToast(`${successCount}개 프로젝트가 보관 해제되었습니다.`, 'success');
      } else if (successCount > 0) {
        showToast(`${successCount}개 보관 해제 완료, ${failureCount}개 실패`, 'warning');
      } else {
        showToast('보관 해제 실패: 모든 프로젝트 보관 해제에 실패했습니다.', 'error');
      }
    } catch (error) {
      // 이 catch 블록은 절대 실행되지 않아야 함 (batchUnarchiveProjects와 unarchiveProject가 throw하지 않으므로)
      console.error('[UNARCHIVE] 보관 해제 오류 (예상치 못한 예외):', error);
      showToast('보관 해제 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'), 'error');
    } finally {
      setIsUnarchiving(false);
    }
  }

  // 프로젝트를 즐겨찾기/최근 열람/일반으로 분류 (순수 함수, 정렬은 복사본에서만)
  function categorizeProjects(projectsList, filter) {
    const pinned = [];
    const recent = [];
    const regular = [];
    projectsList.forEach(p => {
      if (isProjectPinned(p)) {
        pinned.push(p);
      } else if (p.lastOpenedAt && filter === 'active') {
        recent.push(p);
      } else {
        regular.push(p);
      }
    });
    const pinnedSorted = [...pinned].sort((a, b) =>
      new Date(b.lastOpenedAt || b.created_at || 0) - new Date(a.lastOpenedAt || a.created_at || 0)
    );
    const recentSorted = [...recent].sort((a, b) =>
      new Date(b.lastOpenedAt || 0) - new Date(a.lastOpenedAt || 0)
    );
    const pinnedIds = new Set(pinnedSorted.map(p => p.id));
    const filteredRecent = recentSorted.filter(p => !pinnedIds.has(p)).slice(0, 5);
    return { pinned: pinnedSorted, recent: filteredRecent, regular };
  }

  const categorized = useMemo(
    () => categorizeProjects(projects, filterStatus),
    [projects, filterStatus]
  );
  const { pinned, recent, regular } = categorized;
  const showPinned = pinned.length > 0 && filterStatus !== 'archived';
  const showRecent = recent.length > 0 && filterStatus === 'active';

  // 프로젝트 생성 버튼 클릭 시 주제추천 화면으로 이동
  function handleCreateProject() {
    router.push('/');
  }

  // 3. 대본생성부터 시작 (직접 작성/타겟팅 대본이 있을 때)
  async function handleStartFromScriptGeneration() {
    if (creatingDirectScript) return;
    setCreatingDirectScript(true);
    try {
      const project = await createProjectForDirectScript('직접 입력 대본');
      if (project?.id) {
        router.push(`/script-generation?projectId=${project.id}`);
      } else {
        showToast('프로젝트 생성에 실패했습니다.', 'error');
      }
    } catch (e) {
      console.error('createProjectForDirectScript failed', e);
      showToast(`프로젝트 생성 실패: ${e.message || '알 수 없는 오류'}`, 'error');
    } finally {
      setCreatingDirectScript(false);
    }
  }

  async function handleDeleteSelected() {
    if (selectedProjectIds.size === 0) {
      showToast('삭제할 프로젝트를 선택해주세요.', 'info');
      return;
    }

    const count = selectedProjectIds.size;
    const projectNames = Array.from(selectedProjectIds)
      .map(id => {
        const p = projects.find(pr => pr.id === id);
        return p?.name || p?.topic || id;
      })
      .slice(0, 3)
      .join(', ');
    const moreText = count > 3 ? ` 외 ${count - 3}개` : '';

    if (!confirm(`선택한 ${count}개 프로젝트를 삭제할까요?\n\n${projectNames}${moreText}\n\n⚠️ 복구 불가능합니다.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const idsToDelete = Array.from(selectedProjectIds);
      const currentProjectId = router.query.id;

      let deletedCount = 0;
      let failedCount = 0;

      // 배치 삭제 시도 (405 에러 시 자동으로 개별 삭제로 폴백됨)
      try {
        console.log(`[DELETE] 배치 삭제 시도: ${idsToDelete.length}개 프로젝트`);
        const result = await batchDeleteProjects(idsToDelete);
        
        // result.ok가 없어도 폴백 로직에서 성공했을 수 있음
        deletedCount = result.successCount || result.deleted?.length || 0;
        failedCount = result.failureCount || result.failed?.length || 0;
        
        if (result.failed && result.failed.length > 0) {
          console.warn('[DELETE] 일부 프로젝트 삭제 실패:', result.failed);
          // 실패한 항목에 대해 개별 삭제 재시도
          for (const failedItem of result.failed) {
            try {
              console.log(`[DELETE] 재시도: ${failedItem.id}`);
              await deleteProject(failedItem.id);
              deletedCount++;
              failedCount--;
            } catch (retryError) {
              console.error(`[DELETE] 재시도 실패: ${failedItem.id}`, retryError);
            }
          }
        }
      } catch (batchError) {
        console.error('[DELETE] 배치 삭제 예외 발생:', batchError);
        
        // 예외가 발생해도 개별 삭제로 재시도
        console.log('[DELETE] 개별 삭제로 재시도');
        for (const id of idsToDelete) {
          try {
            await deleteProject(id);
            deletedCount++;
          } catch (err) {
            console.error(`[DELETE] 개별 삭제 실패: ${id}`, err);
            failedCount++;
          }
        }
      }

      // 선택 상태 초기화
      setSelectedProjectIds(new Set());
      
      // 목록 새로고침 (중요: 삭제 후 반드시 refetch)
      await loadProjects();
      
      // 성공/실패 메시지 표시
      if (failedCount === 0) {
        showToast(`${deletedCount}개 프로젝트가 삭제되었습니다.`, 'success');
      } else if (deletedCount > 0) {
        showToast(`${deletedCount}개 삭제 완료, ${failedCount}개 실패`, 'warning');
      } else {
        showToast('삭제 실패: ' + (batchError?.message || '알 수 없는 오류'), 'error');
      }

      // 현재 열려있는 프로젝트가 삭제 대상이면 목록으로 리다이렉트
      if (currentProjectId && idsToDelete.includes(currentProjectId)) {
        router.push('/projects');
      }
    } catch (error) {
      console.error('[DELETE] 삭제 오류:', error);
      
      // 최종적으로 모든 시도가 실패한 경우에만 에러 메시지 표시
      if (deletedCount === 0 && failedCount === idsToDelete.length) {
        showToast('삭제 실패: ' + (error.message || '알 수 없는 오류'), 'error');
      } else if (deletedCount > 0) {
        // 일부라도 성공한 경우
        showToast(`${deletedCount}개 삭제 완료${failedCount > 0 ? `, ${failedCount}개 실패` : ''}`, failedCount > 0 ? 'warning' : 'success');
      }
    } finally {
      setIsDeleting(false);
    }
  }

  const handleCardClick = useCallback((projectId, e) => {
    if (e.target.type === 'checkbox' || e.target.closest('.project-checkbox')) return;
    router.push(`/project?id=${projectId}`);
  }, [router]);

  // 프로젝트 카드 렌더링 함수 (이미지 로드 실패 추적용 상태)
  const [imageErrors, setImageErrors] = useState(new Set());
  
  function renderProjectCard(project) {
    // 중요: 각 카드마다 고유한 project 객체를 사용해야 함 (전역 state 공유 금지)
    const projectId = project.id; // 각 카드의 고유 projectId
    const projectTitle = getDisplayTitle(project);
    const isSelected = selectedProjectIds.has(projectId);
    
    // 완성도 정보 추출 - 기획 포함, 실질 완성 기준 (대본/JSON 오표시 방지)
    const hasPlanning = hasPlanningActually(project);
    const hasScript = hasScriptActually(project);
    const hasScenesJson = hasScenesJsonActually(project);
    const imagesCount = project.imagesCount !== undefined 
      ? project.imagesCount 
      : (project.scenes?.filter(s => s.image_path).length || 0);
    const scenesCount = project.scenesCount !== undefined
      ? project.scenesCount
      : (project.scenes?.length || 0);
    // TTS/영상: 백엔드 파일 기반 flags만 사용 (프론트엔드 추측 금지)
    const hasNarration = project.hasTts === true;
    const hasFinalVideo = project.hasVideo === true;
    
    const completionScore = calculateCompletionScore(project);
    const maxScore = 7;
    const progressPercent = project.progressPercent !== undefined 
      ? project.progressPercent 
      : calculateProgressPercent(project);
    const currentStageLabel = project.currentStageLabel || getCurrentStageLabel(project);
    
    // projectId 전체 표시
    const fullId = projectId || '-';
    const isPinned = isProjectPinned(project);
    const isArchived = isProjectArchived(project);
    
    // 썸네일 URL 결정: previewImageUrl(씬1 등) > final video 썸네일 > 첫 씬 image_path
    const toImageUrl = (pathOrUrl) => {
      if (!pathOrUrl) return null;
      if (String(pathOrUrl).startsWith('http')) return pathOrUrl;
      if (String(pathOrUrl).startsWith('/')) return `${API_ORIGIN}${pathOrUrl}`;
      return getPreviewUrl(projectId, pathOrUrl);
    };
    let thumbnailUrl = null;
    if (project.previewImageUrl) {
      thumbnailUrl = toImageUrl(project.previewImageUrl);
    }
    if (!thumbnailUrl && hasFinalVideo && project.settings?.thumbnail?.path) {
      thumbnailUrl = toImageUrl(project.settings.thumbnail.path);
    }
    if (!thumbnailUrl && project.scenes?.length > 0) {
      const firstSceneWithImage = project.scenes.find(s => s.image_path);
      if (firstSceneWithImage?.image_path) {
        thumbnailUrl = toImageUrl(firstSceneWithImage.image_path);
      }
    }
    
    return (
      <div
        key={projectId}
        onClick={(e) => handleCardClick(projectId, e)}
        style={{
          background: '#fff',
          border: `2px solid ${isSelected ? '#667eea' : isArchived ? '#fbbf24' : '#e2e8f0'}`,
          borderRadius: '12px',
          padding: '0',
          cursor: 'pointer',
          transition: 'all 0.2s',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          opacity: isArchived ? 0.8 : 1
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.borderColor = '#b794f4';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(183,148,244,0.15)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.borderColor = isArchived ? '#fbbf24' : '#e2e8f0';
            e.currentTarget.style.boxShadow = 'none';
          }
        }}
      >
        {/* 썸네일 영역 */}
        {thumbnailUrl && !imageErrors.has(projectId) ? (
          <div style={{
            width: '100%',
            height: '180px',
            background: '#f3f4f6',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <img
              src={thumbnailUrl}
              alt={projectTitle}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
              onError={() => {
                setImageErrors(prev => new Set(prev).add(projectId));
              }}
            />
            {/* 보관 배지 (썸네일 위) */}
            {isArchived && (
              <div style={{
                position: 'absolute',
                top: '8px',
                left: '8px',
                padding: '4px 10px',
                background: '#fbbf24',
                color: '#78350f',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '700',
                zIndex: 10,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                📦 보관됨
              </div>
            )}
            {/* 핀 아이콘 (썸네일 위) */}
            <div
              onClick={(e) => handleTogglePin(projectId, isPinned, e)}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                zIndex: 10,
                cursor: 'pointer',
                fontSize: '20px',
                color: isPinned ? '#fbbf24' : 'rgba(255,255,255,0.7)',
                transition: 'all 0.2s',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.2)';
                e.currentTarget.style.background = 'rgba(0,0,0,0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
              }}
            >
              ⭐
            </div>
          </div>
        ) : (
          <div style={{
            width: '100%',
            height: '180px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            position: 'relative'
          }}>
            No Preview
            {/* 보관 배지 */}
            {isArchived && (
              <div style={{
                position: 'absolute',
                top: '8px',
                left: '8px',
                padding: '4px 10px',
                background: '#fbbf24',
                color: '#78350f',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '700',
                zIndex: 10,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                📦 보관됨
              </div>
            )}
            {/* 핀 아이콘 */}
            <div
              onClick={(e) => handleTogglePin(projectId, isPinned, e)}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                zIndex: 10,
                cursor: 'pointer',
                fontSize: '20px',
                color: isPinned ? '#fbbf24' : 'rgba(255,255,255,0.7)',
                transition: 'all 0.2s',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.2)';
                e.currentTarget.style.background = 'rgba(0,0,0,0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
              }}
            >
              ⭐
            </div>
          </div>
        )}

        {/* 카드 본문 */}
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* A) 상단: 체크박스 + 제목 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div
              className="project-checkbox"
              onClick={(e) => toggleProjectSelection(projectId, e)}
              style={{ flexShrink: 0 }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => toggleProjectSelection(projectId, e)}
                onClick={(e) => e.stopPropagation()}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#2d3748', marginBottom: 4, wordBreak: 'break-word' }}>
                {projectTitle}
              </div>
            </div>
          </div>

          {/* B) 중간: projectId + 생성일/수정일 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ 
              fontSize: 13, 
              color: '#a0aec0', 
              fontFamily: 'monospace',
              wordBreak: 'break-all',
              overflowWrap: 'break-word',
              whiteSpace: 'normal'
            }}>
              {fullId}
            </div>
            <div style={{ fontSize: 12, color: '#718096', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span>생성: {project.createdAt || project.created_at ? new Date(project.createdAt || project.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
              {(project.updated_at || project.updatedAt) && (
                <span>수정: {new Date(project.updated_at || project.updatedAt).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
          </div>

          {/* 구분선 */}
          <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />

          {/* C) 하단: 상태 배지 6개 (기획 → 대본 → JSON → 씬 → TTS → 영상) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {/* 기획 배지 */}
            <div style={{
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '600',
              background: hasPlanning ? '#dcfce7' : '#f3f4f6',
              color: hasPlanning ? '#166534' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>{hasPlanning ? '✅' : '❌'}</span>
              <span>기획</span>
            </div>
            {/* 대본 배지 */}
            <div style={{
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '600',
              background: hasScript ? '#d1fae5' : '#f3f4f6',
              color: hasScript ? '#065f46' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>{hasScript ? '✅' : '❌'}</span>
              <span>대본</span>
            </div>
            
            {/* JSON 배지 */}
            <div style={{
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '600',
              background: hasScenesJson ? '#dbeafe' : '#f3f4f6',
              color: hasScenesJson ? '#1e40af' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>{hasScenesJson ? '✅' : '❌'}</span>
              <span>JSON</span>
            </div>
            
            {/* 이미지 배지 */}
            <div             style={{
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '600',
              background: scenesCount > 0 ? '#e0e7ff' : '#f3f4f6',
              color: scenesCount > 0 ? '#3730a3' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>{scenesCount > 0 ? '✅' : '❌'}</span>
              <span>씬 {scenesCount > 0 ? `${scenesCount}개` : '0개'}</span>
            </div>
            
            {/* TTS 배지 */}
            <div style={{
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '600',
              background: hasNarration ? '#fef3c7' : '#f3f4f6',
              color: hasNarration ? '#92400e' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>{hasNarration ? '✅' : '❌'}</span>
              <span>TTS</span>
            </div>
            
            {/* 영상 배지 */}
            <div style={{
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '600',
              background: hasFinalVideo ? '#dcfce7' : '#f3f4f6',
              color: hasFinalVideo ? '#166534' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>{hasFinalVideo ? '✅' : '❌'}</span>
              <span>영상</span>
            </div>
          </div>

          {/* D) 완성도 점수 표시 */}
          <div style={{ marginTop: '4px' }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: completionScore === maxScore ? '#059669' : completionScore > 0 ? '#667eea' : '#9ca3af'
            }}>
              완성도 {completionScore}/{maxScore}
            </div>
          </div>

          {/* E) 진행률 Progress Bar */}
          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: '#718096', fontWeight: '600' }}>
                {currentStageLabel}
              </span>
              <span style={{ fontSize: '11px', color: '#667eea', fontWeight: '600' }}>
                {progressPercent}%
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              background: '#e2e8f0',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: progressPercent === 100
                  ? 'linear-gradient(90deg, #059669 0%, #10b981 100%)'
                  : progressPercent >= 50
                  ? 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
                  : 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)',
                transition: 'width 0.3s ease',
                borderRadius: '3px'
              }} />
            </div>
          </div>

          {/* F) 개발 모드 디버그 정보 */}
          {process.env.NODE_ENV === 'development' && (
            <div style={{
              marginTop: '8px',
              padding: '6px 8px',
              background: '#f7fafc',
              borderRadius: '4px',
              fontSize: '10px',
              fontFamily: 'monospace',
              color: '#a0aec0',
              lineHeight: '1.5',
              borderTop: '1px dashed #e2e8f0'
            }}>
              id: {projectId} | imgs: {imagesCount}/{scenesCount} | tts: {String(hasNarration)} | video: {String(hasFinalVideo)}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 현재 보이는 목록 기준으로 전체 선택 여부 확인
  const visibleIds = new Set(projects.map(p => p.id));
  const isAllVisibleSelected = projects.length > 0 && Array.from(visibleIds).every(id => selectedProjectIds.has(id));
  const hasSelection = selectedProjectIds.size > 0;
  const visibleSelectedCount = Array.from(visibleIds).filter(id => selectedProjectIds.has(id)).length;

  return (
    <StudioLayout title="프로젝트 목록 - HANRA STUDIO" activeStep="topic">
      <div data-page="web-ui-projects" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Toast 알림 */}
        {toast && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              padding: '12px 20px',
              borderRadius: '8px',
              background: toast.type === 'error' ? '#fee' : toast.type === 'info' ? '#e3f2fd' : '#e8f5e9',
              color: toast.type === 'error' ? '#c62828' : toast.type === 'info' ? '#1565c0' : '#2e7d32',
              border: `1px solid ${toast.type === 'error' ? '#f44336' : toast.type === 'info' ? '#2196f3' : '#4caf50'}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1000,
              fontSize: '14px',
              fontWeight: '600',
              animation: 'slideIn 0.3s ease-out'
            }}
          >
            {toast.message}
            <style jsx>{`
              @keyframes slideIn {
                from {
                  transform: translateX(100%);
                  opacity: 0;
                }
                to {
                  transform: translateX(0);
                  opacity: 1;
                }
              }
            `}</style>
          </div>
        )}

        {/* 통계 대시보드 (KPI) */}
        {stats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <div style={{
              background: 'white',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>총 프로젝트</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#2d3748' }}>{stats.totalProjects}</div>
            </div>
            <div style={{
              background: 'white',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>활성</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#059669' }}>{stats.activeProjects}</div>
            </div>
            <div style={{
              background: 'white',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>보관</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>{stats.archivedProjects}</div>
            </div>
            <div style={{
              background: 'white',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>완성</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#667eea' }}>{stats.completedProjects}</div>
            </div>
            {stats.avgScenesCount > 0 && (
              <div style={{
                background: 'white',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}>
                <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>평균 장면 수</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#2d3748' }}>{stats.avgScenesCount}</div>
              </div>
            )}
            {stats.avgDurationSeconds > 0 && (
              <div style={{
                background: 'white',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}>
                <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>평균 길이</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#2d3748' }}>
                  {Math.floor(stats.avgDurationSeconds / 60)}분 {stats.avgDurationSeconds % 60}초
                </div>
              </div>
            )}
          </div>
        )}

        {/* 상단 컨트롤 바 (Sticky) */}
        <div style={{
          position: 'sticky',
          top: '0',
          background: 'white',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0',
          zIndex: 100,
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}>
          {/* 검색 + 우측 액션 툴바 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
          }}>
            {/* 좌측: 검색 입력창 (테이블/컨테이너 안에 맞게) */}
            <div style={{ flex: '1 1 260px', minWidth: 0, maxWidth: '100%' }}>
              <div style={{ position: 'relative', minWidth: 0 }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px' }}>🔍</span>
                <input
                  type="text"
                  placeholder="프로젝트 검색(제목/ID)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 16px 10px 40px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
            </div>

            {/* 우측: 정렬/필터 + 선택 및 액션 버튼 (shrink:0로 고정) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flex: '0 0 auto',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
              {/* 중앙: 정렬 및 상태 필터 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* 정렬 드롭다운 */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    padding: '10px 16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: 'white',
                    cursor: 'pointer',
                    outline: 'none',
                    minWidth: '120px'
                  }}
                >
                  <option value="createdAt-desc">최신순</option>
                  <option value="createdAt-asc">오래된순</option>
                  <option value="name-asc">이름순</option>
                  <option value="completion-desc">완성도순</option>
                </select>

                {/* 상태 필터 드롭다운 + 즐겨찾기 화면일 때 "프로젝트 목록" 바로가기 */}
                {filterStatus === 'favorites' && (
                  <button
                    type="button"
                    onClick={() => router.push('/projects?filter=active')}
                    style={{
                      padding: '10px 16px',
                      border: '1px solid #667eea',
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: 'white',
                      color: '#667eea',
                      fontWeight: '600',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    📁 프로젝트 목록
                  </button>
                )}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{
                    padding: '10px 16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: 'white',
                    cursor: 'pointer',
                    outline: 'none',
                    minWidth: '120px'
                  }}
                >
                  <option value="active">활성</option>
                  <option value="favorites">⭐ 즐겨찾기</option>
                  <option value="archived">보관됨</option>
                  <option value="all">전체</option>
                </select>
              </div>

              {/* 우측: 선택 및 액션 버튼 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {/* 전체 선택 체크박스 */}
              {projects.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#4a5568' }}>
                  <input
                    type="checkbox"
                    checked={isAllVisibleSelected}
                    onChange={toggleSelectAll}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span>전체선택</span>
                </label>
              )}

              {/* 선택된 개수 표시 */}
              {hasSelection && (
                <span style={{ fontSize: '14px', color: '#667eea', fontWeight: '600', padding: '0 8px' }}>
                  선택됨: {selectedProjectIds.size}개
                </span>
              )}

              {/* 선택 해제 버튼 */}
              <button
                onClick={handleClearSelection}
                disabled={!hasSelection}
                style={{
                  padding: '10px 16px',
                  background: hasSelection ? 'white' : '#f7fafc',
                  color: hasSelection ? '#4a5568' : '#cbd5e0',
                  border: `1px solid ${hasSelection ? '#e2e8f0' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  cursor: hasSelection ? 'pointer' : 'not-allowed',
                  fontWeight: '600',
                  fontSize: '14px',
                  transition: 'all 0.2s',
                  opacity: hasSelection ? 1 : 0.6
                }}
              >
                선택해제
              </button>

              {/* 보관/보관 해제 버튼 */}
              {filterStatus === 'archived' ? (
                <button
                  onClick={handleUnarchiveSelected}
                  disabled={!hasSelection || isUnarchiving}
                  style={{
                    padding: '10px 16px',
                    background: hasSelection && !isUnarchiving ? '#059669' : '#cbd5e0',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: (!hasSelection || isUnarchiving) ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    color: 'white',
                    fontSize: '14px',
                    transition: 'all 0.2s',
                    opacity: (!hasSelection || isUnarchiving) ? 0.6 : 1
                  }}
                >
                  {isUnarchiving ? '보관 해제 중...' : '📦 보관해제'}
                </button>
              ) : (
                <button
                  onClick={handleArchiveSelected}
                  disabled={!hasSelection || isArchiving}
                  style={{
                    padding: '10px 16px',
                    background: hasSelection && !isArchiving ? '#f59e0b' : '#cbd5e0',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: (!hasSelection || isArchiving) ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    color: 'white',
                    fontSize: '14px',
                    transition: 'all 0.2s',
                    opacity: (!hasSelection || isArchiving) ? 0.6 : 1
                  }}
                >
                  {isArchiving ? '보관 중...' : '📦 선택보관'}
                </button>
              )}

              {/* 삭제 버튼 (보관과 함께 제공) */}
              {filterStatus !== 'archived' && (
                <button
                  onClick={handleDeleteSelected}
                  disabled={!hasSelection || isDeleting}
                  style={{
                    padding: '10px 16px',
                    background: hasSelection && !isDeleting ? '#e53e3e' : '#cbd5e0',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: (!hasSelection || isDeleting) ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    color: 'white',
                    fontSize: '14px',
                    transition: 'all 0.2s',
                    opacity: (!hasSelection || isDeleting) ? 0.6 : 1
                  }}
                >
                  {isDeleting ? '삭제 중...' : '🗑️ 선택삭제'}
                </button>
              )}

              {/* 프로젝트 추가 버튼 */}
              <button
                onClick={handleCreateProject}
                style={{
                  padding: '10px 20px',
                  background: '#667eea',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  color: 'white',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
              >
                + 프로젝트 추가
              </button>
              {/* 3. 대본생성부터 시작 (직접 작성/타겟팅 대본용) */}
              <button
                onClick={handleStartFromScriptGeneration}
                disabled={creatingDirectScript}
                style={{
                  padding: '10px 20px',
                  background: creatingDirectScript ? '#cbd5e0' : 'white',
                  border: `2px solid ${creatingDirectScript ? '#e2e8f0' : '#667eea'}`,
                  borderRadius: '8px',
                  cursor: creatingDirectScript ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  color: creatingDirectScript ? '#718096' : '#667eea',
                  fontSize: '14px',
                  transition: 'all 0.2s',
                  opacity: creatingDirectScript ? 0.6 : 1
                }}
                title="직접 작성한 대본이나 타겟팅한 대본이 있으면 3. 대본생성부터 입력할 수 있습니다"
              >
                {creatingDirectScript ? '⏳ 생성 중...' : '✍️ 대본생성부터 시작'}
              </button>
              </div>
            </div>
          </div>
        </div>

        {/* 프로젝트 개수 표시 */}
        <div style={{ marginBottom: '16px', fontSize: '14px', color: '#718096' }}>
          {loading ? (
            <span>로딩 중...</span>
          ) : (
            <span>
              전체 {allProjects.length}개
              {(searchQuery || filterStatus !== 'all') && ` • 표시 ${projects.length}개`}
            </span>
          )}
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#718096', padding: '48px' }}>로딩 중...</p>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <p style={{ color: '#718096', marginBottom: '20px' }}>
              {filterStatus === 'favorites'
                ? '즐겨찾기한 프로젝트가 없습니다. 카드의 ⭐을 눌러 추가해보세요.'
                : '프로젝트가 없습니다.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              {filterStatus === 'favorites' && (
                <button
                  type="button"
                  onClick={() => router.push('/projects?filter=active')}
                  style={{
                    padding: '12px 24px',
                    background: 'white',
                    border: '2px solid #667eea',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    color: '#667eea',
                    fontSize: '14px'
                  }}
                >
                  📁 프로젝트 목록
                </button>
              )}
              <button
                onClick={handleCreateProject}
                style={{
                  padding: '12px 24px',
                  background: '#667eea',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  color: 'white',
                  fontSize: '14px'
                }}
              >
                + 첫 프로젝트 생성
              </button>
              <button
                onClick={handleStartFromScriptGeneration}
                disabled={creatingDirectScript}
                style={{
                  padding: '12px 24px',
                  background: creatingDirectScript ? '#cbd5e0' : 'white',
                  border: `2px solid ${creatingDirectScript ? '#e2e8f0' : '#667eea'}`,
                  borderRadius: '8px',
                  cursor: creatingDirectScript ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  color: creatingDirectScript ? '#718096' : '#667eea',
                  fontSize: '14px'
                }}
                title="직접 작성한 대본이 있으면 3. 대본생성부터 입력"
              >
                {creatingDirectScript ? '⏳ 생성 중...' : '✍️ 대본생성부터 시작'}
              </button>
            </div>
          </div>
        ) : (
            <>
              {/* 즐겨찾기 섹션 */}
              {showPinned && (
                <div style={{ marginBottom: '32px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#2d3748', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ⭐ 즐겨찾기 ({pinned.length})
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {pinned.map((project) => (
                      <Fragment key={project.id}>{renderProjectCard(project)}</Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* 최근 열람 섹션 */}
              {showRecent && (
                <div style={{ marginBottom: '32px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#2d3748', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🕒 최근 열람 ({recent.length})
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {recent.map((project) => (
                      <Fragment key={project.id}>{renderProjectCard(project)}</Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* 전체 프로젝트 목록 섹션 */}
              {(regular.length > 0 || (!showPinned && !showRecent)) && (
                <div>
                  {(showPinned || showRecent) && (
                    <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#2d3748', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {filterStatus === 'archived' ? '📦 보관된 프로젝트' : '📁 프로젝트'} ({regular.length > 0 ? regular.length : projects.length})
                    </h2>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {(regular.length > 0 ? regular : projects).map((project) => (
                      <Fragment key={project.id}>{renderProjectCard(project)}</Fragment>
                    ))}
                  </div>
                </div>
              )}
            </>
        )}
      </div>
    </StudioLayout>
  );
}
