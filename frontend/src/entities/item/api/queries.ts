import type { ItemsPage } from '../model/types';

export const itemsQueryKeys = {
  selected: ['products', 'selected'],
  unselected: ['products', 'unselected'],
} as const;

export function getNextItemsPageParam(lastPage: ItemsPage) {
  const nextSkip = lastPage.skip + lastPage.products.length;

  return nextSkip < lastPage.total ? nextSkip : undefined;
}
