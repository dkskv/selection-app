import type { Item, ItemsPage } from '@/entities/item/model/types';

const PAGE_SIZE = 20;

export async function getItems(
  selection: 'selected' | 'unselected',
  offset: number,
  signal: AbortSignal,
  search = '',
): Promise<ItemsPage> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });

  if (search) params.set('idPrefixFilter', search);

  const response = await fetch(
    `/api/items/${selection}?${params}`,
    { signal },
  );

  if (!response.ok) {
    throw new Error('Failed to load items.');
  }

  const items: Item[] = await response.json();

  return { items, offset, limit: PAGE_SIZE };
}
