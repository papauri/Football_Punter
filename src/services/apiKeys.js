// API keys the app can use, where each one is set, and a free test for each.
//
// A key can come from the server's environment (set by whoever hosts the app) or be saved from the
// Settings page, which writes it to .env (not in git) so it survives a restart. Every test calls an
// endpoint that costs nothing: the Odds API's sports list does not use credits, and the AI providers'
// model lists are free.
import fs from 'fs';
import path from 'path';

export const SERVICES = [
  {
    id: 'odds', name: 'The Odds API', env: 'ODDS_API_KEY',
    use: 'Bookmaker prices for matches ESPN has no odds for. Credits are spent only where needed.',
    signup: 'https://the-odds-api.com'
  },
  { id: 'gemini', name: 'Google Gemini', env: 'GEMINI_API_KEY', use: 'AI match write-ups (optional).', ai: true, signup: 'https://aistudio.google.com/apikey' },
  { id: 'mistral', name: 'Mistral AI', env: 'MISTRAL_API_KEY', use: 'AI match write-ups (optional).', ai: true, signup: 'https://console.mistral.ai' },
  { id: 'openai', name: 'OpenAI', env: 'OPENAI_API_KEY', use: 'AI match write-ups (optional).', ai: true, signup: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', name: 'Anthropic Claude', env: 'ANTHROPIC_API_KEY', use: 'AI match write-ups (optional).', ai: true, signup: 'https://console.anthropic.com' }
];

const TIMEOUT = 15000;
let lastTests = null;

const statusFile = (dir) => path.join(dir, 'data', 'api-key-status.json');
function loadTests(dir) {
  if (lastTests) return lastTests;
  try { lastTests = JSON.parse(fs.readFileSync(statusFile(dir), 'utf8')) || {}; } catch { lastTests = {}; }
  return lastTests;
}
function saveTests(dir) {
  try { fs.mkdirSync(path.join(dir, 'data'), { recursive: true }); fs.writeFileSync(statusFile(dir), JSON.stringify(lastTests)); } catch { /* best effort */ }
}

function readEnvFile(dir) {
  try { return fs.readFileSync(path.join(dir, '.env'), 'utf8').split('\n'); } catch { return []; }
}

function envFileValue(dir, name) {
  const line = readEnvFile(dir).find(l => l.startsWith(`${name}=`));
  if (!line) return null;
  let v = line.slice(name.length + 1).trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  return v || null;
}

/** Write (or with an empty value, remove) one variable in .env and in the running process. */
export function writeEnvKey(dir, name, value) {
  const lines = readEnvFile(dir).filter(l => l.trim() && !l.startsWith(`${name}=`));
  if (value) lines.push(`${name}=${value}`);
  fs.writeFileSync(path.join(dir, '.env'), lines.join('\n') + (lines.length ? '\n' : ''));
  if (value) process.env[name] = value; else delete process.env[name];
}

/** The key currently in use for a service, and where it came from. */
export function resolveKey(dir, service, aiConfig = {}) {
  const fromAiConfig = service.ai ? aiConfig?.[service.id]?.key : null;
  const fromEnv = process.env[service.env];
  const key = (fromAiConfig || fromEnv || '').trim();
  if (!key) return { key: null, source: null };
  const inFile = envFileValue(dir, service.env);
  const source = (fromAiConfig && fromAiConfig.trim() === key) || (inFile && inFile === key) ? 'app' : 'server';
  return { key, source };
}

const mask = (k) => (k.length > 8 ? `${k.slice(0, 4)}…${k.slice(-4)}` : '••••••••');

async function call(url, headers = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT) });
  return res;
}

const TESTS = {
  async odds(key) {
    const res = await call(`https://api.the-odds-api.com/v4/sports/?apiKey=${encodeURIComponent(key)}`);
    if (res.status === 401 || res.status === 403) return { ok: false, message: 'Key rejected by The Odds API.' };
    if (!res.ok) return { ok: false, message: `The Odds API answered ${res.status}.` };
    const remaining = Number(res.headers.get('x-requests-remaining'));
    const used = Number(res.headers.get('x-requests-used'));
    const credits = Number.isFinite(remaining) && res.headers.get('x-requests-remaining') !== null ? { remaining, used: Number.isFinite(used) ? used : null } : null;
    return { ok: true, message: credits ? `Working. ${credits.remaining} credits left this month.` : 'Working.', credits };
  },
  async gemini(key) {
    const res = await call(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
    return res.ok ? { ok: true, message: 'Working.' } : { ok: false, message: res.status === 400 || res.status === 403 ? 'Key rejected by Google.' : `Google answered ${res.status}.` };
  },
  async mistral(key) {
    const res = await call('https://api.mistral.ai/v1/models', { Authorization: `Bearer ${key}` });
    return res.ok ? { ok: true, message: 'Working.' } : { ok: false, message: res.status === 401 ? 'Key rejected by Mistral.' : `Mistral answered ${res.status}.` };
  },
  async openai(key) {
    const res = await call('https://api.openai.com/v1/models', { Authorization: `Bearer ${key}` });
    return res.ok ? { ok: true, message: 'Working.' } : { ok: false, message: res.status === 401 ? 'Key rejected by OpenAI.' : `OpenAI answered ${res.status}.` };
  },
  async anthropic(key) {
    const res = await call('https://api.anthropic.com/v1/models', { 'x-api-key': key, 'anthropic-version': '2023-06-01' });
    return res.ok ? { ok: true, message: 'Working.' } : { ok: false, message: res.status === 401 ? 'Key rejected by Anthropic.' : `Anthropic answered ${res.status}.` };
  }
};

/**
 * Test a key. With `candidate`, tests that key without saving it; otherwise tests the key in use.
 * Only a test of the key in use is remembered.
 */
export async function testKey(dir, id, aiConfig, candidate = null) {
  const service = SERVICES.find(s => s.id === id);
  if (!service) return { ok: false, message: 'Unknown service.' };
  const key = (candidate || resolveKey(dir, service, aiConfig).key || '').trim();
  if (!key) return { ok: false, message: 'No key set.' };
  let result;
  try {
    result = await TESTS[id](key);
  } catch (e) {
    result = { ok: false, message: `Could not reach ${service.name}: ${e.name === 'TimeoutError' ? 'timed out' : e.message}.` };
  }
  result.at = new Date().toISOString();
  if (!candidate) {
    loadTests(dir)[id] = { ...result, keyTail: key.slice(-4) };
    saveTests(dir);
  }
  return result;
}

/** Every service with whether a key is set, where from, and the last test of that key. */
export function keyStatus(dir, aiConfig) {
  const tests = loadTests(dir);
  return SERVICES.map(s => {
    const { key, source } = resolveKey(dir, s, aiConfig);
    const t = tests[s.id];
    // A remembered result only counts for the same key.
    const lastTest = key && t && t.keyTail === key.slice(-4) ? { ok: t.ok, message: t.message, at: t.at, credits: t.credits || null } : null;
    return { id: s.id, name: s.name, use: s.use, signup: s.signup, configured: Boolean(key), source, masked: key ? mask(key) : '', lastTest };
  });
}

export function forgetTest(dir, id) {
  delete loadTests(dir)[id];
  saveTests(dir);
}
