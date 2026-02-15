// web-ui/pages/api/translate.js
import OpenAI from 'openai';

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

export default async function handler(req, res) {
    // Add Cache-Control headers to response
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { text, runId } = req.body;
    if (!text) {
        return res.status(400).json({ error: 'No text provided' });
    }

    // 1. 키 목록 파싱
    const keysEnv = process.env.OPENAI_API_KEYS || process.env.OPENAI_API_KEY || '';
    const apiKeys = keysEnv.split(',').map(k => k.trim()).filter(k => k.length > 0);

    if (apiKeys.length === 0) {
        console.error('SERVER LOG: No OpenAI API keys found in environment variables.');
        return res.status(500).json({ error: 'Server configuration error: No API keys' });
    }

    let lastError = null;

    // 2. 키 순회 및 폴백 로직
    for (const apiKey of apiKeys) {
        try {
            const client = new OpenAI({ apiKey: apiKey });

            const response = await client.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { "role": "system", "content": `You are a professional translator. runId=${runId}. Translate the following Korean text into natural, descriptive English. Do not add any explanations, notes, or extra formatting. Just return the translated text.` },
                    { "role": "user", "content": text }
                ],
                temperature: 0.8, // Increased for variety
                max_tokens: 500
            });

            const translatedText = response.choices[0].message.content.trim();
            return res.status(200).json({ translated: translatedText });

        } catch (error) {
            lastError = error;
            const status = error.status || 500;

            // 로깅 (키는 출력하지 않음)
            console.error(`SERVER LOG: Translation failed with status ${status}. Error: ${error.message}`);

            // 즉시 중단해야 하는 에러 (키를 바꿔도 소용없는 경우)
            if (status === 400 || status === 403 || status === 404) {
                return res.status(status).json({ error: error.message });
            }

            // 401, 429, 5xx 등은 다음 키로 시도
            continue;
        }
    }

    // 모든 키 실패 시
    return res.status(500).json({
        error: 'All API keys failed',
        details: lastError ? lastError.message : 'Unknown error'
    });
}
