import type { QueryClient, InfiniteData } from '@tanstack/react-query';
import {
  getItems,
  itemsQueryKeys,
  type ItemsPage,
} from '../../../entities/item';

type Selection = 'selected' | 'unselected';

const selectionQueries = [
  ['selected', itemsQueryKeys.selected],
  ['unselected', itemsQueryKeys.unselected],
] as const satisfies readonly (readonly [Selection, readonly unknown[]])[];

/** Параллельно загружает все закешированные страницы и применяет их только при полном успехе. */
export async function refreshSelectionLists(
  queryClient: QueryClient,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) {
    throw new DOMException('Обновление отменено', 'AbortError');
  }

  await Promise.all(
    selectionQueries.map(([, queryKey]) =>
      queryClient.cancelQueries({ queryKey }),
    ),
  );

  if (signal.aborted) {
    throw new DOMException('Обновление отменено', 'AbortError');
  }

  const refreshedLists = await Promise.all(
    selectionQueries.map(async ([selection, queryKey]) => {
      const data =
        queryClient.getQueryData<InfiniteData<ItemsPage, number>>(queryKey);

      const pageParams = data?.pageParams.length ? data.pageParams : [0];

      const pages = await Promise.all(
        pageParams.map((offset) => getItems(selection, offset, signal)),
      );

      return {
        queryKey,
        data: { pages, pageParams },
      };
    }),
  );

  if (signal.aborted) {
    throw new DOMException('Обновление отменено', 'AbortError');
  }

  refreshedLists.forEach(({ queryKey, data }) => {
    queryClient.setQueryData(queryKey, data);
  });
}
