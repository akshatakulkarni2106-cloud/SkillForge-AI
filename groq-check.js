const fs = require('fs');
const path = 'c:/Users/aksha/OneDrive/Desktop/skillforge-ai/frontend/.env';
const env = fs.readFileSync(path, 'utf8');
const key = env.split(/\r?\n/).find((line) => line.startsWith('VITE_GROQ_API_KEY')).split('=')[1].trim();

const flattenCandidate = (candidate) => {
  if (!candidate || typeof candidate !== 'string') return candidate;
  return candidate
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```/g, '')
    .replace(/\r/g, '\n')
    .trim();
};

const sanitizeCandidate = (candidate) => {
  let normalized = flattenCandidate(candidate);
  if (!normalized) return normalized;
  normalized = normalized
    .replace(/([{,]\s*)([A-Za-z0-9_]+)(\s*:)/g, '$1"$2"$3')
    .replace(/([\[{,]\s*)([A-Za-z0-9_]+)(\s*:)/g, '$1"$2"$3')
    .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ': "$1"')
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/("(?:\\.|[^"\\])*"|('(?:\\.|[^'\\])*'))/g, (match) => match.replace(/[\r\n]+/g, '\\n'));
  return normalized;
};

const getBalancedJsonCandidates = (text) => {
  const trimmed = flattenCandidate(text);
  if (!trimmed) return [];
  const candidates = new Set();

  for (let index = 0; index < trimmed.length; index += 1) {
    if (trimmed[index] !== '{') continue;
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let cursor = index; cursor < trimmed.length; cursor += 1) {
      const char = trimmed[cursor];
      if (quote) {
        if (escaped) { escaped = false; continue; }
        if (char === '\\') { escaped = true; continue; }
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === '{') { depth += 1; continue; }
      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          const candidate = trimmed.slice(index, cursor + 1);
          if (candidate.trim()) candidates.add(candidate);
          break;
        }
      }
    }
  }

  const firstOpening = trimmed.indexOf('{');
  const lastClosing = trimmed.lastIndexOf('}');
  if (firstOpening >= 0 && lastClosing > firstOpening) {
    candidates.add(trimmed.slice(firstOpening, lastClosing + 1));
  }
  const objectMatch = trimmed.match(/\{[\s\S]*?\}/);
  if (objectMatch) candidates.add(objectMatch[0]);
  candidates.add(trimmed);
  return Array.from(candidates).filter(Boolean);
};

const extractJsonObject = (rawText) => {
  if (rawText === null || rawText === undefined) throw new Error('The model returned an empty response.');
  if (typeof rawText === 'object' && !Array.isArray(rawText)) return rawText;
  const parseAttempts = Array.from(new Set(getBalancedJsonCandidates(rawText)))
    .sort((a, b) => b.length - a.length);
  for (const candidate of parseAttempts) {
    try {
      return JSON.parse(sanitizeCandidate(candidate));
    } catch (error) {
      // keep trying next candidate
    }
  }
  throw new Error('The model response was not valid JSON.');
};

(async () => {
  const payload = {
    model: 'openai/gpt-oss-120b',
    messages: [
      {
        role: 'system',
        content: 'Return valid JSON only. The response must be a single object with fields: {"summary":"string","milestones":[{"id":"string","title":"string","skill":"string","reason":"string","estimatedTime":"string","resources":["string"],"status":"not_started"}]}. No prose, no markdown.'
      },
      { role: 'user', content: 'Generate a roadmap for a frontend developer.' }
    ],
    temperature: 0.6,
    max_tokens: 900
  };

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  console.log('status:', res.status);
  console.log('parsed?', !!content);
  const outputPath = 'c:/Users/aksha/OneDrive/Desktop/skillforge-ai/groq-response.txt';
  fs.writeFileSync(outputPath, String(content || ''));
  try {
    const parsed = extractJsonObject(content);
    console.log('parsed object keys:', Object.keys(parsed));
    console.log(JSON.stringify(parsed).slice(0, 400));
  } catch (error) {
    console.error('EXTRACT_ERROR:', error.message);
    console.log('saved response to:', outputPath);
  }
})();
