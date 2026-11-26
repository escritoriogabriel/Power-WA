# Configuração completa do Power-WA + OpenWA

Este projeto não substitui o OpenWA. O OpenWA é o gateway que mantém a sessão do WhatsApp; o Power-WA é o painel e a lógica de triagem que consome a API e os webhooks dele.

## De onde vem cada variável

### `OPENWA_BASE_URL`

É o endereço do gateway OpenWA, sem o sufixo `/api`.

Se o OpenWA estiver na mesma máquina do Power-WA:

```text
http://127.0.0.1:2785
```

Se estiver em outro servidor:

```text
https://openwa.seu-dominio.com
```

A porta padrão oficial do OpenWA é `2785`.

### `OPENWA_API_KEY`

É uma chave criada pelo próprio OpenWA. Na primeira inicialização, o OpenWA grava a chave inicial em `data/.api-key` no modo executado diretamente ou em `/app/data/.api-key` dentro do container Docker. Por padrão, ela é aleatória e tem o formato `owa_k1_` seguido de 64 caracteres hexadecimais. Se `API_MASTER_KEY` tiver sido definido no ambiente do OpenWA, esse valor é usado como chave inicial; `ALLOW_DEV_API_KEY=true` cria `dev-admin-key` apenas para desenvolvimento local.

Depois de iniciar o OpenWA, leia a chave sem exibi-la em logs:

```bash
docker exec openwa-api cat /app/data/.api-key
```

O comando deve retornar a chave completa. Não use uma chave parcial, o `keyPrefix` exibido na listagem, `owa_k1_example_only` ou o nome do arquivo. Se o OpenWA tiver sido iniciado com outro nome de container, substitua `openwa-api` pelo nome correto.

Também é possível abrir o dashboard do OpenWA em `http://127.0.0.1:2785`, entrar em **API Keys**, criar uma chave com role `operator` e copiar o valor completo no momento da criação. A chave completa é exibida somente uma vez. Para produção, não use a chave administrativa como integração permanente; crie uma chave `operator`, sem `allowedChats`, e limite-a à sessão depois que o ID da sessão for conhecido.

No Windows CMD, valide a chave sem colocá-la no código:

```bat
curl http://127.0.0.1:2785/api/sessions -H "X-API-Key: SUA_CHAVE_COMPLETA"
```

Se a chave estiver correta, o OpenWA responderá com uma lista JSON. Se responder `Invalid API key`, a chave não pertence à instância/volume do OpenWA que está rodando. Leia novamente a chave do container correto ou crie uma nova no dashboard.

### `OPENWA_SESSION_NAME`

Não é uma credencial e não é fornecido pelo OpenWA. É um nome escolhido pelo operador para identificar a conta conectada. Use, por exemplo:

```text
power-wa
```

O nome deve ter entre 3 e 50 caracteres, usando letras, números e hífens. O Power-WA cria a sessão automaticamente no primeiro clique em **Criar e conectar WhatsApp**.

### `OPENWA_SESSION_ID`

É opcional na primeira configuração. O OpenWA gera o ID quando a sessão é criada. O Power-WA persiste esse ID no arquivo local de dados depois da criação. Só preencha manualmente se uma sessão já existir e você quiser apontar o Power-WA para ela.

### `OPENWA_WEBHOOK_SECRET`

É um segredo novo, criado para assinar as entregas do webhook. Não vem do OpenWA. O script de setup gera um valor aleatório com 32 bytes. O Power-WA envia esse valor ao registrar o webhook e valida a assinatura HMAC de todas as mensagens recebidas.

### `OPENWA_PUBLIC_URL`

É a URL HTTPS pública do Power-WA, não a URL do OpenWA. O OpenWA precisa conseguir fazer uma requisição HTTP para:

```text
https://seu-dominio.com/api/webhooks/openwa
```

`localhost`, `127.0.0.1` e URLs HTTP privadas não servem para um OpenWA hospedado em outro lugar. Em produção, use um domínio com TLS/reverse proxy. Em desenvolvimento, use um túnel HTTPS temporário, sabendo que ele não é adequado para operação contínua.

## Setup local recomendado

Pré-requisito: Docker Engine/Desktop, Node.js e npm.

1. Na pasta do projeto, execute:

```bash
./scripts/setup-openwa.sh
```

O script inicia o container oficial `rmyndharis/openwa:latest`, cria o diretório persistente `.openwa-data`, lê a API key dentro do container sem imprimi-la e grava apenas o `.env` local com permissões restritas.

2. Inicie o Power-WA:

```bash
npm install
npm run dev
```

3. Abra o painel, use o `POWER_WA_OPERATOR_TOKEN` do `.env` e clique em **Criar e conectar WhatsApp**.

4. Escaneie o QR mostrado no painel pelo celular em **WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho**.

5. Depois que o estado aparecer como `ready`, o Power-WA passa a usar essa sessão para enviar as perguntas da triagem.

### Windows CMD sem Docker Bash

O OpenWA oficial recomenda Docker para a instalação rápida. No CMD, os comandos equivalentes são:

```bat
docker ps
docker exec openwa-api cat /app/data/.api-key
curl http://127.0.0.1:2785/api/health
```

Copie a saída do segundo comando para `OPENWA_API_KEY` no `.env` do Power-WA, sem aspas extras e sem espaços. Se você montou outro diretório de dados ou usou outro container, a chave precisa ser lida da mesma instância que atende `127.0.0.1:2785`; uma chave de uma instalação antiga ou de outro volume resulta em `Invalid API key`.

## Webhook

Para mensagens recebidas, defina `OPENWA_PUBLIC_URL` antes de iniciar o Power-WA. Quando a sessão chegar a `ready`, o Power-WA registra automaticamente o webhook no OpenWA com os eventos `message.received` e `session.status`.

O endpoint recebe apenas o webhook público. A API key OpenWA e o segredo HMAC permanecem no servidor e nunca são enviados ao navegador.

## Limitação atual deste ambiente Manus

O ambiente de execução usado para desenvolver o repositório não possui Docker instalado nem um domínio público permanente. Por isso não é possível ligar uma conta WhatsApp real aqui sem que o OpenWA seja executado no seu computador, em um servidor próprio ou em uma hospedagem persistente. O código e o script acima deixam o setup reproduzível no ambiente que você escolher.

## Fontes oficiais

- [OpenWA Quick Start](https://docs.open-wa.org/getting-started/quick-start)
- [OpenWA Installation](https://docs.open-wa.org/getting-started/installation)
- [OpenWA Sessions](https://docs.open-wa.org/guides/sessions)
- [OpenWA Webhooks](https://docs.open-wa.org/guides/webhooks)
- [OpenWA Authentication](https://docs.open-wa.org/guides/authentication)
