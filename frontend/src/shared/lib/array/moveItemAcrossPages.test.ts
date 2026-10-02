import { describe, expect, it } from 'vitest';
import { moveItemAcrossPages } from './moveItemAcrossPages';

type Page = { items: string[]; skip: number; total: number };

function createPages(): Page[] {
  return [
    { items: ['a', 'b'], skip: 0, total: 9 },
    { items: ['c', 'd', 'e'], skip: 2, total: 9 },
    { items: ['f', 'g'], skip: 5, total: 9 },
    { items: ['h', 'i'], skip: 7, total: 9 },
  ];
}

function move(pages: Page[], from: number, to: number) {
  return moveItemAcrossPages(
    pages,
    from,
    to,
    (page) => page.items,
    (page, items) => ({ ...page, items }),
  );
}

describe('moveItemAcrossPages', () => {
  it.each([
    [
      2,
      6,
      [
        ['a', 'b'],
        ['d', 'e', 'f'],
        ['g', 'c'],
        ['h', 'i'],
      ],
    ],
    [
      6,
      2,
      [
        ['a', 'b'],
        ['g', 'c', 'd'],
        ['e', 'f'],
        ['h', 'i'],
      ],
    ],
  ])('переносит элемент между страницами с %i на %i', (from, to, expected) => {
    const pages = createPages();
    const original = structuredClone(pages);

    pages.forEach((page) => {
      Object.freeze(page.items);

      Object.freeze(page);
    });

    Object.freeze(pages);

    const result = move(pages, from, to);

    expect(result.map((page) => page.items)).toEqual(expected);

    expect(pages).toEqual(original);

    expect(result.map((page) => page.items.length)).toEqual([2, 3, 2, 2]);

    expect(result.map(({ skip, total }) => ({ skip, total }))).toEqual(
      original.map(({ skip, total }) => ({ skip, total })),
    );

    expect(result[0]).toBe(pages[0]);

    expect(result[3]).toBe(pages[3]);

    expect(result[1]).not.toBe(pages[1]);

    expect(result[2]).not.toBe(pages[2]);
  });

  it('при переносе внутри страницы меняет ссылку только на неё', () => {
    const pages = createPages();
    const result = move(pages, 2, 4);

    expect(result[1]?.items).toEqual(['d', 'e', 'c']);

    expect(result[1]).not.toBe(pages[1]);

    expect(result[0]).toBe(pages[0]);

    expect(result[2]).toBe(pages[2]);

    expect(result[3]).toBe(pages[3]);
  });

  it('переносит элемент через границу соседних страниц', () => {
    const pages = createPages();
    const result = move(pages, 1, 2);

    expect(result[0]?.items).toEqual(['a', 'c']);

    expect(result[1]?.items).toEqual(['b', 'd', 'e']);

    expect(result[2]).toBe(pages[2]);

    expect(result[3]).toBe(pages[3]);
  });

  it('сохраняет ссылку на пустую страницу между затронутыми', () => {
    const pages: Page[] = [
      { items: ['a'], skip: 0, total: 2 },
      { items: [], skip: 1, total: 2 },
      { items: ['b'], skip: 1, total: 2 },
    ];

    const result = move(pages, 0, 1);

    expect(result.map((page) => page.items)).toEqual([['b'], [], ['a']]);

    expect(result[1]).toBe(pages[1]);
  });

  it.each([
    [2, 2],
    [-1, 0],
    [0, 9],
    [0.5, 1],
    [0, NaN],
  ])(
    'сохраняет исходные ссылки при отсутствии переноса: %s → %s',
    (from, to) => {
      const pages = createPages();

      expect(move(pages, from, to)).toBe(pages);
    },
  );

  it('сохраняет ссылку на пустой массив страниц', () => {
    const pages: Page[] = [];

    expect(move(pages, 0, 1)).toBe(pages);
  });
});
