import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../database.js';
import { ItemsRepository } from './ItemsRepository.js';
import { SelectionRepository } from './SelectionRepository.js';

describe('Репозитории с SQLite in-memory', () => {
  let database: DatabaseSync;
  let repository: ItemsRepository;
  let selection: SelectionRepository;

  beforeEach(() => {
    database = createDatabase();

    repository = new ItemsRepository(database);

    selection = new SelectionRepository(database);
  });

  afterEach(() => {
    database.close();
  });

  it('добавляет элемент с переданным ID', async () => {
    await repository.create(42);

    await expect(repository.findUnselected()).resolves.toEqual([{ id: 42 }]);
  });

  it('возвращает список элементов по возрастанию ID', async () => {
    await repository.create(30);

    await repository.create(10);

    await repository.create(20);

    await expect(repository.findUnselected()).resolves.toEqual([
      { id: 10 },
      { id: 20 },
      { id: 30 },
    ]);
  });

  it('возвращает пустой список для пустой базы', async () => {
    await expect(repository.findUnselected()).resolves.toEqual([]);

    await expect(repository.findSelected()).resolves.toEqual([]);
  });

  it('отклоняет дубликат ограничением PRIMARY KEY и сохраняет исходный элемент', async () => {
    await repository.create(42);

    await expect(repository.create(42)).rejects.toThrow(
      expect.objectContaining({
        code: 'ERR_SQLITE_ERROR',
        errcode: 1555,
        message: 'UNIQUE constraint failed: items.id',
      }),
    );

    await expect(repository.findUnselected()).resolves.toEqual([{ id: 42 }]);
  });

  it.each([null, undefined, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'отклоняет некорректный ID %s без автоматической генерации',
    async (id) => {
      await expect(repository.create(id as number)).rejects.toThrow(TypeError);

      await expect(repository.findUnselected()).resolves.toEqual([]);
    },
  );

  it('не переносит данные в новую базу после пересоздания', async () => {
    await repository.create(42);

    await selection.select(42);

    database.close();

    database = createDatabase();

    repository = new ItemsRepository(database);

    selection = new SelectionRepository(database);

    await expect(repository.findUnselected()).resolves.toEqual([]);

    await expect(repository.findSelected()).resolves.toEqual([]);
  });

  it('возвращает выбранный элемент и исключает его из невыбранных', async () => {
    await repository.create(42);

    await repository.create(10);

    await expect(repository.findSelected()).resolves.toEqual([]);

    await selection.select(42);

    await expect(repository.findSelected()).resolves.toEqual([{ id: 42 }]);

    await expect(repository.findUnselected()).resolves.toEqual([{ id: 10 }]);
  });

  it('после снятия выбора возвращает элемент в невыбранные', async () => {
    await repository.create(42);

    await selection.select(42);

    await selection.deselect(42);

    await expect(repository.findSelected()).resolves.toEqual([]);

    await expect(repository.findUnselected()).resolves.toEqual([{ id: 42 }]);
  });

  it('отклоняет выбор несуществующего элемента ограничением foreign key', async () => {
    await expect(selection.select(42)).rejects.toThrow(
      expect.objectContaining({
        code: 'ERR_SQLITE_ERROR',
        errcode: 787,
        message: 'FOREIGN KEY constraint failed',
      }),
    );

    await expect(repository.findSelected()).resolves.toEqual([]);

    await expect(repository.findUnselected()).resolves.toEqual([]);
  });
});
