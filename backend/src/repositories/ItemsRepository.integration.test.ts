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

  it('возвращает выбранные элементы в порядке позиций с COLLATE BINARY', async () => {
    for (const id of [10, 20, 30, 40]) {
      await repository.create(id);
    }

    await selection.select(10);

    await selection.select(20);

    await selection.select(30);

    await selection.reorder(30, null);

    await expect(repository.findSelected()).resolves.toEqual([
      { id: 30 },
      { id: 10 },
      { id: 20 },
    ]);

    await expect(repository.findUnselected()).resolves.toEqual([{ id: 40 }]);
  });

  describe.each(['findSelected', 'findUnselected'] as const)(
    'Пагинация %s',
    (method) => {
      const order =
        method === 'findSelected' ? [40, 10, 30, 20] : [10, 20, 30, 40];

      beforeEach(async () => {
        for (const id of [40, 10, 30, 20]) {
          await repository.create(id);

          if (method === 'findSelected') {
            await selection.select(id);
          }
        }

        await repository.create(50);

        if (method === 'findUnselected') {
          await selection.select(50);
        }
      });

      it.each([
        { params: {}, start: 0, end: 4 },
        { params: { limit: 2 }, start: 0, end: 2 },
        { params: { offset: 2 }, start: 2, end: 4 },
        { params: { limit: 2, offset: 1 }, start: 1, end: 3 },
        { params: { limit: 3, offset: 3 }, start: 3, end: 4 },
        { params: { limit: 0 }, start: 0, end: 0 },
        { params: { limit: 2, offset: 4 }, start: 4, end: 4 },
        { params: { offset: 100 }, start: 4, end: 4 },
      ])('возвращает страницу для $params', async ({ params, start, end }) => {
        await expect(repository[method](params)).resolves.toEqual(
          order.slice(start, end).map((id) => ({ id })),
        );
      });
    },
  );
});
