import type { ItemsPage } from '../../../entities/item';

/** Возвращает ID элемента перед целевой позицией, пропуская перемещаемый элемент. */
export function getAfterIdFromPages(
  pages: ItemsPage[] | undefined,
  itemId: number,
  position: number,
): number | null {
  if (position === 0) {
    return null;
  }

  let index = 0;

  for (const page of pages ?? []) {
    for (const item of page.items) {
      if (item.id === itemId) {
        continue;
      }

      if (index === position - 1) {
        return item.id;
      }

      index += 1;
    }
  }

  return null;
}
