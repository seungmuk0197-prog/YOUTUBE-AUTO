import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM } from '../../lib/llm';

/**
 * LLM 텍스트 생성 API
 * POST /api/generate
 * Body: { prompt: string, runId: string }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // POST만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, runId } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required' });
    }

    // runId 로깅 (디버그용)
    console.log(`[generate] runId: ${runId || 'none'}, prompt length: ${prompt.length}`);

    // LLM 호출
    const text = await callLLM(prompt);

    // 캐시 방지 헤더 설정
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).json({ text });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[generate] Error:', errorMessage);
    return res.status(500).json({ 
      error: errorMessage || 'Internal server error' 
    });
  }
}
