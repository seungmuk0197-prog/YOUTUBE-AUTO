/**
 * 프로젝트별 localStorage 네임스페이스 관리
 * projectId 기준으로 데이터를 분리하여 저장/로드
 */

/**
 * 프로젝트별 localStorage 키 생성
 */
function getProjectKey(projectId, key) {
  if (!projectId) {
    console.warn('projectId가 없습니다. 전역 키를 사용합니다:', key);
    return key;
  }
  return `project:${projectId}:${key}`;
}

/**
 * 프로젝트 데이터 저장
 */
export function saveProjectData(projectId, key, value) {
  const storageKey = getProjectKey(projectId, key);
  try {
    if (typeof value === 'string') {
      localStorage.setItem(storageKey, value);
    } else {
      localStorage.setItem(storageKey, JSON.stringify(value));
    }
  } catch (error) {
    console.error(`Failed to save ${storageKey}:`, error);
  }
}

/**
 * 프로젝트 데이터 로드
 */
export function loadProjectData(projectId, key, defaultValue = null) {
  const storageKey = getProjectKey(projectId, key);
  try {
    const value = localStorage.getItem(storageKey);
    if (value === null) return defaultValue;
    
    // JSON 파싱 시도
    try {
      return JSON.parse(value);
    } catch {
      // JSON이 아니면 문자열 그대로 반환
      return value;
    }
  } catch (error) {
    console.error(`Failed to load ${storageKey}:`, error);
    return defaultValue;
  }
}

/**
 * 프로젝트 데이터 삭제
 */
export function removeProjectData(projectId, key) {
  const storageKey = getProjectKey(projectId, key);
  try {
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error(`Failed to remove ${storageKey}:`, error);
  }
}

/**
 * 프로젝트의 모든 데이터 삭제
 */
export function clearProjectData(projectId) {
  if (!projectId) return;
  
  const prefix = `project:${projectId}:`;
  const keysToRemove = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove ${key}:`, error);
    }
  });
}

/**
 * 프로젝트 데이터 마이그레이션 (기존 전역 키 → 프로젝트별 키)
 * 기존 localStorage 데이터를 프로젝트별로 복사
 */
export function migrateProjectData(projectId, globalKeys = []) {
  if (!projectId) return;

  const migrations = [];

  globalKeys.forEach(key => {
    const globalValue = localStorage.getItem(key);
    if (globalValue !== null) {
      const projectKey = getProjectKey(projectId, key);
      try {
        // 프로젝트 키가 아직 없을 때만 복사 (기존 데이터 보호)
        if (localStorage.getItem(projectKey) === null) {
          localStorage.setItem(projectKey, globalValue);
          migrations.push({ from: key, to: projectKey });
        }
        // 전역 키 삭제 (데이터 오염 방지 - 다음 프로젝트에 같은 데이터 복사 방지)
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Failed to migrate ${key} to ${projectKey}:`, error);
      }
    }
  });

  if (migrations.length > 0) {
    console.log(`Migrated ${migrations.length} items for project ${projectId}:`, migrations);
  }

  return migrations;
}

/**
 * 주요 프로젝트 데이터 키 상수
 */
export const PROJECT_DATA_KEYS = {
  BLUEPRINT: 'step2Blueprint',
  SCRIPT: 'generatedScript',
  SCENES: 'scenes',
  CHARACTERS: 'characters',
  SCRIPT_HASH: 'scriptHash',
  GENERATED_IMAGES: 'generatedImages',
  GENERATED_CHARACTER_IMAGES: 'generatedCharacterImages',
  PROJECT_DATA: 'projectData',
};
