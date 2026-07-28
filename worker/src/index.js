// Cloudflare Worker: proxies transcript-labeling requests to the Anthropic API.
// The real Anthropic API key lives only in this Worker's encrypted secrets
// (set via `wrangler secret put ANTHROPIC_API_KEY`) — it never reaches the
// static frontend, the GitHub repo, or any visitor's browser.

const ALLOWED_ORIGIN = 'https://acidovioletax.github.io';
const ALLOWED_MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-5'];
const MAX_TOKENS_CAP = 8000;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Access-Code',
  };
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Método no permitido.' }, 405);
    }

    // Optional lightweight access gate. Only enforced if APP_ACCESS_CODE
    // secret is set (`wrangler secret put APP_ACCESS_CODE`); otherwise the
    // proxy is open to anyone who calls it, same as the public page.
    if (env.APP_ACCESS_CODE) {
      const provided = request.headers.get('X-App-Access-Code') || '';
      if (provided !== env.APP_ACCESS_CODE) {
        return jsonResponse({ error: 'Código de acceso inválido.' }, 401);
      }
    }

    let payload;
    try {
      payload = await request.json();
    } catch (err) {
      return jsonResponse({ error: 'Cuerpo JSON inválido.' }, 400);
    }

    const { model, system, messages, max_tokens } = payload || {};

    if (!ALLOWED_MODELS.includes(model)) {
      return jsonResponse({ error: 'Modelo no permitido.' }, 400);
    }
    if (!system || !Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: 'Faltan campos requeridos (system, messages).' }, 400);
    }

    const cappedMaxTokens = Math.min(Number(max_tokens) || MAX_TOKENS_CAP, MAX_TOKENS_CAP);

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, system, messages, max_tokens: cappedMaxTokens }),
    });

    const data = await anthropicResponse.text();

    return new Response(data, {
      status: anthropicResponse.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  },
};
