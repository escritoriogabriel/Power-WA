import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config.js';

export function requireOperator(req: Request, res: Response, next: NextFunction): void {
  if (!config.operatorToken) { res.status(503).json({ error: 'Token de operador não configurado' }); return; }
  const received = req.header('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const expected = Buffer.from(config.operatorToken, 'utf8');
  const actual = Buffer.from(received, 'utf8');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) { res.status(401).json({ error: 'Autenticação necessária' }); return; }
  next();
}
