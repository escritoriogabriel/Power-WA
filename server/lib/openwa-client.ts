import { config, hasOpenwaConfig } from './config.js';

export async function sendOpenwaText(chatId: string, body: string): Promise<void> {
  if (!hasOpenwaConfig()) {
    console.info(JSON.stringify({ event: 'openwa_send_skipped', reason: 'integration_not_configured' }));
    return;
  }
  const response = await fetch(`${config.openwaBaseUrl.replace(/\/$/, '')}/api/sendText`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-API-Key': config.openwaApiKey },
    body: JSON.stringify({ sessionId: config.openwaSessionId, chatId, message: body })
  });
  if (!response.ok) throw new Error(`OpenWA send failed with status ${response.status}`);
}
