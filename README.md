# Power-WA

Hub self-hosted para qualificar e organizar novos leads que chegam pelo WhatsApp do escritório.

## Arquitetura

O Power-WA é uma aplicação separada do [OpenWA](https://github.com/rmyndharis/OpenWA). O OpenWA continua responsável pelo gateway/API do WhatsApp. O Power-WA recebe `message.received` por webhook, verifica HMAC, deduplica entregas e executa uma triagem determinística configurável. A API key do OpenWA é usada apenas no servidor para enviar respostas; o navegador nunca recebe essa credencial.

O MVP não instala plugins e não usa IA generativa para responder automaticamente. Isso deixa a lógica de atendimento auditável e reduz o risco de promessas indevidas em um contexto jurídico. A integração com labels/listas nativas do WhatsApp ainda deve ser tratada como adaptador posterior, depois de validar a versão concreta do OpenWA em produção.

## Executar

```bash
cp .env.example .env
npm install
npm run dev
```

O painel local fica em `http://localhost:5173` e a API em `http://localhost:3000`.

Para produção, preencha os valores reais no gerenciador de segredos/configuração do ambiente. Nunca coloque uma API key, segredo HMAC, QR code, cookie ou token no frontend, em commits ou em logs.

O painel exige `POWER_WA_OPERATOR_TOKEN`. O operador informa esse valor na tela de login; ele é enviado em `Authorization: Bearer` apenas nas chamadas da sessão atual e não é embutido no bundle. Em produção, mantenha o serviço atrás de HTTPS e de uma rede privada ou reverse proxy com controles adicionais de acesso.

## Webhook OpenWA

Configure o OpenWA para enviar `message.received` para:

```text
https://seu-dominio.example/api/webhooks/openwa
```

Defina um segredo longo e aleatório no webhook e use o mesmo valor em `OPENWA_WEBHOOK_SECRET`. O endpoint verifica `X-OpenWA-Signature` sobre o corpo bruto, usa `delivery.idempotencyKey` do JSON assinado e responde `2xx` somente depois de aceitar a entrega.

## Estado atual

A persistência padrão é um arquivo JSON local com permissões restritas, adequado para um primeiro ambiente controlado. A camada está isolada em `server/lib/store.ts` para permitir migração posterior para SQLite/PostgreSQL sem alterar o fluxo do painel. O arquivo de dados é ignorado pelo Git.
