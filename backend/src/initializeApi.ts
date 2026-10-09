import type { Express } from 'express';
import { config } from './config.js';
import { createDatabase } from './database.js';
import { ItemsRepository } from './repositories/ItemsRepository.js';
import { SelectionRepository } from './repositories/SelectionRepository.js';
import { createRequestBatcher } from './requestBatching.js';
import { registerApiRoutes } from './registerApiRoutes.js';

/** Создаёт хранилище и зависимости API, затем регистрирует его маршруты. */
export const initializeApi = async (app: Express): Promise<void> => {
  const database = createDatabase();

  const itemsRepository = new ItemsRepository(database);
  const selectionRepository = new SelectionRepository(database);

  const requestBatcher = createRequestBatcher(1000);
  const createItemBatcher = createRequestBatcher(10_000);

  for (let id = 1; id <= config.INITIAL_ITEMS_COUNT; id++) {
    await itemsRepository.create(id);
  }

  registerApiRoutes(app, {
    itemsRepository,
    selectionRepository,
    requestBatcher,
    createItemBatcher,
  });
};
