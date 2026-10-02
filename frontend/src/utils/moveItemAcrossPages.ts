import { moveItem } from './moveItem';

/** Переносит элемент по сквозным индексам, сохраняя размеры и ссылки незатронутых страниц. */
export function moveItemAcrossPages<TPage, TItem>(
  pages: TPage[],
  fromIndex: number,
  toIndex: number,
  getItems: (page: TPage) => TItem[],
  setItems: (page: TPage, items: TItem[]) => TPage,
): TPage[] {
  const originalItems = pages.flatMap(getItems);
  const items = moveItem(originalItems, fromIndex, toIndex);

  if (items === originalItems) {
    return pages;
  }

  const startIndex = Math.min(fromIndex, toIndex);
  const endIndex = Math.max(fromIndex, toIndex);
  let offset = 0;

  return pages.map((page) => {
    const length = getItems(page).length;
    const start = offset;

    offset += length;

    if (length === 0 || offset <= startIndex || start > endIndex) {
      return page;
    }

    return setItems(page, items.slice(start, offset));
  });
}
