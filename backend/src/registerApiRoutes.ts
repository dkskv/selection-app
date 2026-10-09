import express, { type Express } from 'express';
import type { ItemsRepository } from './repositories/ItemsRepository.js';
import type { SelectionRepository } from './repositories/SelectionRepository.js';
import { createRequestBatcher, runBatchedRequest } from './requestBatching.js';
import {
  createItemBodySchema,
  itemUrlParamsSchema,
  itemsQuerySchema,
  reorderBodySchema,
  selectItemBodySchema,
} from './schemas.js';

type ApiDependencies = {
  itemsRepository: ItemsRepository;
  selectionRepository: SelectionRepository;
  requestBatcher: ReturnType<typeof createRequestBatcher>;
  createItemBatcher: ReturnType<typeof createRequestBatcher>;
};

/** Регистрирует middleware и REST-маршруты API приложения. */
export const registerApiRoutes = (
  app: Express,
  {
    itemsRepository,
    selectionRepository,
    requestBatcher,
    createItemBatcher,
  }: ApiDependencies,
): void => {
  app.use(express.json());

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
};
