import { describe, expect, it } from 'vitest';
import { getScrollOffsetByAnchor } from './getScrollOffsetByAnchor';

describe('getScrollOffsetByAnchor', () => {
  it.each([
    {
      name: 'сохраняет смещение при неизменных ключах',
      previous: 'ABCDEF',
      next: 'ABCDEF',
      offset: 45,
      expected: 45,
    },
    {
      name: 'компенсирует prepend с сохранением смещения внутри строки',
      previous: 'ABCDEF',
      next: 'XABCDEF',
      offset: 45,
      expected: 85,
    },
    {
      name: 'компенсирует вытеснение страницы сверху и добавление снизу',
      previous: 'ABCDEF',
      next: 'BCDEFG',
      offset: 85,
      expected: 45,
    },
    {
      name: 'сохраняет якорь при переносе первой строки в конец',
      previous: 'ABCDEF',
      next: 'BCDEFA',
      offset: 45,
      expected: 5,
    },
    {
      name: 'учитывает reorder без изменения крайних ключей',
      previous: 'ABCDEF',
      next: 'ABDCEF',
      offset: 85,
      expected: 125,
    },
    {
      name: 'при удалении якоря предпочитает нижнего соседа равноудалённому верхнему',
      previous: 'ABCDEF',
      next: 'ABDEF',
      offset: 85,
      expected: 45,
    },
    {
      name: 'использует верхнего соседа, если нижние строки удалены',
      previous: 'ABCDEF',
      next: 'AXBYZW',
      offset: 85,
      expected: 125,
    },
    {
      name: 'ищет дальше непосредственных соседей',
      previous: 'ABCDEF',
      next: 'XYAEFGH',
      offset: 85,
      expected: 45,
    },
    {
      name: 'без общих ключей сохраняет прежнее смещение',
      previous: 'ABCDEF',
      next: 'UVWXYZ',
      offset: 85,
      expected: 85,
    },
    {
      name: 'без общих ключей ограничивает смещение новым концом списка',
      previous: 'ABCDEF',
      next: 'XYZ',
      offset: 85,
      expected: 40,
    },
    {
      name: 'ограничивает смещение сверху при переносе якоря в конец',
      previous: 'ABCDEF',
      next: 'BCDEFA',
      offset: 5,
      expected: 160,
    },
    {
      name: 'ограничивает смещение снизу при удалении строк перед якорем',
      previous: 'ABCDEF',
      next: 'CDEF',
      offset: 45,
      expected: 0,
    },
    {
      name: 'возвращает ноль для списка короче viewport',
      previous: 'AB',
      next: 'BA',
      offset: 0,
      expected: 0,
    },
    {
      name: 'возвращает ноль при удалении всех строк',
      previous: 'ABCDEF',
      next: '',
      offset: 85,
      expected: 0,
    },
    {
      name: 'обрабатывает первую загрузку',
      previous: '',
      next: 'ABCDEF',
      offset: 0,
      expected: 0,
    },
    {
      name: 'обрабатывает пустые списки',
      previous: '',
      next: '',
      offset: 0,
      expected: 0,
    },
    {
      name: 'ограничивает отрицательное смещение при неизменных ключах',
      previous: 'ABCDEF',
      next: 'ABCDEF',
      offset: -5,
      expected: 0,
    },
  ])('$name', ({ previous, next, offset, expected }) => {
    const previousKeys = Object.freeze([...previous]);
    const nextKeys = Object.freeze([...next]);

    expect(
      getScrollOffsetByAnchor({
        previousKeys,
        nextKeys,
        previousOffset: offset,
        rowHeight: 40,
        viewportHeight: 80,
      }),
    ).toBe(expected);
  });

  it('различает числовые и строковые ключи и учитывает заданную высоту', () => {
    expect(
      getScrollOffsetByAnchor({
        previousKeys: [0, '0', 1, 2, 3],
        nextKeys: ['0', 0, 1, 2, 3],
        previousOffset: 25,
        rowHeight: 20,
        viewportHeight: 40,
      }),
    ).toBe(5);
  });

  it('ограничивает смещение при увеличении viewport без изменения ключей', () => {
    expect(
      getScrollOffsetByAnchor({
        previousKeys: ['A', 'B', 'C'],
        nextKeys: ['A', 'B', 'C'],
        previousOffset: 40,
        rowHeight: 40,
        viewportHeight: 100,
      }),
    ).toBe(20);
  });
});
