/**
 * 프로젝트 제목 표시 유틸리티
 * 단일 진실 소스: project.json의 title 필드만 사용
 */

/**
 * 프로젝트의 표시 제목을 반환 (단일 진실 소스)
 * @param {Object} project - 프로젝트 객체
 * @returns {string} 표시할 제목
 */
export function getDisplayTitle(project) {
  if (!project) {
    return '새로운 프로젝트';
  }
  
  // title/topic/name 필드 중 유효한 것 사용
  const t = (project.title ?? project.topic ?? project.name ?? '').trim();
  if (t.length > 0) {
    return t;
  }
  
  // title이 없을 때만 기본값 표시 (projectId 마지막 4자 포함)
  // 임시명(finance 등)은 절대 표시하지 않음
  const projectId = project.id || '';
  if (projectId.length >= 4) {
    return `새로운 프로젝트 (${projectId.slice(-4)})`;
  }
  return '새로운 프로젝트';
}
