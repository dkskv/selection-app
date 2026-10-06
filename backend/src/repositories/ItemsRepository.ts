import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { DomainError } from '../errors.js';
import { BaseRepository } from './BaseRepository.js';

export type Item = { id: number };

export type ItemsQueryParams = {
  limit?: number;
  offset?: number;
  idPrefixFilter?: string;
};

/** Хранит элементы и получает списки по состоянию выбора. */
export class ItemsRepository extends BaseRepository {
  private readonly statements: {
    insert: StatementSync;
    exists: StatementSync;
    findSelected: StatementSync;
    findUnselected: StatementSync;
  };

  constructor(database: DatabaseSync) {
    super(database);

    this.statements = {
      insert: database.prepare('INSERT INTO items (id) VALUES (?)'),
      exists: database.prepare('SELECT 1 FROM items WHERE id = ?'),
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
    this.withTransaction(() => {
      if (this.statements.exists.get(id)) {
        throw new DomainError(`An item with ID ${id} already exists`);
      }

      this.statements.insert.run(id);
    });
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
