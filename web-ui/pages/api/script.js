import { callLLM } from '../../lib/llm';

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

    const { prompt, runId } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'No prompt provided' });
    }

    // Log the runId for debugging
    console.log(`SERVER LOG: Script generation request received. runId: ${runId}`);

    try {
        // 시스템 프롬프트 추가
        const systemPrompt = `You are a professional YouTube Shorts script writer. runId=${runId}. Do NOT output the runId.`;
        const fullPrompt = `${systemPrompt}\n\nUser request: ${prompt}`;

        // LLM 호출 (자동 폴백 지원)
        const script = await callLLM(fullPrompt);

        console.log(`SERVER LOG: Script generated successfully. runId: ${runId}`);
        return res.status(200).json({ script: script });

    } catch (error) {
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        console.error(`SERVER LOG: Script generation failed. Error: ${errorMessage}`);

        // 401 에러 전파 (클라이언트에서 인지 가능하도록)
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
            return res.status(401).json({
                error: 'Unauthorized (Incorrect API Key)',
                details: errorMessage
            });
        }

        return res.status(500).json({
            error: 'All API keys failed',
            details: errorMessage
        });
    }
}
