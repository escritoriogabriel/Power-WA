import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../lib/config.js';
import { requireOperator } from '../lib/auth.js';
import { findLead, loadData, saveData } from '../lib/store.js';
import { parseDelivery, verifyOpenwaSignature } from '../lib/openwa-signature.js';
import { configuredSessionId, configuredSessionName, createOpenwaSession, getOpenwaQr, getOpenwaSession, hasOpenwaTransport, listOpenwaSessions, publicWebhookUrl, registerOpenwaWebhook, startOpenwaSession, stopOpenwaSession, type OpenwaSession } from '../lib/openwa-client.js';
import { processIncomingMessage, updateLeadStatus } from '../services/triage.js';

export const api = Router();
api.get('/health', (_req, res) => res.json({ ok: true, integrationConfigured: Boolean(config.openwaBaseUrl && config.openwaApiKey) }));
api.use(requireOperator);

const triageSchema = z.object({
  greeting: z.string().trim().min(1).max(2000),
  fallback: z.string().trim().min(1).max(1000),
  handoff: z.string().trim().min(1).max(2000),
  questions: z.array(z.object({ id: z.string().trim().min(1).max(64), prompt: z.string().trim().min(1).max(1000), options: z.array(z.string().trim().min(1).max(200)).min(2).max(10) })).min(1).max(20)
}).superRefine((value, context) => {
  const ids = value.questions.map((question) => question.id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', path: ['questions'], message: 'IDs de perguntas devem ser únicos' });
});

api.get('/leads', async (req, res) => {
  const data = await loadData();
  const query = String(req.query.q ?? '').trim().toLocaleLowerCase('pt-BR');
  const status = String(req.query.status ?? 'all');
  const leads = data.leads.filter((lead) => {
    const matchesQuery = !query || `${lead.displayName} ${lead.phone} ${lead.chatId}`.toLocaleLowerCase('pt-BR').includes(query);
    return matchesQuery && (status === 'all' || lead.status === status);
  });
  res.json({ leads, counts: countStatuses(data.leads) });
});

api.get('/leads/:id', async (req, res) => {
  const data = await loadData();
  const lead = findLead(data, req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
  return res.json({ lead, triage: data.triage });
});

api.post('/leads/:id/status', async (req, res) => {
  const data = await loadData();
  const lead = findLead(data, req.params.id);
  const next = req.body?.status;
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
  if (!['new', 'triage', 'human_review', 'active', 'closed'].includes(next)) return res.status(400).json({ error: 'Estado inválido' });
  await updateLeadStatus(data, lead, next);
  return res.json({ lead });
});

api.get('/settings/triage', async (_req, res) => res.json({ triage: (await loadData()).triage }));
api.put('/settings/triage', async (req, res) => {
  const data = await loadData();
  const parsed = triageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Configuração inválida', details: parsed.error.flatten() });
  data.triage = parsed.data;
  await saveData(data);
  return res.json({ triage: data.triage });
});

api.get('/openwa/status', async (_req, res) => {
  if (!hasOpenwaTransport()) return res.json({ integrationConfigured: false, publicUrlConfigured: Boolean(publicWebhookUrl()), session: null });
  const data = await loadData();
  const sessionId = data.openwa?.sessionId ?? configuredSessionId();
  if (!sessionId) return res.json({ integrationConfigured: true, publicUrlConfigured: Boolean(publicWebhookUrl()), session: null });
  try {
    const session = await getOpenwaSession(sessionId);
    if (session.status === 'ready' && publicWebhookUrl() && config.openwaWebhookSecret.length >= 16 && !data.openwa?.webhookId) {
      try {
        const webhook = await registerOpenwaWebhook(session.id, publicWebhookUrl(), config.openwaWebhookSecret);
        data.openwa = { sessionId: session.id, sessionName: session.name, webhookId: webhook.id };
        await saveData(data);
      } catch (error) {
        console.error(JSON.stringify({ event: 'openwa_webhook_registration_failed', reason: error instanceof Error ? error.message : 'unknown' }));
      }
    }
    return res.json({ integrationConfigured: true, publicUrlConfigured: Boolean(publicWebhookUrl()), webhookConfigured: Boolean(data.openwa?.webhookId), webhookRequired: !data.openwa?.webhookId, session });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Não foi possível consultar o OpenWA' });
  }
});

api.post('/openwa/connect', async (req, res) => {
  if (!hasOpenwaTransport()) return res.status(503).json({ error: 'Configure OPENWA_BASE_URL e OPENWA_API_KEY no servidor antes de conectar.' });
  const requestedName = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : configuredSessionName();
  if (!/^[A-Za-z0-9-]{3,50}$/.test(requestedName)) return res.status(400).json({ error: 'O nome da sessão deve ter 3–50 caracteres, usando apenas letras, números e hífens.' });
  const data = await loadData();
  let session: OpenwaSession | undefined;
  const storedId = data.openwa?.sessionId ?? configuredSessionId();
  if (storedId) { try { session = await getOpenwaSession(storedId); } catch { session = undefined; } }
  if (!session) {
    const sessions = await listOpenwaSessions();
    session = sessions.find((item) => item.name === requestedName);
  }
  if (!session) session = await createOpenwaSession(requestedName);
  if (session.status === 'created' || session.status === 'disconnected' || session.status === 'failed') {
    session = await startOpenwaSession(session.id);
  }
  data.openwa = { sessionId: session.id, sessionName: session.name, webhookId: data.openwa?.webhookId };
  if (publicWebhookUrl() && config.openwaWebhookSecret.length >= 16 && !data.openwa.webhookId) {
    try {
      const webhook = await registerOpenwaWebhook(session.id, publicWebhookUrl(), config.openwaWebhookSecret);
      data.openwa.webhookId = webhook.id;
    } catch (error) {
      console.error(JSON.stringify({ event: 'openwa_webhook_registration_failed', reason: error instanceof Error ? error.message : 'unknown' }));
    }
  }
  await saveData(data);
  return res.json({ session, webhookConfigured: Boolean(data.openwa.webhookId), webhookRequired: !data.openwa.webhookId });
});

api.get('/openwa/qr', async (_req, res) => {
  const data = await loadData();
  const sessionId = data.openwa?.sessionId ?? configuredSessionId();
  if (!sessionId) return res.status(404).json({ error: 'Nenhuma sessão OpenWA foi criada.' });
  try { return res.json(await getOpenwaQr(sessionId)); }
  catch (error) { return res.status(409).json({ error: error instanceof Error ? error.message : 'QR ainda não está disponível.' }); }
});

api.post('/openwa/stop', async (_req, res) => {
  const data = await loadData();
  const sessionId = data.openwa?.sessionId ?? configuredSessionId();
  if (!sessionId) return res.status(404).json({ error: 'Nenhuma sessão OpenWA foi criada.' });
  try { return res.json({ session: await stopOpenwaSession(sessionId) }); }
  catch (error) { return res.status(502).json({ error: error instanceof Error ? error.message : 'Não foi possível parar a sessão.' }); }
});

let webhookQueue = Promise.resolve();

export async function openwaWebhook(req: Request, res: Response): Promise<void> {
  const task = webhookQueue.then(() => handleOpenwaWebhook(req, res));
  webhookQueue = task.then(() => undefined, () => undefined);
  await task;
}

async function handleOpenwaWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  if (!verifyOpenwaSignature(rawBody, req.header('X-OpenWA-Signature'), config.openwaWebhookSecret)) {
    res.status(401).json({ error: 'Assinatura inválida' });
    return;
  }
  try {
    const delivery = parseDelivery(rawBody);
    const data = await loadData();
    if (data.processedDeliveryIds.includes(delivery.idempotencyKey)) { res.status(200).json({ accepted: true, duplicate: true }); return; }
    data.processedDeliveryIds.push(delivery.idempotencyKey);
    if (data.processedDeliveryIds.length > 5000) data.processedDeliveryIds = data.processedDeliveryIds.slice(-5000);
    if (delivery.event === 'message.received') {
      const message = delivery.data?.message as Record<string, unknown> | undefined;
      const chatId = String(message?.from ?? message?.chatId ?? '');
      const body = String(message?.body ?? '');
      if (chatId && body && message?.fromMe !== true) {
        await processIncomingMessage(data, { chatId, phone: String(message?.author ?? chatId).replace(/@.*$/, ''), displayName: String(message?.notifyName ?? message?.senderName ?? ''), body, timestamp: String(message?.timestamp ?? '') });
      }
    }
    await saveData(data);
    res.status(200).json({ accepted: true });
  } catch (error) {
    console.error(JSON.stringify({ event: 'openwa_webhook_rejected', reason: error instanceof Error ? error.message : 'unknown' }));
    res.status(400).json({ error: 'Payload inválido' });
  }
}

function countStatuses(leads: { status: string }[]): Record<string, number> {
  return leads.reduce<Record<string, number>>((counts, lead) => { counts[lead.status] = (counts[lead.status] ?? 0) + 1; return counts; }, {});
}
