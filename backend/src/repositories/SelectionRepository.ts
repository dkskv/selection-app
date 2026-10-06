import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { generateKeyBetween } from 'fractional-indexing';
import { DomainError } from '../errors.js';

/** Управляет выбором элементов и их порядком. */
export class SelectionRepository {
  private readonly statements: {
    /** Возвращает все записи выбора в порядке позиций. */
    findAll: StatementSync;
    /** Добавляет выбранный элемент с указанной позицией. */
    insert: StatementSync;
    /** Удаляет выбор элемента по его ID. */
    delete: StatementSync;
    /** Возвращает последнюю позицию для добавления нового элемента в конец. */
    findLast: StatementSync;
    /** Возвращает позицию элемента по ID, если он выбран. */
    findById: StatementSync;
    /** Возвращает первую позицию, исключая перемещаемый элемент. */
    findFirst: StatementSync;
    /** Возвращает ближайшую позицию после указанной, исключая перемещаемый элемент. */
    findNextAfter: StatementSync;
    /** Сохраняет новую позицию выбранного элемента по его ID. */
    updatePosition: StatementSync;
  };

  constructor(database: DatabaseSync) {
    this.statements = {
      findAll: database.prepare(
        'SELECT item_id, position FROM selection ORDER BY position COLLATE BINARY',
      ),
      insert: database.prepare(
        'INSERT INTO selection (item_id, position) VALUES (?, ?)',
      ),
      delete: database.prepare('DELETE FROM selection WHERE item_id = ?'),
      findLast: database.prepare(
        'SELECT position FROM selection ORDER BY position COLLATE BINARY DESC LIMIT 1',
      ),
      findById: database.prepare(
        'SELECT position FROM selection WHERE item_id = ?',
      ),
      findFirst: database.prepare(`
        SELECT position FROM selection WHERE item_id != ?
        ORDER BY position COLLATE BINARY LIMIT 1
      `),
      findNextAfter: database.prepare(`
        SELECT position FROM selection
        WHERE item_id != ? AND position COLLATE BINARY > ?
        ORDER BY position COLLATE BINARY LIMIT 1
      `),
      updatePosition: database.prepare(
        'UPDATE selection SET position = ? WHERE item_id = ?',
      ),
    };
  }

  /** Возвращает выбранные ID и позиции в порядке выбора. */
  async findAll(): Promise<{ itemId: number; position: string }[]> {
    return this.statements.findAll.all().map((row) => ({
      itemId: Number(row.item_id),
      position: String(row.position),
    }));
  }

  /** Выбирает элемент, добавляя его в конец. */
  async select(itemId: number): Promise<void> {
    const last = this.statements.findLast.get();

    const position = generateKeyBetween(
      last ? String(last.position) : null,
      null,
    );

    this.statements.insert.run(itemId, position);
  }

  /** Снимает выбор элемента. */
  async deselect(itemId: number): Promise<void> {
    this.statements.delete.run(itemId);
  }

  /** Перемещает выбранный элемент после afterId; явный null означает начало. */
  async reorder(itemId: number, afterId: number | null): Promise<void> {
    if (itemId === afterId) {
      throw new DomainError(`Item ${itemId} cannot be moved after itself`);
    }

    if (!this.statements.findById.get(itemId)) {
      throw new DomainError(`Item ${itemId} must be selected before it can be moved`);
    }

    let left: string | null = null;

    if (afterId !== null) {
      const after = this.statements.findById.get(afterId);

      if (!after) {
        throw new DomainError(`Item ${afterId} must be selected to move item ${itemId} after it`);
      }

      left = String(after.position);
    }

    // Перемещаемый элемент исключается из поиска соседей на новом месте.
    const next =
      left === null
        ? this.statements.findFirst.get(itemId)
        : this.statements.findNextAfter.get(itemId, left);

    const right = next ? String(next.position) : null;

    this.statements.updatePosition.run(generateKeyBetween(left, right), itemId);
  }
}
