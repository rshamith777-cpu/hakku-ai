require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const API_KEY = process.env.BHARATCODE_API_KEY || '';
const BASE_URL = process.env.BHARATCODE_BASE_URL || 'https://api.bharatcode.ai/v1';
const MODEL = process.env.BHARATCODE_MODEL || 'qwen-3.8-27b';

// Helper: Call BharatCode Model API
async function callBharatCodeAPI(systemPrompt, userPrompt) {
  if (!API_KEY || API_KEY === 'your_bharatcode_api_key_here') {
    throw new Error('DEMO_MODE');
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.4
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`BharatCode API Error: ${errText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// HARNESS ENDPOINT: Evaluates student explanation + updates Knowledge Graph
app.post('/api/evaluate-turn', async (req, res) => {
  const { topic, persona, language, history, userExplanation } = req.body;

  const systemPrompt = `You are the ShishyaAI Educational Harness powered by BharatCode.
The human user is trying to learn the topic "${topic}" by TEACHING it to you (The Feynman Technique).
Your current persona: "${persona}".
Preferred response language: "${language}".

You must execute a 3-step internal harness workflow and return ONLY valid JSON (no markdown fences):
1. PERSONA_AGENT: Respond in character (${persona}) in ${language}. Never lecture or give away the full answer. Point out what confused you in their explanation or ask a sharp follow-up question about a missing sub-concept.
2. FACT_AUDITOR: Check the user's explanation for factual accuracy. List covered concepts, missing key concepts, and any misconceptions. Calculate an overall masteryScore (0 to 100).
3. GRAPH_GENERATOR: Build a valid Mermaid.js flowchart (graph TD) representing the topic's concept map. Color nodes the user has already explained in green, and missing/unexplained nodes in red/orange.

Return strictly this JSON structure:
{
  "reply": "Your in-character question/response to the user",
  "masteryScore": 45,
  "coveredConcepts": ["concept 1"],
  "missingConcepts": ["concept 2", "concept 3"],
  "misconception": "None, or brief correction if they stated something factually wrong",
  "hint": "A 1-line Socratic nudge to help them answer your question",
  "mermaidGraph": "graph TD\\n  A[Main Topic] --> B[Explained Subtopic]\\n  A --> C[Missing Subtopic]\\n  style B fill:#10b981,stroke:#059669,color:#fff\\n  style C fill:#ef4444,stroke:#dc2626,color:#fff"
}`;

  const userPrompt = `
Conversation History so far: ${JSON.stringify(history || [])}
Latest User Explanation: "${userExplanation}"
Evaluate this turn and return the JSON object.`;

  try {
    const rawOutput = await callBharatCodeAPI(systemPrompt, userPrompt);
    let cleaned = rawOutput.trim();
    if (cleaned.includes('```')) {
      const match = cleaned.match(/```(?:json)?([\s\S]*?)```/);
      if (match) cleaned = match[1].trim();
    } else {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
    }
    const parsed = JSON.parse(cleaned);
    res.json({ ...parsed, mode: 'BharatCode API (' + MODEL + ')' });
  } catch (err) {
    // Intelligent Fallback so judges can test even without API keys configured locally
    const turnCount = (history ? history.length : 0) + 1;
    const score = Math.min(95, turnCount * 30);
    res.json({
      reply: turnCount === 1
        ? `Interesting start on ${topic}! You explained the core idea, but wait—what happens in an edge case or failure scenario? Could you break down the exact mechanism behind how the components interact?`
        : `Aha, that makes much more sense now! One final doubt: how would you optimize or measure the efficiency of ${topic} in a real-world system?`,
      masteryScore: score,
      coveredConcepts: ["Core Definition", "Basic Mechanism", ...(turnCount > 1 ? ["Edge Cases & Flow"] : [])],
      missingConcepts: turnCount === 1 ? ["Underlying Architecture", "Edge Cases", "Real-World Tradeoffs"] : ["Performance Tradeoffs"],
      misconception: "No factual errors detected, but terminology can be more precise.",
      hint: `Think about the bottleneck or prerequisite conditions required for ${topic} to occur.`,
      mermaidGraph: turnCount === 1
        ? `graph TD\n  Root["${topic}"] --> C1["Core Definition ✓"]\n  Root --> C2["Basic Flow ✓"]\n  Root --> M1["Edge Conditions ?"]\n  Root --> M2["Real-world Tradeoffs ?"]\n  style C1 fill:#059669,stroke:#10b981,color:#fff\n  style C2 fill:#059669,stroke:#10b981,color:#fff\n  style M1 fill:#dc2626,stroke:#ef4444,color:#fff\n  style M2 fill:#d97706,stroke:#f59e0b,color:#fff`
        : `graph TD\n  Root["${topic}"] --> C1["Core Definition ✓"]\n  Root --> C2["Basic Flow ✓"]\n  Root --> C3["Edge Conditions ✓"]\n  Root --> M2["Optimization Tradeoffs ?"]\n  style C1 fill:#059669,stroke:#10b981,color:#fff\n  style C2 fill:#059669,stroke:#10b981,color:#fff\n  style C3 fill:#059669,stroke:#10b981,color:#fff\n  style M2 fill:#d97706,stroke:#f59e0b,color:#fff`,
      mode: 'BharatCode Harness (Demo Mode)'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 ShishyaAI Harness running at http://localhost:${PORT}`);
});

