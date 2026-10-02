import type { DatabaseSync, StatementSync } from 'node:sqlite';

export type Item = { id: number };

export class ItemsRepository {
  private readonly insert: StatementSync;
  private readonly selectSelected: StatementSync;
  private readonly selectUnselected: StatementSync;

  constructor(database: DatabaseSync) {
    this.insert = database.prepare('INSERT INTO items (id) VALUES (?)');

    this.selectSelected = database.prepare(`
      SELECT items.id FROM items
      INNER JOIN selection ON selection.item_id = items.id
      ORDER BY items.id
    `);

    this.selectUnselected = database.prepare(`
      SELECT items.id FROM items
      LEFT JOIN selection ON selection.item_id = items.id
      WHERE selection.item_id IS NULL
      ORDER BY items.id
    `);
  }

  async create(id: number): Promise<void> {
    if (!Number.isSafeInteger(id)) {
      throw new TypeError('ID должен быть безопасным целым числом');
    }

    this.insert.run(id);
  }

  async findSelected(): Promise<Item[]> {
    return this.selectSelected.all().map((row) => ({ id: Number(row.id) }));
  }

  async findUnselected(): Promise<Item[]> {
    return this.selectUnselected.all().map((row) => ({ id: Number(row.id) }));
  }
}
