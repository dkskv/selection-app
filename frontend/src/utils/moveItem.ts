/** Возвращает массив с элементом, перенесённым на новую позицию. */
export function moveItem<T>(
  items: T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }

  const result = [...items];
  const [item] = result.splice(fromIndex, 1);

  result.splice(toIndex, 0, item!);

  return result;
}
