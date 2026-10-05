import type { DatabaseSync, StatementSync } from 'node:sqlite';

export type Item = { id: number };

export type ItemsQueryParams = {
  limit?: number;
  offset?: number;
  idPrefixFilter?: string;
};

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
        WHERE CAST(items.id AS TEXT) LIKE ?
        ORDER BY selection.position COLLATE BINARY
        LIMIT ? OFFSET ?
      `),
      findUnselected: database.prepare(`
        SELECT items.id FROM items
        LEFT JOIN selection ON selection.item_id = items.id
        WHERE selection.item_id IS NULL AND CAST(items.id AS TEXT) LIKE ?
        ORDER BY items.id
        LIMIT ? OFFSET ?
      `),
    };
  }

  /** Создаёт элемент с указанным ID. */
  async create(id: number): Promise<void> {
    this.statements.insert.run(id);
  }

  /** Возвращает выбранные элементы в порядке позиций с limit и offset. */
  async findSelected({
    limit,
    offset = 0,
    idPrefixFilter = '',
  }: ItemsQueryParams = {}): Promise<Item[]> {
    return this.statements.findSelected
      .all(`${idPrefixFilter}%`, limit ?? -1, offset)
      .map((row) => ({ id: Number(row.id) }));
  }

  /** Возвращает невыбранные элементы по возрастанию ID с limit и offset. */
  async findUnselected({
    limit,
    offset = 0,
    idPrefixFilter = '',
  }: ItemsQueryParams = {}): Promise<Item[]> {
    return this.statements.findUnselected
      .all(`${idPrefixFilter}%`, limit ?? -1, offset)
      .map((row) => ({ id: Number(row.id) }));
  }
}
