import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../database.js';
import { ItemsRepository } from './ItemsRepository.js';
import { SelectionRepository } from './SelectionRepository.js';

describe('SelectionRepository с SQLite in-memory', () => {
  let database: DatabaseSync;
  let selection: SelectionRepository;
  let items: ItemsRepository;

  beforeEach(() => {
    database = createDatabase();

    selection = new SelectionRepository(database);

    items = new ItemsRepository(database);
  });

  afterEach(() => {
    database.close();
  });

  async function readSelected(): Promise<{ id: number }[]> {
    return (await selection.findAll()).map(({ itemId }) => ({ id: itemId }));
  }

  it('возвращает пустой список для пустой базы', async () => {
    await expect(selection.findAll()).resolves.toEqual([]);
  });

  describe('Порядок выбранных элементов', () => {
    beforeEach(async () => {
      for (const id of [10, 20, 30, 40]) {
        await items.create(id);
      }
    });

    it('назначает первому элементу корректную позицию', async () => {
      await selection.select(10);

      await expect(selection.findAll()).resolves.toEqual([
        { itemId: 10, position: 'a0' },
      ]);

      await expect(readSelected()).resolves.toEqual([{ id: 10 }]);
    });

    it('сохраняет порядок выбора, независимо от ID', async () => {
      for (const id of [40, 10, 30, 20]) {
        await selection.select(id);
      }

      await expect(readSelected()).resolves.toEqual([
        { id: 40 },
        { id: 10 },
        { id: 30 },
        { id: 20 },
      ]);
    });

    describe('Перестановка', () => {
      beforeEach(async () => {
        for (const id of [10, 20, 30, 40]) {
          await selection.select(id);
        }
      });

      it('перемещает элемент после указанного', async () => {
        await selection.reorder(40, 20);

        await expect(readSelected()).resolves.toEqual([
          { id: 10 },
          { id: 20 },
          { id: 40 },
          { id: 30 },
        ]);
      });

      it('перемещает элемент в начало при явном null', async () => {
        await selection.reorder(40, null);

        await expect(readSelected()).resolves.toEqual([
          { id: 40 },
          { id: 10 },
          { id: 20 },
          { id: 30 },
        ]);
      });

      it('последовательно перемещает элементы вперёд, назад и в конец', async () => {
        await selection.reorder(40, 20);

        await selection.reorder(40, null);

        await selection.reorder(10, 30);

        await selection.reorder(30, 40);

        await selection.reorder(30, 40);

        await expect(readSelected()).resolves.toEqual([
          { id: 40 },
          { id: 30 },
          { id: 20 },
          { id: 10 },
        ]);

        await items.create(50);

        await selection.select(50);

        await expect(readSelected()).resolves.toEqual([
          { id: 40 },
          { id: 30 },
          { id: 20 },
          { id: 10 },
          { id: 50 },
        ]);
      });

      it.each([
        { itemId: 20, afterId: 20 },
        { itemId: 20, afterId: 99 },
        { itemId: 99, afterId: 20 },
        { itemId: 20, afterId: undefined },
      ])(
        'отклоняет некорректную перестановку $itemId после $afterId',
        async ({ itemId, afterId }) => {
          await expect(
            selection.reorder(itemId, afterId as number | null),
          ).rejects.toThrow();

          await expect(readSelected()).resolves.toEqual([
            { id: 10 },
            { id: 20 },
            { id: 30 },
            { id: 40 },
          ]);
        },
      );

      it('отклоняет невыбранный item и невыбранный afterId', async () => {
        await selection.deselect(30);

        await expect(selection.reorder(30, 10)).rejects.toThrow();

        await expect(selection.reorder(20, 30)).rejects.toThrow();

        await expect(readSelected()).resolves.toEqual([
          { id: 10 },
          { id: 20 },
          { id: 40 },
        ]);

        await expect(items.findUnselected()).resolves.toEqual([{ id: 30 }]);
      });
    });
  });
});
