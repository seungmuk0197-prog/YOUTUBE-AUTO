/**
 * LLM API 통합 유틸리티
 * OpenAI와 Gemini 지원, 여러 API 키 자동 폴백
 */

/** API 키 배열 반환 (쉼표 구분 문자열 파싱) */
export function getOpenAIKeys(): string[] {
  // .env.local이 우선, 없으면 .env (단, .env에서 주석처리 했으므로 .env.local만 유효할 것)
  const keysString = process.env.OPENAI_API_KEYS || process.env.OPENAI_API_KEY || '';

  const parsedKeys = keysString.split(',')
    .map(k => k.trim())
    // "sk-" 또는 "sk-proj-"로 시작하는 키만 필터링 (기본적인 포맷 검증)
    .filter(k => k.length > 0 && (k.startsWith('sk-') || k.startsWith('sk-proj-')));

  // 보안 로그: 키 존재 여부만 출력
  console.log(`[LLM] OPENAI_API_KEY set: ${Boolean(parsedKeys.length > 0)}`);
  console.log(`[LLM] OPENAI_API_KEYS count: ${parsedKeys.length}`);

  return parsedKeys;
}

export function getGeminiKeys(): string[] {
  const keys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  return keys.split(',').map(k => k.trim()).filter(k => k.length > 0);
}

/** OpenAI API 호출 (폴백 지원) */
export async function callOpenAIWithFallback(
  prompt: string,
  model?: string
): Promise<string> {
  const keys = getOpenAIKeys();
  if (keys.length === 0) {
    throw new Error('No OpenAI API keys configured');
  }

  const targetModel = model || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  // 동적 import로 OpenAI SDK 로드 (default export class)
  const { default: OpenAI } = await import('openai');

  let lastError: Error | null = null;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const openai = new OpenAI({ apiKey: key });
      const response = await openai.chat.completions.create({
        model: targetModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
      });

      const text = response.choices[0]?.message?.content?.trim();
      if (!text) {
        throw new Error('Empty response from OpenAI');
      }

      return text;
    } catch (error) {
      const err = error as any;
      const status = err?.status || err?.response?.status || 0;
      const statusCode = typeof status === 'number' ? status : parseInt(status) || 0;

      // 400, 403, 404는 즉시 중단 (Bad Request, Forbidden, Not Found)
      if (statusCode === 400 || statusCode === 403 || statusCode === 404) {
        throw new Error(`OpenAI API error (${statusCode}): ${err?.message || 'Bad request'}`);
      }

      // 401 (Unauthorized) - 키 오류
      if (statusCode === 401) {
        console.warn(`[LLM] OpenAI key ${i + 1}/${keys.length} failed (401 Unauthorized).`);

        // 마지막 키였다면 401 에러를 그대로 throw해서 상위에서 캐치 가능하게 함
        if (i === keys.length - 1) {
          throw new Error('401 Unauthorized: Verify your API key.');
        }

        // 다음 키 시도
        lastError = new Error('401 Unauthorized');
        continue;
      }

      // 429, 5xx는 다음 키로 폴백
      if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
        console.log(`[LLM] OpenAI key ${i + 1}/${keys.length} failed (${statusCode}), trying next...`);
        lastError = err;
        continue;
      }

      // 네트워크 에러 등도 다음 키로 폴백
      if (!statusCode || statusCode === 0) {
        console.log(`[LLM] OpenAI key ${i + 1}/${keys.length} network error, trying next...`);
        lastError = err;
        continue;
      }

      // 알 수 없는 에러는 그대로 throw
      throw err;
    }
  }

  // 모든 키 실패
  if (lastError?.message?.includes('401')) {
    throw new Error('401 Unauthorized: All API keys expired or invalid.');
  }
  throw lastError || new Error('All OpenAI API keys failed');
}

/** Gemini API 호출 (폴백 지원) */
export async function callGeminiWithFallback(
  prompt: string,
  model?: string
): Promise<string> {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    throw new Error('No Gemini API keys configured');
  }

  const targetModel = model || process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  let lastError: Error | null = null;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      // Gemini API 엔드포인트 (v1beta 사용)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${key}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.8,
          },
        }),
      });

      const status = response.status;

      // 400, 403, 404는 즉시 중단
      if (status === 400 || status === 403 || status === 404) {
        const errorText = await response.text().catch(() => 'Bad request');
        throw new Error(`Gemini API error (${status}): ${errorText}`);
      }

      // 401, 429, 5xx는 다음 키로 폴백
      if (status === 401 || status === 429 || (status >= 500 && status < 600)) {
        console.log(`Gemini key ${i + 1}/${keys.length} failed (${status}), trying next...`);
        lastError = new Error(`Gemini API error (${status})`);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Gemini API error (${status})`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!text) {
        throw new Error('Empty response from Gemini');
      }

      return text;
    } catch (error) {
      const err = error as any;
      // 네트워크 에러 등은 다음 키로 폴백
      if (err?.message?.includes('fetch') || !err?.status) {
        console.log(`Gemini key ${i + 1}/${keys.length} network error, trying next...`);
        lastError = err;
        continue;
      }

      // 이미 처리한 에러는 재throw하지 않음
      if (err?.message?.includes('Gemini API error')) {
        lastError = err;
        continue;
      }

      // 알 수 없는 에러는 그대로 throw
      throw err;
    }
  }

  // 모든 키 실패
  throw lastError || new Error('All Gemini API keys failed');
}

/** LLM_PROVIDER 기준으로 자동 선택하여 호출 */
export async function callLLM(
  prompt: string,
  model?: string
): Promise<string> {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
  const providerModel = model ||
    (provider === 'gemini'
      ? (process.env.GEMINI_MODEL || 'gemini-1.5-flash')
      : (process.env.OPENAI_MODEL || 'gpt-4o-mini'));

  console.log(`Provider: ${provider}`);
  console.log(`Model: ${providerModel}`);

  if (provider === 'gemini') {
    return callGeminiWithFallback(prompt, providerModel);
  } else {
    return callOpenAIWithFallback(prompt, providerModel);
  }
}
