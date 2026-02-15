/**
 * 빌드 시 NEXT_PUBLIC_API_BASE_URL을 public/api-base.js에 주입.
 * 정적 HTML에서 window.__API_BASE__로 server URL 사용.
 */
const path = require('path');
const fs = require('fs');

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
const outPath = path.join(__dirname, '..', 'public', 'api-base.js');
const content = `// API 서버 베이스. 빌드 시 NEXT_PUBLIC_API_BASE_URL 주입.
window.__API_BASE__ = window.__API_BASE__ || ${JSON.stringify(baseUrl)};
`;

fs.writeFileSync(outPath, content, 'utf8');
console.log('[inject-api-base]', outPath, '->', baseUrl);
