import express from 'express';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './database.js';
import { ItemsRepository } from './repositories/ItemsRepository.js';
import { SelectionRepository } from './repositories/SelectionRepository.js';
import {
  createRequestBatcher,
  runBatchedRequest,
} from './requestBatching.js';
import {
  createItemSchema,
  itemParamsSchema,
  itemsQuerySchema,
  reorderSchema,
  selectItemSchema,
} from './schemas.js';

/** Инициализирует хранилище и зависимости REST-эндпоинтов. */
const { itemsRepository, selectionRepository, requestBatcher, createItemBatcher } =
  await (async function init() {
    const database = createDatabase();
    const itemsRepository = new ItemsRepository(database);
    const selectionRepository = new SelectionRepository(database);
    const requestBatcher = createRequestBatcher(1000);
    const createItemBatcher = createRequestBatcher(10_000);

    for (let id = 1; id <= 1000; id++) {
      await itemsRepository.create(id);
    }

    return {
      itemsRepository,
      selectionRepository,
      requestBatcher,
      createItemBatcher,
    };
  })();

const app = express();
const port = Number(process.env.PORT ?? 3000);

const frontendDist = fileURLToPath(
  new URL('../../frontend/dist/', import.meta.url),
);

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/items/unselected', async (req, res) => {
  await runBatchedRequest(req, res, async () => {
    const pagination = itemsQuerySchema.parse(req.query);

    return { body: await itemsRepository.findUnselected(pagination) };
  }, requestBatcher);
});

app.get('/api/items/selected', async (req, res) => {
  await runBatchedRequest(req, res, async () => {
    const pagination = itemsQuerySchema.parse(req.query);

    return { body: await itemsRepository.findSelected(pagination) };
  }, requestBatcher);
});

app.post('/api/items', async (req, res) => {
  await runBatchedRequest(
    req,
    res,
    async () => {
      const { id } = createItemSchema.parse(req.body);

      await itemsRepository.create(id);

      return { status: 201, body: { id } };
    },
    createItemBatcher,
  );
});

app.post('/api/selection', async (req, res) => {
  await runBatchedRequest(req, res, async () => {
    const { itemId } = selectItemSchema.parse(req.body);

    await selectionRepository.select(itemId);

    return { status: 204 };
  }, requestBatcher);
});

app.delete('/api/selection/:itemId', async (req, res) => {
  await runBatchedRequest(req, res, async () => {
    const { itemId } = itemParamsSchema.parse(req.params);

    await selectionRepository.deselect(itemId);

    return { status: 204 };
  }, requestBatcher);
});

app.patch('/api/selection/:itemId', async (req, res) => {
  await runBatchedRequest(req, res, async () => {
    const { itemId } = itemParamsSchema.parse(req.params);
    const { afterId } = reorderSchema.parse(req.body);

    await selectionRepository.reorder(itemId, afterId);

    return { status: 204 };
  }, requestBatcher);
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(express.static(frontendDist));

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
