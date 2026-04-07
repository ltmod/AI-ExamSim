require('dotenv').config();

const express = require('express');
const Anthropic = require('@anthropic-ai/sdk').default;
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const QUESTIONS_DIR = path.join(__dirname, 'questions');

app.get('/api/question-banks', (req, res) => {
  try {
    const files = fs.readdirSync(QUESTIONS_DIR).filter((f) => f.endsWith('.js'));
    const banks = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(QUESTIONS_DIR, file), 'utf-8');
      try {
        const fn = new Function(content + '\nreturn QUESTIONS_DATA;');
        const data = fn();
        if (data?.meta?.title) {
          banks.push({
            filename: file,
            title: data.meta.title,
            questionCount: data.questions?.length ?? 0,
          });
        }
      } catch (_) {
        // skip files that don't export valid QUESTIONS_DATA
      }
    }

    res.json(banks);
  } catch (err) {
    console.error('Error scanning question banks:', err.message);
    res.status(500).json({ error: 'Failed to scan question banks' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { messages, systemPrompt } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt || '',
      messages,
    });

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`);
    });

    stream.on('end', () => {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    });

    stream.on('error', (err) => {
      console.error('Anthropic stream error:', err.message);
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      res.end();
    });
  } catch (err) {
    console.error('Chat endpoint error:', err.message);
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    res.end();
  }
});

// Cap payload size: client also limits; this is defense in depth (see app.js MAX_REPORT_ITEMS).
const MAX_SESSION_REPORT_ITEMS = 80;
const MAX_SESSION_Q_STEM = 2500;
const MAX_SESSION_OPTION = 500;
const MAX_SESSION_AI_TURN = 4000;

function trimSessionReportItems(items) {
  return items.slice(0, MAX_SESSION_REPORT_ITEMS).map((it) => {
    const q = it.question && it.question.length > MAX_SESSION_Q_STEM
      ? it.question.slice(0, MAX_SESSION_Q_STEM) + '\n[truncated]'
      : it.question;
    const options = {};
    if (it.options && typeof it.options === 'object') {
      ['A', 'B', 'C', 'D'].forEach((l) => {
        const o = it.options[l];
        if (typeof o === 'string') {
          options[l] =
            o.length > MAX_SESSION_OPTION ? o.slice(0, MAX_SESSION_OPTION) + '…' : o;
        }
      });
    }
    let aiMessages = Array.isArray(it.aiMessages) ? it.aiMessages : [];
    aiMessages = aiMessages.map((m) => {
      if (!m || (m.role !== 'user' && m.role !== 'assistant')) return null;
      const c =
        typeof m.content === 'string' && m.content.length > MAX_SESSION_AI_TURN
          ? m.content.slice(0, MAX_SESSION_AI_TURN) + '\n[truncated]'
          : m.content;
      return { role: m.role, content: c };
    }).filter(Boolean);
    return { ...it, question: q, options, aiMessages };
  });
}

app.post('/api/generate-session-report', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error:
        'Anthropic API key not configured. Set ANTHROPIC_API_KEY in .env to generate session reports.',
    });
  }

  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { bankTitle, generatedAt, progress, items, truncatedNote } = body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required and must not be empty' });
  }

  const trimmedItems = trimSessionReportItems(items);
  const payloadForModel = {
    bankTitle: bankTitle || 'Quiz',
    generatedAt: generatedAt || new Date().toISOString(),
    progress: progress || {},
    truncatedNote: truncatedNote || null,
    items: trimmedItems,
  };

  const systemPrompt = [
    'You write concise, accurate study summaries in Markdown based only on the JSON the user sends.',
    'The student practiced multiple-choice questions (certification-style). The JSON includes per-question stems, options, correctness, justifications, and optional aiMessages from a prior tutor chat.',
    'If aiMessages is empty for a question, infer concepts only from the question text and justifications.',
    'Do not invent exam details that are not supported by the payload.',
    '',
    'Output Markdown with exactly these top-level sections (use ## headings):',
    '## Session overview',
    'Brief bullets: bank name, date from payload, how many questions in this run, correct vs incorrect if provided, domain filter, whether review mode.',
    '## Concepts and items learned',
    'Bullet list of concrete concepts or skills the student engaged with, grounded in the questions.',
    '## Key takeaways',
    'Short numbered or bulleted list of the most important ideas to remember.',
    '## Further study',
    '5–10 specific recommendations: books, articles, official standards or docs, or reputable courses. Each item: title or name, optional author/org, and one sentence on why it helps for this material.',
    '',
    'Start with a single # title line including the bank title and the word "Session report".',
    'Use clear, accessible language.',
  ].join('\n');

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(payloadForModel),
        },
      ],
    });

    const textBlock = msg.content.find((b) => b.type === 'text');
    const markdown = textBlock && textBlock.text ? textBlock.text.trim() : '';
    if (!markdown) {
      return res.status(502).json({ error: 'Model returned no text' });
    }

    res.json({ markdown });
  } catch (err) {
    console.error('Session report error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate session report' });
  }
});

app.listen(PORT, () => {
  console.log(`Quiz server running at http://localhost:${PORT}`);
});
