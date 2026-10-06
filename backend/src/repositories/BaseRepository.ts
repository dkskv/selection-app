import type { DatabaseSync } from 'node:sqlite';

/** Общая основа репозиториев с поддержкой транзакций. */
export abstract class BaseRepository {
  protected readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  /** Выполняет синхронную операцию атомарно. */
  protected withTransaction<Result>(action: () => Result): Result {
    this.database.exec('BEGIN IMMEDIATE');

    try {
      const result = action();

      this.database.exec('COMMIT');

      return result;
    } catch (error) {
      try {
        this.database.exec('ROLLBACK');
      } catch {
        // Сохраняем исходную ошибку, даже если откат завершился ошибкой.
      }

      throw error;
    }
  }
}
