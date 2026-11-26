import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Lead, LeadStatus } from '../../shared/types.js';
import './styles.css';

const statusLabels: Record<LeadStatus, string> = { new: 'Novos', triage: 'Em triagem', human_review: 'Aguardando humano', active: 'Em atendimento', closed: 'Encerrados' };

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('power-wa.operator-token') ?? '');
  const [tokenInput, setTokenInput] = useState(token);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [status, setStatus] = useState<'all' | LeadStatus>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState('');
  const [integrationConfigured, setIntegrationConfigured] = useState(false);

  async function apiFetch(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(path, { ...options, headers });
  }

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const [leadResponse, healthResponse] = await Promise.all([apiFetch(`/api/leads?status=${status}&q=${encodeURIComponent(query)}`), fetch('/api/health')]);
      if (leadResponse.status === 401 || leadResponse.status === 503) { signOut(); throw new Error('Token de operador inválido ou não configurado.'); }
      if (!leadResponse.ok) throw new Error('Não foi possível carregar a fila.');
      const payload = await leadResponse.json() as { leads: Lead[] };
      const health = await healthResponse.json() as { integrationConfigured: boolean };
      setIntegrationConfigured(health.integrationConfigured);
      setLeads(payload.leads);
      if (selected) { const next = payload.leads.find((lead) => lead.id === selected.id); if (next) setSelected(next); }
      setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao carregar dados.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, [status, query, token]);
  const grouped = useMemo(() => leads.reduce<Record<string, number>>((acc, lead) => { acc[lead.status] = (acc[lead.status] ?? 0) + 1; return acc; }, {}), [leads]);
  function signIn() { const clean = tokenInput.trim(); if (!clean) return; sessionStorage.setItem('power-wa.operator-token', clean); setToken(clean); }
  function signOut() { sessionStorage.removeItem('power-wa.operator-token'); setToken(''); setLeads([]); setSelected(null); }

  async function changeStatus(next: LeadStatus) {
    if (!selected) return;
    await apiFetch(`/api/leads/${selected.id}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: next }) });
    await refresh();
  }

  if (!token) return <Login tokenInput={tokenInput} setTokenInput={setTokenInput} onSubmit={signIn} error={error} />;
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand-lockup"><span className="brand-mark">P</span><div><strong>Power-WA</strong><small>central de triagem</small></div></div><div className="sidebar-section"><span className="eyebrow">Operação</span><button className="nav-item active"><span>▣</span> Caixa de entrada <b>{grouped.human_review ?? 0}</b></button><button className="nav-item"><span>⌁</span> Configurações</button></div><div className="sidebar-footer"><span className={`status-dot ${integrationConfigured ? '' : 'offline'}`} /> {integrationConfigured ? 'OpenWA conectado' : 'OpenWA não configurado'} <small>{integrationConfigured ? 'webhook e envio ativos' : 'configure o ambiente server-side'}</small><button className="signout" onClick={signOut}>Sair da sessão</button></div></aside>
    <main className="workspace"><header className="topbar"><div><span className="eyebrow">quinta-feira · 26 nov 2026</span><h1>Caixa de entrada</h1></div><div className="topbar-actions"><span className={`system-pill ${integrationConfigured ? '' : 'offline-pill'}`}><span className={`status-dot ${integrationConfigured ? '' : 'offline'}`} /> {integrationConfigured ? 'webhook ativo' : 'modo local'}</span><button className="icon-button" aria-label="Atualizar" onClick={() => void refresh()}>↻</button></div></header><section className="metrics"><Metric label="Total na fila" value={leads.length} note="visíveis agora" /><Metric label="Aguardando humano" value={grouped.human_review ?? 0} note="prioridade de hoje" accent /><Metric label="Em triagem" value={grouped.triage ?? 0} note="bot em atendimento" /></section><section className="inbox-layout"><div className="queue-panel panel"><div className="panel-heading"><div><span className="eyebrow">Leads recebidos</span><h2>Fila de atendimento</h2></div><span className="count-badge">{leads.length}</span></div><div className="filters"><label className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou telefone" /></label><select value={status} onChange={(event) => setStatus(event.target.value as 'all' | LeadStatus)}><option value="all">Todos os estados</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div className="queue-list">{loading ? <EmptyState title="Carregando fila" detail="Buscando conversas no servidor." /> : error ? <EmptyState title="Não foi possível carregar" detail={error} /> : leads.length === 0 ? <EmptyState title="Nenhum lead nesta fila" detail="Quando o primeiro contato chegar pelo WhatsApp, ele aparecerá aqui." /> : leads.map((lead) => <LeadRow key={lead.id} lead={lead} selected={selected?.id === lead.id} onClick={() => setSelected(lead)} />)}</div></div><Conversation lead={selected} onStatus={changeStatus} /></section></main>
  </div>;
}

function Login({ tokenInput, setTokenInput, onSubmit, error }: { tokenInput: string; setTokenInput: (value: string) => void; onSubmit: () => void; error: string }) { return <div className="login-shell"><div className="login-card"><div className="brand-lockup"><span className="brand-mark">P</span><div><strong>Power-WA</strong><small>central de triagem</small></div></div><span className="eyebrow">Acesso do operador</span><h1>Entre para revisar os leads.</h1><p>Use o token configurado somente no servidor do Power-WA. Ele não é salvo no código e fica apenas nesta sessão do navegador.</p><label className="token-field"><span>Token de operador</span><input type="password" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSubmit(); }} placeholder="••••••••••••" /></label>{error && <div className="login-error">{error}</div>}<button className="primary-action login-button" onClick={onSubmit}>Acessar painel</button></div></div>; }
function Metric({ label, value, note, accent = false }: { label: string; value: number; note: string; accent?: boolean }) { return <div className={`metric ${accent ? 'metric-accent' : ''}`}><span className="eyebrow">{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function LeadRow({ lead, selected, onClick }: { lead: Lead; selected: boolean; onClick: () => void }) { return <button className={`lead-row ${selected ? 'selected' : ''}`} onClick={onClick}><span className={`priority-bar ${lead.status}`} /><div className="avatar">{lead.displayName.slice(0, 1).toUpperCase()}</div><div className="lead-main"><strong>{lead.displayName}</strong><span>{lead.messages.at(-1)?.body ?? 'Sem mensagens'}</span></div><div className="lead-meta"><time>{formatTime(lead.updatedAt)}</time><span className={`status-chip ${lead.status}`}>{statusLabels[lead.status]}</span></div></button>; }
function Conversation({ lead, onStatus }: { lead: Lead | null; onStatus: (status: LeadStatus) => Promise<void> }) { if (!lead) return <div className="conversation-panel panel empty-conversation"><div className="empty-symbol">◌</div><h2>Selecione uma conversa</h2><p>Escolha um lead na fila para revisar a triagem e assumir o atendimento.</p></div>; return <div className="conversation-panel panel"><div className="conversation-header"><div className="contact-heading"><div className="avatar large">{lead.displayName.slice(0, 1).toUpperCase()}</div><div><span className="eyebrow">{lead.phone}</span><h2>{lead.displayName}</h2></div></div><span className={`status-chip ${lead.status}`}>{statusLabels[lead.status]}</span></div><div className="conversation-body">{lead.messages.map((message) => <div key={message.id} className={`message-bubble ${message.direction}`}><p>{message.body}</p><time>{formatTime(message.timestamp)}</time></div>)}</div><div className="case-summary"><div><span className="eyebrow">Resumo da triagem</span><div className="answer-list">{Object.keys(lead.answers).length === 0 ? <span className="muted">Ainda não há respostas registradas.</span> : Object.entries(lead.answers).map(([key, value]) => <span key={key}><b>{key}</b>{value}</span>)}</div></div><div className="conversation-actions"><button onClick={() => void onStatus('active')} className="primary-action">Assumir atendimento</button><button onClick={() => void onStatus('closed')} className="secondary-action">Encerrar</button></div></div></div>; }
function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="empty-state"><span className="empty-line" /><strong>{title}</strong><p>{detail}</p></div>; }
function formatTime(value: string) { return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
