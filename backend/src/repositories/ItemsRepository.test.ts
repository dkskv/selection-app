import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../database.js';
import { ItemsRepository } from './ItemsRepository.js';

describe('ItemsRepository', () => {
  let database: DatabaseSync;
  let repository: ItemsRepository;

  beforeEach(() => {
    database = createDatabase();

    repository = new ItemsRepository(database);
  });

  afterEach(() => {
    database.close();
  });

  it('добавляет элемент с переданным ID', () => {
    repository.create(42);

    expect(repository.findMany()).toEqual([{ id: 42 }]);
  });

  it('возвращает список элементов по возрастанию ID', () => {
    repository.create(30);

    repository.create(10);

    repository.create(20);

    expect(repository.findMany()).toEqual([{ id: 10 }, { id: 20 }, { id: 30 }]);
  });

  it('возвращает пустой список для пустой базы', () => {
    expect(repository.findMany()).toEqual([]);
  });

  it('отклоняет дубликат ограничением PRIMARY KEY и сохраняет исходный элемент', () => {
    repository.create(42);

    expect(() => repository.create(42)).toThrow(
      expect.objectContaining({
        code: 'ERR_SQLITE_ERROR',
        errcode: 1555,
        message: 'UNIQUE constraint failed: items.id',
      }),
    );

    expect(repository.findMany()).toEqual([{ id: 42 }]);
  });

  it.each([null, undefined, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'отклоняет некорректный ID %s без автоматической генерации',
    (id) => {
      expect(() => repository.create(id as number)).toThrow(TypeError);

      expect(repository.findMany()).toEqual([]);
    },
  );

  it('не переносит данные в новую базу после пересоздания', () => {
    repository.create(42);

    database.close();

    database = createDatabase();

    repository = new ItemsRepository(database);

    expect(repository.findMany()).toEqual([]);
  });
});
