# Power-WA — Plano de implementação do hub de triagem

## Objetivo

Construir um hub simples para receber novos leads do WhatsApp via OpenWA, identificar o primeiro contato, aplicar uma triagem configurável e encaminhar o lead para atendimento humano, sem substituir o gateway OpenWA nem expor credenciais no frontend.

## Arquitetura

O OpenWA permanece como serviço self-hosted separado. O Power-WA terá um backend próprio que recebe webhooks `message.received`, verifica a assinatura HMAC sobre o corpo bruto, deduplica pelo `delivery.idempotencyKey`, persiste o lead/conversa e executa uma máquina de estados determinística para a triagem. O frontend acessa somente o backend do Power-WA; a API key do OpenWA e o segredo HMAC ficam exclusivamente no servidor/configuração segura.

A primeira integração será por webhook + API REST do OpenWA. A instalação de plugin não será necessária para o MVP. Um plugin futuro poderá ser considerado apenas se houver necessidade de processamento dentro do gateway; nesse caso, deverá declarar apenas as permissões mínimas, ser revisado e instalado desabilitado.

Fluxo principal:

1. OpenWA envia `message.received` para `POST /api/webhooks/openwa`.
2. O servidor verifica `X-OpenWA-Signature` em constant-time usando `OPENWA_WEBHOOK_SECRET`.
3. O corpo verificado é validado, e o evento é deduplicado por `idempotencyKey`.
4. Se o remetente não possuir conversa anterior, o lead é criado com estado `new` e fila de triagem.
5. A máquina de estados envia uma pergunta configurada por vez e registra a resposta.
6. Ao concluir ou atingir uma condição de handoff, o lead passa para `human_review`, recebe uma etiqueta lógica de origem e fica visível na fila do escritório.
7. O operador visualiza a conversa, o resumo da triagem e pode assumir, pausar, reabrir ou concluir o atendimento.

A marcação inicial deve ser modelada no Power-WA como estado/etiqueta persistente. A sincronização com listas/labels do WhatsApp será um adaptador explícito posterior, porque não deve ser presumida sem validar a API/versão de OpenWA instalada.

## Escopo do MVP

- Dashboard com fila de leads: novos, em triagem, aguardando humano, em atendimento e encerrados.
- Busca e filtros por estado, origem, assunto informado e data de entrada.
- Tela de conversa com mensagens, estado da triagem, respostas coletadas e ações do operador.
- Editor de regras de triagem com perguntas, opções, mensagens de fallback, horário de atendimento e mensagem de handoff.
- Endpoint de webhook OpenWA com HMAC, idempotência, validação de payload e resposta rápida somente após aceitação segura.
- Cliente server-side para enviar respostas pelo OpenWA com chave dedicada e escopo mínimo.
- Logs estruturados sem corpo de mensagens, tokens, QR codes, cookies ou segredos.
- `.env.example` apenas com nomes e valores fictícios.

Fora do primeiro corte: IA generativa autônoma, leitura de histórico antigo para inferências, sincronização automática com CRM, múltiplas sessões complexas, autenticação pública multiusuário e instalação automática de plugins.

## Estrutura proposta

- `server/` — API, configuração, cliente OpenWA, verificação de webhook e serviços de triagem.
- `server/routes/` — rotas HTTP do webhook e operações do painel.
- `server/services/` — máquina de estados, idempotência e handoff.
- `server/lib/` — validação, HMAC, logging redigido e abstrações OpenWA.
- `client/` — painel web do operador.
- `client/components/` — fila, conversa, resumo e configurações.
- `shared/` — tipos e schemas compartilhados.
- `tests/` — testes unitários de segurança e regras de triagem.
- `public/manus-routes.json` — manifesto de rotas do frontend.
- `.env.example` — nomes de configuração sem segredos reais.
- `TODO.md` — resultados e critérios de aceite preservados.

## Sistema visual

