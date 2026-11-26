# Power-WA — Entregas

- [x] **Integração segura com OpenWA:** receber `message.received` em `POST /api/webhooks/openwa`, validar HMAC no corpo bruto, rejeitar assinaturas inválidas e deduplicar por `delivery.idempotencyKey`; nenhuma chave, segredo, QR code, cookie ou token pode aparecer em código, frontend, logs, testes, commits ou documentação.
- [x] **Triagem de novos leads:** identificar o primeiro contato, criar o lead, registrar mensagens e executar perguntas configuráveis em ordem; respostas inválidas recebem fallback sem avançar.
- [x] **Handoff humano:** ao finalizar a triagem, marcar o lead como `human_review`, enviar mensagem de encaminhamento e deixar o caso disponível para ação do operador.
- [x] **Painel operacional:** exibir filas por estado, busca, detalhe da conversa, resumo da triagem e ações de assumir/pausar/concluir.
- [x] **Configuração:** permitir consultar e atualizar perguntas, opções e mensagens da triagem sem alterar código.
- [x] **Validação:** `npm run check`, `npm test`, `npm run build` e smoke test HTTP executados com sucesso.
