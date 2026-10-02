import type { DatabaseSync, StatementSync } from 'node:sqlite';

export type Item = { id: number };

export type PaginationParams = { limit?: number; offset?: number };

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
        LIMIT ? OFFSET ?
      `),
      findUnselected: database.prepare(`
        SELECT items.id FROM items
        LEFT JOIN selection ON selection.item_id = items.id
        WHERE selection.item_id IS NULL
        ORDER BY items.id
        LIMIT ? OFFSET ?
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

  /** Возвращает выбранные элементы в порядке позиций с limit и offset. */
  async findSelected({ limit, offset = 0 }: PaginationParams = {}): Promise<
    Item[]
  > {
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0)) {
      throw new RangeError(
        'limit должен быть неотрицательным безопасным целым числом',
      );
    }

    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw new RangeError(
        'offset должен быть неотрицательным безопасным целым числом',
      );
    }

    return this.statements.findSelected
      .all(limit ?? -1, offset)
      .map((row) => ({ id: Number(row.id) }));
  }

  /** Возвращает невыбранные элементы по возрастанию ID с limit и offset. */
  async findUnselected({ limit, offset = 0 }: PaginationParams = {}): Promise<
    Item[]
  > {
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0)) {
      throw new RangeError(
        'limit должен быть неотрицательным безопасным целым числом',
      );
    }

    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw new RangeError(
        'offset должен быть неотрицательным безопасным целым числом',
      );
    }

    return this.statements.findUnselected
      .all(limit ?? -1, offset)
      .map((row) => ({ id: Number(row.id) }));
  }
}
