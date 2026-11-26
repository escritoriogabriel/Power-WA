import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { api, openwaWebhook } from './routes/api.js';
import { config } from './lib/config.js';

const app = express();
app.disable('x-powered-by');
app.use('/api/webhooks/openwa', express.raw({ type: 'application/json', limit: '256kb' }), openwaWebhook);
app.use(express.json({ limit: '256kb' }));
app.use('/api', api);

const clientRoot = join(process.cwd(), 'dist/client');
if (existsSync(clientRoot)) {
  app.use(express.static(clientRoot));
  app.use((_req, res) => res.sendFile(join(clientRoot, 'index.html')));
}

app.listen(config.port, '0.0.0.0', () => console.info(JSON.stringify({ event: 'server_started', port: config.port })));
