import { config } from './config.js';

export interface OpenwaSession {
  id: string;
  name: string;
  status: string;
  phone?: string | null;
  pushName?: string | null;
  lastError?: string | null;
  engineLoaded?: boolean;
}

export interface OpenwaQrResponse { qrCode: string; status: string; }

function apiUrl(path: string): string {
  return `${config.openwaBaseUrl.replace(/\/$/, '')}/api${path}`;
}

async function openwaRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!config.openwaBaseUrl || !config.openwaApiKey) throw new Error('OpenWA não configurado no servidor');
  const headers = new Headers(init.headers);
  headers.set('X-API-Key', config.openwaApiKey);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...init, headers });
  } catch {
    throw new Error('Não foi possível alcançar o OpenWA. Verifique se o gateway está ligado e se OPENWA_BASE_URL aponta para o endereço correto, sem /api no final.');
  }
  const body = await response.text();
  let parsed: unknown = undefined;
  try { parsed = body ? JSON.parse(body) : undefined; } catch { parsed = undefined; }
  if (!response.ok) {
    const detail = parsed && typeof parsed === 'object' && 'message' in parsed ? String((parsed as { message: unknown }).message) : `HTTP ${response.status}`;
    throw new Error(`OpenWA: ${detail}`);
  }
  return parsed as T;
}

export function hasOpenwaTransport(): boolean { return Boolean(config.openwaBaseUrl && config.openwaApiKey); }
export function configuredSessionId(): string { return config.openwaSessionId; }
export function configuredSessionName(): string { return config.openwaSessionName; }
export function publicWebhookUrl(): string { return config.openwaPublicUrl ? `${config.openwaPublicUrl.replace(/\/$/, '')}/api/webhooks/openwa` : ''; }

export async function listOpenwaSessions(): Promise<OpenwaSession[]> { return openwaRequest<OpenwaSession[]>('/sessions'); }
export async function createOpenwaSession(name: string): Promise<OpenwaSession> { return openwaRequest<OpenwaSession>('/sessions', { method: 'POST', body: JSON.stringify({ name }) }); }
export async function getOpenwaSession(sessionId: string): Promise<OpenwaSession> { return openwaRequest<OpenwaSession>(`/sessions/${encodeURIComponent(sessionId)}`); }
export async function startOpenwaSession(sessionId: string): Promise<OpenwaSession> { return openwaRequest<OpenwaSession>(`/sessions/${encodeURIComponent(sessionId)}/start`, { method: 'POST' }); }
export async function stopOpenwaSession(sessionId: string): Promise<OpenwaSession> { return openwaRequest<OpenwaSession>(`/sessions/${encodeURIComponent(sessionId)}/stop`, { method: 'POST' }); }
export async function getOpenwaQr(sessionId: string): Promise<OpenwaQrResponse> { return openwaRequest<OpenwaQrResponse>(`/sessions/${encodeURIComponent(sessionId)}/qr`); }

export async function registerOpenwaWebhook(sessionId: string, url: string, secret: string): Promise<{ id: string }> {
  return openwaRequest<{ id: string }>(`/sessions/${encodeURIComponent(sessionId)}/webhooks`, { method: 'POST', body: JSON.stringify({ url, events: ['message.received', 'session.status'], secret, retryCount: 3 }) });
}

export async function sendOpenwaText(chatId: string, body: string, sessionId = config.openwaSessionId): Promise<void> {
  if (!hasOpenwaTransport() || !sessionId) { console.info(JSON.stringify({ event: 'openwa_send_skipped', reason: 'integration_not_configured' })); return; }
  await openwaRequest(`/sessions/${encodeURIComponent(sessionId)}/messages/send-text`, { method: 'POST', body: JSON.stringify({ chatId, text: body }) });
}
