import type { DatabaseSync, StatementSync } from 'node:sqlite';

export type Item = { id: number };

/** Хранит элементы и получает списки по состоянию выбора. */
export class ItemsRepository {
  private readonly statements: {
    insert: StatementSync;
    findSelected: StatementSync;
    findUnselected: StatementSync;
  };

  constructor(database: DatabaseSync) {
    this.statements = {
      insert: database.prepare('INSERT INTO items (id) VALUES (?)'),
      findSelected: database.prepare(`
        SELECT items.id FROM items
        INNER JOIN selection ON selection.item_id = items.id
        ORDER BY selection.position COLLATE BINARY
      `),
      findUnselected: database.prepare(`
        SELECT items.id FROM items
        LEFT JOIN selection ON selection.item_id = items.id
        WHERE selection.item_id IS NULL
        ORDER BY items.id
      `),
    };
  }

  /** Создаёт элемент с указанным ID. */
  async create(id: number): Promise<void> {
    if (!Number.isSafeInteger(id)) {
      throw new TypeError('ID должен быть безопасным целым числом');
    }

    this.statements.insert.run(id);
  }

  /** Возвращает выбранные элементы в порядке позиций. */
  async findSelected(): Promise<Item[]> {
    return this.statements.findSelected
      .all()
      .map((row) => ({ id: Number(row.id) }));
  }

  /** Возвращает невыбранные элементы по возрастанию ID. */
  async findUnselected(): Promise<Item[]> {
    return this.statements.findUnselected
      .all()
      .map((row) => ({ id: Number(row.id) }));
  }
}
