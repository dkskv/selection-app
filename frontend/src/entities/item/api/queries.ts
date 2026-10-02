import type { ItemsPage } from '../model/types';

export const itemsQueryKeys = {
  selected: ['items', 'selected'],
  unselected: ['items', 'unselected'],
} as const;

export function getNextItemsPageParam(lastPage: ItemsPage) {
  return lastPage.items.length === lastPage.limit
    ? lastPage.offset + lastPage.items.length
    : undefined;
}
