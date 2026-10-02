import type { ItemsPage } from '../model/types';

const PAGE_SIZE = 20;

export async function getItems(
  skip: number,
  signal: AbortSignal,
): Promise<ItemsPage> {
  const response = await fetch(
    `https://dummyjson.com/products?limit=${PAGE_SIZE}&skip=${skip}&select=title`,
    { signal },
  );

  if (!response.ok) {
    throw new Error('Не удалось загрузить данные');
  }

  return response.json();
}
