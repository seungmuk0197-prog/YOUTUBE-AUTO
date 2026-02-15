/**
 * Format a date string safely for Korean locale
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

/**
 * Format seconds to mm:ss display
 * @param {number} sec
 * @returns {string}
 */
export function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Extract project display data from API response.
 * The API wraps data as { ok: true, project: {...} } or returns flat object.
 * @param {object} data - API response
 * @returns {object} project object
 */
export function unwrapProject(data) {
  if (!data) return null;
  // If wrapped: { ok: true, project: {...} }
  if (data.project && typeof data.project === 'object') return data.project;
  // If flat project object with id
  if (data.id) return data;
  return data;
}

/**
 * Get project name from project object (handles topic/name aliases)
 * @param {object} project
 * @returns {string}
 */
export function getProjectName(project) {
  if (!project) return 'Untitled';
  return project.name || project.topic || 'Untitled';
}
