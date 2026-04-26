export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { systemPrompt, history, userMessage } = req.body;
        const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY;

        if (!DEEPSEEK_KEY) {
            throw new Error('DeepSeek API key not configured');
        }
        
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: userMessage }
        ];

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                max_tokens: 200,
                temperature: 0.88,
                messages: messages
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `DeepSeek API error (${response.status})`);
        }

        const data = await response.json();
        const reply = data?.choices?.[0]?.message?.content?.trim();

        if (!reply || reply.length < 3) {
            throw new Error('Empty or too short reply from DeepSeek');
        }

        console.log('✅ DeepSeek replied successfully');
        return res.status(200).json({ success: true, reply, source: 'deepseek' });
        
    } catch (error) {
        console.error('❌ DeepSeek error:', error.message);
        return res.status(200).json({ success: false, error: error.message });
    }
}
