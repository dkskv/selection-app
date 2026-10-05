import { describe, expect, it } from 'vitest';
import { stableStringify } from './stableStringify.js';

describe('stableStringify', () => {
  it('сортирует ключи объектов, сохраняя значения', () => {
    expect(stableStringify({ z: 1, a: 2 })).toBe('{"a":2,"z":1}');
  });

  it('сортирует ключи во вложенных объектах', () => {
    expect(stableStringify({ outer: { z: 1, a: 2 } })).toBe(
      '{"outer":{"a":2,"z":1}}',
    );
  });

  it('сохраняет порядок массива и нормализует объекты внутри него', () => {
    expect(stableStringify([{ z: 1, a: 2 }, 'значение'])).toBe(
      '[{"a":2,"z":1},"значение"]',
    );
  });

  it('сериализует примитивы и null стандартным способом JSON', () => {
    expect(stableStringify(null)).toBe('null');

    expect(stableStringify('текст')).toBe('"текст"');

    expect(stableStringify(42)).toBe('42');
  });
});
