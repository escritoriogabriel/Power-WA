import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { AppData, Lead, TriageConfig } from '../../shared/types.js';
import { config } from './config.js';

const defaultTriage: TriageConfig = {
  greeting: 'Olá. Vou fazer algumas perguntas rápidas para direcionar seu atendimento. As informações serão revisadas pela equipe do escritório.',
  fallback: 'Não consegui identificar uma opção válida. Responda usando o número ou o texto de uma das opções disponíveis.',
  handoff: 'Obrigado pelas informações. Vou encaminhar seu atendimento para a equipe do escritório. Em breve, uma pessoa continuará a conversa por aqui.',
  questions: [
    { id: 'area', prompt: 'Qual assunto melhor descreve sua necessidade?', options: ['Trabalhista', 'Família e sucessões', 'Cível e contratos', 'Outro assunto'] },
    { id: 'urgency', prompt: 'Existe algum prazo ou urgência que devemos considerar?', options: ['Sim, há prazo', 'Não há prazo conhecido', 'Ainda não sei informar'] }
  ]
};

export function createEmptyData(): AppData {
  return { leads: [], processedDeliveryIds: [], triage: structuredClone(defaultTriage) };
}

export async function loadData(): Promise<AppData> {
  try {
    const raw = await readFile(config.dataFile, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return { ...createEmptyData(), ...parsed, triage: { ...defaultTriage, ...(parsed.triage ?? {}) } };
  } catch {
    const data = createEmptyData();
    await saveData(data);
    return data;
  }
}

export async function saveData(data: AppData): Promise<void> {
  await mkdir(dirname(config.dataFile), { recursive: true });
  const temporaryFile = `${config.dataFile}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(temporaryFile, config.dataFile);
}

export function findLead(data: AppData, id: string): Lead | undefined {
  return data.leads.find((lead) => lead.id === id);
}