### Design Read

- Artefato: dashboard operacional responsivo.
- Público: equipe de atendimento de um escritório de advocacia.
- Linguagem visual: editorial de informação + ferramenta profissional de operações.
- Modo: greenfield.
- Variância visual: 3/10.
- Intensidade de movimento: 2/10.
- Densidade de informação: 8/10.
- Dependência de assets: 1/10.
- Fidelidade de marca: 4/10, até receber identidade visual do escritório.

### Direções consideradas

- **Arquivo Cívico** (0,06): marfim, azul-petróleo e tipografia editorial, com sensação institucional e calma.
- **Terminal de Atendimento** (0,07): carvão, cinza quente e um único âmbar funcional, com alta densidade e foco em operação.
- **Clareza Clínica** (0,05): branco suave, verde-azulado e divisórias finas, priorizando legibilidade e baixa carga cognitiva.

### Direção escolhida: Terminal de Atendimento

**Movimento de design:** uma central de operações inspirada em consoles profissionais, sem estética hacker. A interface deve tornar o estado de cada lead evidente em menos de um olhar.

**Princípios:** hierarquia por estado; texto primeiro; ações reversíveis e explícitas; densidade sem ruído.

**Paleta:** fundo carvão profundo para a navegação e cabeçalho; superfícies grafite; texto osso; bordas cinza-ardósia; âmbar queimado como marca de atenção e ação; verde dessaturado apenas para sucesso; vermelho ferrugem apenas para risco/erro.

**Layout:** navegação lateral estreita, fila de leads ocupando a coluna principal esquerda e conversa/contexto em painel adjacente. Em telas menores, a fila vira uma camada navegável e a conversa ocupa a tela inteira.

**Elementos de assinatura:** marcador vertical fino para estado, chips monoespaçados para origem/tempo, cabeçalhos com pequenas legendas de seção e separadores horizontais firmes.

**Interação:** mudanças de estado têm confirmação textual e feedback imediato. O botão de assumir atendimento é sempre visível na conversa; ações destrutivas exigem segunda confirmação. Sem animações decorativas; apenas transições curtas de seleção e carregamento.

**Tipografia:** IBM Plex Sans para interface e IBM Plex Mono para horários, identificadores e estados. Títulos com peso forte e tracking levemente compacto; corpo em 14–16px, nunca abaixo de 13px.

**Marca:** `Power-WA` deve ser tratado como nome de produto de trabalho, não como identidade final do escritório. O logo real do escritório será incorporado quando fornecido; não será inventado um logo falso.

## Segurança e configuração

- Nunca colocar API key OpenWA, segredo HMAC, cookies, QR ou tokens em código, logs, frontend, testes, commits ou documentação.
- Usar `OPENWA_BASE_URL`, `OPENWA_API_KEY`, `OPENWA_WEBHOOK_SECRET`, `OPENWA_SESSION_ID` e `DATABASE_URL` apenas no servidor.
- A chave OpenWA do Power-WA deve ser não-admin e restrita à sessão necessária; operações de plugin continuam exigindo uma chave admin separada, usada apenas por operador durante instalação/configuração.
- Validar assinatura antes de parsear/confiar no evento; usar comparação em tempo constante.
- Deduplicar por `idempotencyKey` do JSON assinado; nunca por header espelho.
- Não logar texto de mensagens ou respostas por padrão.
- Toda resposta automática deve ser derivada de configuração determinística e ter limites de tempo/volume.

## Entrega técnica inicial

Stack recomendada: TypeScript, React/Vite para o painel, Fastify ou Express para API e SQLite para o primeiro ambiente, com uma camada de persistência substituível. A escolha final deve seguir o toolchain que for mais econômico e transparente para o repositório greenfield.

A primeira implementação deverá incluir testes para assinatura HMAC válida/inválida, idempotência, primeiro contato, transição para handoff e ausência de segredos no bundle do cliente.
