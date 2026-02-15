/**
 * API 서버 베이스 URL. 현재 호스트 기반으로 자동 감지 (포트 4000).
 * 무조건 window.location을 기반으로 동작하여 LAN 접속 시 자동으로 올바른 IP 사용.
 */
function getApiBase() {
  if (typeof window !== 'undefined') {
    // 무조건 현재 호스트 기반으로 생성 (window.__API_BASE__ 무시)
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // localhost/127.0.0.1이면 그대로 localhost:4000 사용
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const apiBase = 'http://localhost:5000';
      console.log('[getApiBase] localhost 감지:', apiBase, '(현재 위치:', window.location.href + ')');
      return apiBase;
    }

    // LAN IP나 다른 호스트인 경우 현재 호스트의 포트만 5000으로 변경
    const apiBase = `${protocol}//${hostname}:5000`;
    console.log('[getApiBase] 호스트 기반 자동 감지:', apiBase, '(현재 위치:', window.location.href + ', window.__API_BASE__ 무시)');
    return apiBase;
  }
  // SSR 환경
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
}

module.exports = { getApiBase };
