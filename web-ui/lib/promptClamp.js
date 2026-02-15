/**
 * promptClamp.js - 이미지 생성 프롬프트 강제 클램프 + 디버그 로깅
 * "Prompt is too long" 에러 방지용
 */

const MAX_PROMPT_LENGTH = 900;

/**
 * 프롬프트를 안전한 길이로 클램프
 * @param {string} rawPrompt - 원본 프롬프트
 * @param {string} fallbackText - 프롬프트가 비어있을 때 대체 텍스트
 * @returns {string} 클램프된 프롬프트
 */
export function clampPrompt(rawPrompt, fallbackText = "") {
  let p = String(rawPrompt ?? "").trim();

  // 공백/줄바꿈 정리
  p = p.replace(/\r?\n/g, " ");
  p = p.replace(/\s+/g, " ");

  // 반복 수식어 제거 (프롬프트에 중복으로 들어가는 문구들)
  const redundant = [
    "professional photography",
    "high quality",
    "vibrant colors",
    "well-lit",
    "sharp focus",
    "detailed",
    "clean composition",
    "modern aesthetic",
    "engaging visual",
    "16:9 aspect ratio",
  ];
  for (const phrase of redundant) {
    // 첫 번째 등장만 남기고 나머지 제거
    let found = false;
    p = p.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi"), (match) => {
      if (!found) { found = true; return match; }
      return "";
    });
  }

  // 연속 콤마/공백 정리
  p = p.replace(/\s+/g, " ").replace(/,\s*,+/g, ",").trim();
  p = p.replace(/^,|,$/g, "").trim();

  // 비면 fallback
  if (!p) p = `simple scene: ${String(fallbackText || "").slice(0, 60)}`.trim();

  // 최종 자르기
  if (p.length > MAX_PROMPT_LENGTH) p = p.slice(0, MAX_PROMPT_LENGTH);
  return p;
}

/**
 * 이미지 생성 요청 전 프롬프트 클램프 + 콘솔 로그
 * @param {string} rawPrompt - 원본 프롬프트
 * @param {string} sceneId - 씬/캐릭터 ID
 * @param {string} fallbackText - 대체 텍스트
 * @returns {string} 전송할 프롬프트
 */
export function clampAndLogPrompt(rawPrompt, sceneId, fallbackText = "") {
  const raw = rawPrompt;
  const sendPrompt = clampPrompt(raw, fallbackText);

  console.log("[PROMPT_DEBUG]", {
    sceneId,
    rawLen: (raw || "").length,
    sendLen: sendPrompt.length,
    rawHead: (raw || "").slice(0, 120),
    rawTail: (raw || "").slice(-120),
    send: sendPrompt,
  });

  return sendPrompt;
}
