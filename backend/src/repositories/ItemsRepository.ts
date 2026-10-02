import type { DatabaseSync, StatementSync } from 'node:sqlite';

export class ItemsRepository {
  private readonly insert: StatementSync;
  private readonly select: StatementSync;

  constructor(database: DatabaseSync) {
    this.insert = database.prepare('INSERT INTO items (id) VALUES (?)');

    this.select = database.prepare('SELECT id FROM items ORDER BY id');
  }

  create(id: number): void {
    if (!Number.isSafeInteger(id)) {
      throw new TypeError('ID должен быть безопасным целым числом');
    }

    this.insert.run(id);
  }

  findMany(): { id: number }[] {
    return this.select.all().map((row) => ({ id: Number(row.id) }));
  }
}
