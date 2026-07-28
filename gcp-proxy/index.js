// Cloud Run service: proxies transcript-labeling requests to the Anthropic API.
// ANTHROPIC_API_KEY is injected at deploy time from Secret Manager
// (--set-secrets=ANTHROPIC_API_KEY=anthropic-api-key:latest) — it never reaches
// the static frontend, the GitHub repo, or any visitor's browser.

import { createServer } from 'node:http';

const PORT = process.env.PORT || 8080;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://acidovioletax.github.io';
const ALLOWED_MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-5'];
const MAX_TOKENS_CAP = 8000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const APP_ACCESS_CODE = process.env.APP_ACCESS_CODE || '';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Access-Code',
    'Vary': 'Origin',
  };
}

function send(res, status, bodyObj) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders() });
  res.end(JSON.stringify(bodyObj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method === 'GET') {
    send(res, 200, { status: 'ok', service: 'marces-transcrypt-proxy' });
    return;
  }

  if (req.method !== 'POST') {
    send(res, 405, { error: 'Método no permitido.' });
    return;
  }

  if (!ANTHROPIC_API_KEY) {
    send(res, 500, { error: 'El servicio no tiene configurada la API key (ANTHROPIC_API_KEY).' });
    return;
  }

  if (APP_ACCESS_CODE) {
    const provided = req.headers['x-app-access-code'] || '';
    if (provided !== APP_ACCESS_CODE) {
      send(res, 401, { error: 'Código de acceso inválido.' });
      return;
    }
  }

  let payload;
  try {
    const raw = await readBody(req);
    payload = JSON.parse(raw || '{}');
  } catch (err) {
    send(res, 400, { error: 'Cuerpo JSON inválido.' });
    return;
  }

  const { model, system, messages, max_tokens } = payload;

  if (!ALLOWED_MODELS.includes(model)) {
    send(res, 400, { error: 'Modelo no permitido.' });
    return;
  }
  if (!system || !Array.isArray(messages) || messages.length === 0) {
    send(res, 400, { error: 'Faltan campos requeridos (system, messages).' });
    return;
  }

  const cappedMaxTokens = Math.min(Number(max_tokens) || MAX_TOKENS_CAP, MAX_TOKENS_CAP);

  try {
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, system, messages, max_tokens: cappedMaxTokens }),
    });

    const data = await anthropicResponse.text();
    res.writeHead(anthropicResponse.status, { 'Content-Type': 'application/json', ...corsHeaders() });
    res.end(data);
  } catch (err) {
    send(res, 502, { error: 'Error al contactar la API de Anthropic.' });
  }
});

server.listen(PORT, () => {
  console.log(`marces-transcrypt-proxy escuchando en el puerto ${PORT}`);
});
