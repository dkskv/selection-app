import express from 'express';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './database.js';
import { ItemsRepository } from './repositories/ItemsRepository.js';

const database = createDatabase();
const itemsRepository = new ItemsRepository(database);

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

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(express.static(frontendDist));

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
