import type { ItemsPage } from '@/entities/item/model/types';

export const itemsQueryKeys = {
  selected: ['items', 'selected'],
  unselected: ['items', 'unselected'],
} as const;

export function getNextItemsPageParam(lastPage: ItemsPage) {
  return lastPage.items.length === lastPage.limit
    ? lastPage.offset + lastPage.items.length
    : undefined;
}

export function getPreviousItemsPageParam(firstPage: ItemsPage) {
  return firstPage.offset > 0
    ? Math.max(0, firstPage.offset - firstPage.limit)
    : undefined;
}
