const DEFAULT_TIMEOUT_MS = 15000;

const getAiServiceUrl = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';

const makeAiServiceError = (message, { kind = 'service_rejected', status = 502 } = {}) => {
  const error = new Error(message);
  error.kind = kind;
  error.status = status;
  return error;
};

const requestJson = async (path, payload, action = 'generate') => {
  const url = `${getAiServiceUrl()}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }

    if (!response.ok) {
      const detail = typeof data?.detail === 'string' ? data.detail : null;
      const statusMessage = detail || (action === 'generate'
        ? 'AI service rejected the request. Check the OpenAI key and quota and try again.'
        : 'AI service rejected the assessment request. Check the OpenAI key and quota and try again.');
      throw makeAiServiceError(statusMessage, { kind: 'service_rejected', status: response.status || 502 });
    }

    if (!data) {
      throw makeAiServiceError(action === 'generate'
        ? "Couldn't generate a question, try again"
        : "Couldn't evaluate the assessment, try again", { kind: 'service_rejected', status: 502 });
    }

    return data;
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw makeAiServiceError(action === 'generate'
        ? 'AI service is not running or unreachable. Start the ai-service on port 8000 and try again.'
        : 'AI service is not running or unreachable. Start the ai-service on port 8000 and try again.', { kind: 'service_unreachable', status: 503 });
    }

    if (error && typeof error === 'object' && error.kind) {
      throw error;
    }

    const message = String(error?.message || 'AI service error');
    const lowerMessage = message.toLowerCase();
    const isUnreachable = /fetch failed|ecconnrefused|econnrefused|enotfound|timed out|network|connection refused|aborted/i.test(lowerMessage);

    if (isUnreachable) {
      throw makeAiServiceError('AI service is not running or unreachable. Start the ai-service on port 8000 and try again.', { kind: 'service_unreachable', status: 503 });
    }

    throw makeAiServiceError(message || 'AI service rejected the request. Check the OpenAI key and quota and try again.', { kind: 'service_rejected', status: 502 });
  } finally {
    clearTimeout(timer);
  }
};

async function generateQuestion(payload) {
  return requestJson('/generate-question', payload, 'generate');
}

async function evaluate(payload) {
  return requestJson('/evaluate', payload, 'evaluate');
}

module.exports = { generateQuestion, evaluate };
