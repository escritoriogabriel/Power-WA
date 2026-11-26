import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  dataFile: process.env.POWER_WA_DATA_FILE ?? './data/power-wa.json',
  operatorToken: process.env.POWER_WA_OPERATOR_TOKEN ?? '',
  openwaBaseUrl: process.env.OPENWA_BASE_URL ?? '',
  openwaApiKey: process.env.OPENWA_API_KEY ?? '',
  openwaWebhookSecret: process.env.OPENWA_WEBHOOK_SECRET ?? '',
  openwaSessionId: process.env.OPENWA_SESSION_ID ?? '',
  openwaPublicUrl: process.env.OPENWA_PUBLIC_URL ?? '',
  openwaSessionName: process.env.OPENWA_SESSION_NAME ?? 'power-wa'
};

export function hasOpenwaConfig(): boolean {
  return Boolean(config.openwaBaseUrl && config.openwaApiKey && config.openwaSessionId);
}
