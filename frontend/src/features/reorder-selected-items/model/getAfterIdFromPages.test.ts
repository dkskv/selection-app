import { describe, expect, it } from 'vitest';
import { getAfterIdFromPages } from './getAfterIdFromPages';

describe('getAfterIdFromPages', () => {
  const pages = [
    { items: [{ id: 1 }, { id: 2 }], offset: 0, limit: 2 },
    { items: [{ id: 3 }, { id: 4 }], offset: 2, limit: 2 },
  ];

  it('возвращает ID элемента перед целевой позицией', () => {
    expect(getAfterIdFromPages(pages, 4, 2)).toBe(2);
  });

  it('исключает перемещаемый элемент из расчёта позиции', () => {
    expect(getAfterIdFromPages(pages, 2, 2)).toBe(3);
  });

  it('возвращает null для первой позиции и пустых страниц', () => {
    expect(getAfterIdFromPages(pages, 4, 0)).toBeNull();

    expect(getAfterIdFromPages(undefined, 4, 2)).toBeNull();
  });
});
