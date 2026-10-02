import { describe, expect, it } from 'vitest';
import { moveItem } from './moveItem';

describe('moveItem', () => {
  it.each([
    [0, 2, ['b', 'c', 'a', 'd']],
    [3, 1, ['a', 'd', 'b', 'c']],
  ])('переносит элемент с позиции %i на %i', (from, to, expected) => {
    const items = ['a', 'b', 'c', 'd'];

    Object.freeze(items);

    const result = moveItem(items, from, to);

    expect(result).toEqual(expected);

    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });

  it('сохраняет исходный массив и ссылки на элементы', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const original = [...items];

    Object.freeze(items);

    const result = moveItem(items, 0, 2);

    expect(items).toEqual(original);

    expect(result).not.toBe(items);

    expect(result[2]).toBe(items[0]);

    expect(result[0]).toBe(items[1]);

    expect(result[1]).toBe(items[2]);
  });

  it.each([
    [1, 1],
    [-1, 0],
    [0, -1],
    [3, 0],
    [0, 3],
    [0.5, 1],
    [0, 1.5],
    [NaN, 1],
    [0, Infinity],
  ])('возвращает исходный массив для индексов %s и %s', (from, to) => {
    const items = ['a', 'b', 'c'];

    expect(moveItem(items, from, to)).toBe(items);
  });

  it('сохраняет ссылку на пустой массив', () => {
    const items: number[] = [];

    expect(moveItem(items, 0, 1)).toBe(items);
  });
});
