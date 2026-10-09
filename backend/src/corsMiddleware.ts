import type { RequestHandler } from 'express';
import { config } from './config.js';

/** Разрешает запросы с origin frontend и отвечает на CORS preflight. */
export const corsMiddleware: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;

  if (origin && origin === config.CORS_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', origin);

    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PATCH, DELETE, OPTIONS',
    );

    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);

    return;
  }

  next();
};
