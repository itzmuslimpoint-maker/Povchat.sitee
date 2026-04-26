// api/chat.js — Vercel Serverless Function
// This hides your Gemini API key from the frontend

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { systemPrompt, history, userMessage } = req.body;

  if (!userMessage) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Get API key from environment variable (hidden from frontend!)
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('GEMINI_API_KEY not set in environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Build conversation context
  const conversationContext = (history || [])
    .map(h => `${h.role === 'user' ? 'User' : 'Character'}: ${h.content}`)
    .join('\n');

  const fullPrompt = `${systemPrompt || 'You are a helpful AI assistant.'}

Conversation history:
${conversationContext}

User: ${userMessage}
Character:`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: fullPrompt }]
          }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 300,
            topK: 40,
            topP: 0.95
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API Error:', response.status, errorData);
      
      if (response.status === 400) return res.status(502).json({ error: 'Bad request to AI service' });
      if (response.status === 403) return res.status(502).json({ error: 'AI API key invalid or expired' });
      if (response.status === 429) return res.status(502).json({ error: 'AI rate limit exceeded' });
      if (response.status >= 500) return res.status(502).json({ error: 'AI service temporarily down' });
      
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await response.json();

    // Check for blocked content
    if (data.promptFeedback?.blockReason) {
      return res.status(200).json({ 
        reply: "I'm not sure how to respond to that... can we talk about something else? 😅",
        source: 'filtered',
        blocked: true 
      });
    }

    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      const reply = data.candidates[0].content.parts[0].text
        .trim()
        .replace(/^Character:/i, '');
      
      return res.status(200).json({ reply, source: 'gemini' });
    }

    throw new Error('Empty response from AI');

  } catch (error) {
    console.error('Proxy error:', error.message);
    return res.status(200).json({ 
      reply: null, 
      error: 'AI service unavailable', 
      source: 'error' 
    });
  }
}

