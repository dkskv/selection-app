import express from 'express';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './database.js';
import { ItemsRepository } from './repositories/ItemsRepository.js';
import { SelectionRepository } from './repositories/SelectionRepository.js';
import {
  createItemSchema,
  itemParamsSchema,
  itemsQuerySchema,
  reorderSchema,
  selectItemSchema,
} from './schemas.js';

const database = createDatabase();
const itemsRepository = new ItemsRepository(database);
const selectionRepository = new SelectionRepository(database);

for (let id = 1; id <= 1000; id++) {
  await itemsRepository.create(id);
}

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
  const pagination = itemsQuerySchema.parse(req.query);

  res.json(await itemsRepository.findUnselected(pagination));
});

app.get('/api/items/selected', async (req, res) => {
  const pagination = itemsQuerySchema.parse(req.query);

  res.json(await itemsRepository.findSelected(pagination));
});

app.post('/api/items', async (req, res) => {
  const { id } = createItemSchema.parse(req.body);

  await itemsRepository.create(id);

  res.status(201).json({ id });
});

app.post('/api/selection', async (req, res) => {
  const { itemId } = selectItemSchema.parse(req.body);

  await selectionRepository.select(itemId);

  res.status(204).end();
});

app.delete('/api/selection/:itemId', async (req, res) => {
  const { itemId } = itemParamsSchema.parse(req.params);

  await selectionRepository.deselect(itemId);

  res.status(204).end();
});

app.patch('/api/selection/:itemId', async (req, res) => {
  const { itemId } = itemParamsSchema.parse(req.params);

  const { afterId } = reorderSchema.parse(req.body);

  await selectionRepository.reorder(itemId, afterId);

  res.status(204).end();
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(express.static(frontendDist));

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
