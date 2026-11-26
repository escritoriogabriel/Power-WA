import { randomUUID } from 'node:crypto';
import type { AppData, Lead, Message } from '../../shared/types.js';
import { saveData } from '../lib/store.js';
import { sendOpenwaText } from '../lib/openwa-client.js';

function normalize(value: string): string { return value.trim().toLocaleLowerCase('pt-BR'); }

function addMessage(lead: Lead, direction: Message['direction'], body: string, source: Message['source']): void {
  lead.messages.push({ id: randomUUID(), chatId: lead.chatId, direction, body, timestamp: new Date().toISOString(), source });
  lead.updatedAt = new Date().toISOString();
}

async function sendAndRecord(lead: Lead, body: string, data: AppData): Promise<void> {
  addMessage(lead, 'outbound', body, 'power-wa');
  await sendOpenwaText(lead.chatId, body, data.openwa?.sessionId);
}

export interface IncomingMessage {
  chatId: string;
  phone: string;
  displayName: string;
  body: string;
  timestamp?: string;
}

export async function processIncomingMessage(data: AppData, incoming: IncomingMessage): Promise<Lead> {
  let lead = data.leads.find((item) => item.chatId === incoming.chatId);
  const now = new Date().toISOString();
  if (!lead) {
    lead = {
      id: randomUUID(), chatId: incoming.chatId, phone: incoming.phone, displayName: incoming.displayName || incoming.phone,
      status: 'triage', label: 'triagem', createdAt: now, updatedAt: now, currentQuestionIndex: 0, answers: {}, messages: []
    };
    data.leads.unshift(lead);
    addMessage(lead, 'inbound', incoming.body, 'openwa');
    lead.lastInboundAt = incoming.timestamp ?? now;
    await sendAndRecord(lead, `${data.triage.greeting}\n\n${formatQuestion(data, lead.currentQuestionIndex)}`, data);
    await saveData(data);
    return lead;
  }

  addMessage(lead, 'inbound', incoming.body, 'openwa');
  lead.lastInboundAt = incoming.timestamp ?? now;
  if (lead.status !== 'triage') { await saveData(data); return lead; }

  const question = data.triage.questions[lead.currentQuestionIndex];
  if (!question) { await completeTriage(lead, data); return lead; }
  const answer = resolveOption(question.options, incoming.body);
  if (!answer) {
    await sendAndRecord(lead, `${data.triage.fallback}\n\n${formatQuestion(data, lead.currentQuestionIndex)}`, data);
  } else {
    lead.answers[question.id] = answer;
    lead.currentQuestionIndex += 1;
    if (lead.currentQuestionIndex >= data.triage.questions.length) await completeTriage(lead, data);
    else await sendAndRecord(lead, formatQuestion(data, lead.currentQuestionIndex), data);
  }
  await saveData(data);
  return lead;
}

function resolveOption(options: string[], body: string): string | undefined {
  const normalized = normalize(body);
  const numeric = Number.parseInt(normalized, 10);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= options.length) return options[numeric - 1];
  return options.find((option) => normalize(option) === normalized);
}

function formatQuestion(data: AppData, questionIndex: number): string {
  const question = data.triage.questions[questionIndex];
  return question ? `${question.prompt}\n${question.options.map((option, index) => `${index + 1}. ${option}`).join('\n')}` : '';
}

async function completeTriage(lead: Lead, data: AppData): Promise<void> {
  lead.status = 'human_review';
  lead.label = 'aguardando-humano';
  await sendAndRecord(lead, data.triage.handoff, data);
}

export async function updateLeadStatus(data: AppData, lead: Lead, status: Lead['status']): Promise<void> {
  lead.status = status;
  lead.label = status === 'new' ? 'novo-lead' : status === 'triage' ? 'triagem' : status === 'human_review' ? 'aguardando-humano' : status === 'active' ? 'em-atendimento' : 'encerrado';
  lead.updatedAt = new Date().toISOString();
  await saveData(data);
}
