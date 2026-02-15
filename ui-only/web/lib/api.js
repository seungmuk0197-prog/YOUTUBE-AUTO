/**
 * API fetch wrapper for Flask backend
 * All requests go through /api (same-origin) which proxies to http://localhost:5000/api
 */

/**
 * Fetch from same-origin /api endpoint
 * @param {string} path - API path without leading slash (e.g., "projects", "projects/123")
 * @param {object} options - fetch options (method, body, headers, etc.)
 * @returns {Promise<object>} Parsed JSON response
 */
export async function apiFetch(path, options = {}) {
  const url = `/api/${path}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      let errorMsg = `${response.status} ${response.statusText}`;
      try {
        const errBody = await response.json();
        if (errBody.error) errorMsg = errBody.error;
      } catch (_) {}
      const error = new Error(errorMsg);
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`[apiFetch] ${path}:`, error.message);
    throw error;
  }
}

/** GET request */
export function apiGet(path) {
  return apiFetch(path, { method: 'GET' });
}

/** POST request with JSON body */
export function apiPost(path, data = {}) {
  return apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** PUT request with JSON body */
export function apiPut(path, data = {}) {
  return apiFetch(path, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** PATCH request with JSON body */
export function apiPatch(path, data = {}) {
  return apiFetch(path, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** DELETE request */
export function apiDelete(path) {
  return apiFetch(path, { method: 'DELETE' });
}

/** POST request with FormData (for file uploads) */
export async function apiPostFormData(path, formData) {
  const url = `/api/${path}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - browser will set it with boundary
    });

    if (!response.ok) {
      let errorMsg = `${response.status} ${response.statusText}`;
      try {
        const errBody = await response.json();
        if (errBody.error) errorMsg = errBody.error;
      } catch (_) {}
      const error = new Error(errorMsg);
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`[apiPostFormData] ${path}:`, error.message);
    throw error;
  }
}

/**
 * Build preview URL for project file (inline)
 * @param {string} projectId
 * @param {string} relativePath - e.g. "assets/audio/scene1.mp3"
 * @returns {string}
 */
export function previewUrl(projectId, relativePath) {
  if (!relativePath) return '';
  return `/api/projects/${projectId}/preview?path=${encodeURIComponent(relativePath)}&v=${Date.now()}`;
}

/**
 * Build download URL for project file (attachment)
 * @param {string} projectId
 * @param {string} relativePath
 * @returns {string}
 */
export function downloadUrl(projectId, relativePath) {
  if (!relativePath) return '';
  return `/api/projects/${projectId}/download?path=${encodeURIComponent(relativePath)}`;
}
