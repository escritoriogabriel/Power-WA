export type LeadStatus = 'new' | 'triage' | 'human_review' | 'active' | 'closed';

export interface Message {
  id: string;
  chatId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  timestamp: string;
  source: 'openwa' | 'power-wa';
}

export interface TriageQuestion {
  id: string;
  prompt: string;
  options: string[];
}

export interface TriageConfig {
  greeting: string;
  fallback: string;
  handoff: string;
  questions: TriageQuestion[];
}

export interface Lead {
  id: string;
  chatId: string;
  phone: string;
  displayName: string;
  status: LeadStatus;
  label: 'novo-lead' | 'triagem' | 'aguardando-humano' | 'em-atendimento' | 'encerrado';
  createdAt: string;
  updatedAt: string;
  currentQuestionIndex: number;
  answers: Record<string, string>;
  messages: Message[];
  lastInboundAt?: string;
}

export interface AppData {
  leads: Lead[];
  processedDeliveryIds: string[];
  triage: TriageConfig;
  openwa?: { sessionId: string; sessionName: string; webhookId?: string };
}
