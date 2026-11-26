#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENWA_CONTAINER_NAME="${OPENWA_CONTAINER_NAME:-openwa-api}"
OPENWA_DATA_DIR="${OPENWA_DATA_DIR:-$ROOT_DIR/.openwa-data}"
OPENWA_IMAGE="${OPENWA_IMAGE:-rmyndharis/openwa:latest}"
OPENWA_HOST="${OPENWA_HOST:-127.0.0.1}"
OPENWA_PORT="${OPENWA_PORT:-2785}"
SESSION_NAME="${OPENWA_SESSION_NAME:-power-wa}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não encontrado. Instale o Docker Desktop/Engine e execute este script novamente." >&2
  exit 1
fi
if ! [[ "$SESSION_NAME" =~ ^[A-Za-z0-9-]{3,50}$ ]]; then
  echo "OPENWA_SESSION_NAME deve ter 3–50 caracteres, usando apenas letras, números e hífens." >&2
  exit 1
fi

mkdir -p "$OPENWA_DATA_DIR"
if ! docker inspect "$OPENWA_CONTAINER_NAME" >/dev/null 2>&1; then
  docker run -d --stop-timeout 90 --restart unless-stopped \
    --name "$OPENWA_CONTAINER_NAME" \
    -p "${OPENWA_HOST}:${OPENWA_PORT}:2785" \
    -v "$OPENWA_DATA_DIR:/app/data" \
    "$OPENWA_IMAGE" >/dev/null
elif [ "$(docker inspect -f '{{.State.Running}}' "$OPENWA_CONTAINER_NAME")" != "true" ]; then
  docker start "$OPENWA_CONTAINER_NAME" >/dev/null
fi

for attempt in $(seq 1 60); do
  if curl -fsS "http://${OPENWA_HOST}:${OPENWA_PORT}/api/health" >/dev/null 2>&1; then break; fi
  if [ "$attempt" = 60 ]; then echo "OpenWA não respondeu em http://${OPENWA_HOST}:${OPENWA_PORT}." >&2; exit 1; fi
  sleep 2
done

API_KEY="$(docker exec "$OPENWA_CONTAINER_NAME" cat /app/data/.api-key)"
OPERATOR_TOKEN="${POWER_WA_OPERATOR_TOKEN:-$(openssl rand -hex 32)}"
WEBHOOK_SECRET="${OPENWA_WEBHOOK_SECRET:-$(openssl rand -hex 32)}"

python3 - "$ROOT_DIR/.env" "$API_KEY" "$OPERATOR_TOKEN" "$WEBHOOK_SECRET" "$SESSION_NAME" "$OPENWA_HOST" "$OPENWA_PORT" <<'PY'
from pathlib import Path
import sys

path, api_key, operator_token, webhook_secret, session_name, host, port = sys.argv[1:]
values = {
    "POWER_WA_OPERATOR_TOKEN": operator_token,
    "OPENWA_BASE_URL": f"http://{host}:{port}",
    "OPENWA_API_KEY": api_key,
    "OPENWA_SESSION_NAME": session_name,
    "OPENWA_WEBHOOK_SECRET": webhook_secret,
}
lines = []
existing = {}
file = Path(path)
if file.exists():
    for line in file.read_text().splitlines():
        if line and not line.startswith('#') and '=' in line:
            key, _, value = line.partition('=')
            existing[key] = value
        else:
            lines.append(line)
for key, value in values.items():
    existing[key] = value
for key, value in existing.items():
    if key not in values:
        lines.append(f"{key}={value}")
    else:
        lines.append(f"{key}={value}")
file.write_text('\n'.join(lines).rstrip() + '\n')
file.chmod(0o600)
PY

cat <<'MSG'
OpenWA está rodando e o .env do Power-WA foi configurado.

Próximos passos:
1. Execute `npm run dev` no Power-WA.
2. Abra o painel e informe o POWER_WA_OPERATOR_TOKEN do seu .env.
3. Clique em “Criar e conectar WhatsApp” e escaneie o QR.
4. Para receber mensagens pelo webhook, defina OPENWA_PUBLIC_URL como uma URL HTTPS pública do Power-WA e reinicie o Power-WA.

As credenciais não são exibidas por este script.
MSG
