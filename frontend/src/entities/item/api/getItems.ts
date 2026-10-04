import type { Item, ItemsPage } from '../model/types';

const PAGE_SIZE = 20;

export async function getItems(
  selection: 'selected' | 'unselected',
  offset: number,
  signal: AbortSignal,
): Promise<ItemsPage> {
  const response = await fetch(
    `/api/items/${selection}?limit=${PAGE_SIZE}&offset=${offset}`,
    { signal },
  );

  if (!response.ok) {
    throw new Error('Failed to load items.');
  }

  const items: Item[] = await response.json();

  return { items, offset, limit: PAGE_SIZE };
}
