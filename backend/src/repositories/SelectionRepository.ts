import type { DatabaseSync, StatementSync } from 'node:sqlite';

export class SelectionRepository {
  private readonly insert: StatementSync;
  private readonly remove: StatementSync;

  constructor(database: DatabaseSync) {
    this.insert = database.prepare(
      'INSERT INTO selection (item_id) VALUES (?)',
    );

    this.remove = database.prepare('DELETE FROM selection WHERE item_id = ?');
  }

  async select(itemId: number): Promise<void> {
    if (!Number.isSafeInteger(itemId)) {
      throw new TypeError('ID должен быть безопасным целым числом');
    }

    this.insert.run(itemId);
  }

  async deselect(itemId: number): Promise<void> {
    this.remove.run(itemId);
  }
}
