import express from 'express';
import { readFileSync } from 'node:fs';
import { createSecureServer } from 'node:http2';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { createDatabase } from './database.js';
import { ItemsRepository } from './repositories/ItemsRepository.js';
import { SelectionRepository } from './repositories/SelectionRepository.js';
import { createRequestBatcher, runBatchedRequest } from './requestBatching.js';
import {
  createItemBodySchema,
  itemUrlParamsSchema,
  itemsQuerySchema,
  reorderBodySchema,
  selectItemBodySchema,
} from './schemas.js';

const require = createRequire(import.meta.url);

const http2Express = require('http2-express') as (
  expressFactory: typeof express,
) => ReturnType<typeof express>;

const app = http2Express(express);
const port = Number(process.env.PORT ?? 3000);

const frontendDist = fileURLToPath(
  new URL('../../frontend/dist/', import.meta.url),
);

/** Обрабатывает CORS между dev-сервером Vite и backend, включая preflight-запросы. */
app.use((req, res, next) => {
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
});

app.use(express.json());

/** Инициализирует хранилище и зависимости REST-эндпоинтов. */
const {
  itemsRepository,
  selectionRepository,
  requestBatcher,
  createItemBatcher,
} = await (async function init() {
  const database = createDatabase();
  const itemsRepository = new ItemsRepository(database);
  const selectionRepository = new SelectionRepository(database);
  const requestBatcher = createRequestBatcher(1000);
  const createItemBatcher = createRequestBatcher(10_000);

  for (let id = 1; id <= config.INITIAL_ITEMS_COUNT; id++) {
    await itemsRepository.create(id);
  }

  return {
    itemsRepository,
    selectionRepository,
    requestBatcher,
    createItemBatcher,
  };
})();

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/items/unselected', async (req, res) => {
  await runBatchedRequest(
    req,
    res,
    async () => {
      const pagination = itemsQuerySchema.parse(req.query);

      return { body: await itemsRepository.findUnselected(pagination) };
    },
    requestBatcher,
  );
});

app.get('/api/items/selected', async (req, res) => {
  await runBatchedRequest(
    req,
    res,
    async () => {
      const pagination = itemsQuerySchema.parse(req.query);

      return { body: await itemsRepository.findSelected(pagination) };
    },
    requestBatcher,
  );
});

app.post('/api/items', async (req, res) => {
  await runBatchedRequest(
    req,
    res,
    async () => {
      const { id } = createItemBodySchema.parse(req.body);

      await itemsRepository.create(id);

      return { status: 201, body: { id } };
    },
    createItemBatcher,
  );
});

app.post('/api/selection', async (req, res) => {
  await runBatchedRequest(
    req,
    res,
    async () => {
      const { itemId } = selectItemBodySchema.parse(req.body);

      await selectionRepository.select(itemId);

      return { status: 204 };
    },
    requestBatcher,
  );
});

app.delete('/api/selection/:itemId', async (req, res) => {
  await runBatchedRequest(
    req,
    res,
    async () => {
      const { itemId } = itemUrlParamsSchema.parse(req.params);

      await selectionRepository.deselect(itemId);

      return { status: 204 };
    },
    requestBatcher,
  );
});

app.patch('/api/selection/:itemId', async (req, res) => {
  await runBatchedRequest(
    req,
    res,
    async () => {
      const { itemId } = itemUrlParamsSchema.parse(req.params);
      const { afterId } = reorderBodySchema.parse(req.body);

      await selectionRepository.reorder(itemId, afterId);

      return { status: 204 };
    },
    requestBatcher,
  );
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(express.static(frontendDist));

const backendDir = fileURLToPath(new URL('../', import.meta.url));

const tlsOptions = {
  cert: readFileSync(path.resolve(backendDir, config.TLS_CERT_PATH)),
  key: readFileSync(path.resolve(backendDir, config.TLS_KEY_PATH)),
  allowHTTP1: true,
};

createSecureServer(
  tlsOptions,
  app as unknown as (
    req: import('node:http2').Http2ServerRequest,
    res: import('node:http2').Http2ServerResponse,
  ) => void,
).listen(port, () => {
  console.log(`Server listening on https://localhost:${port}`);
});
