import {
  notifyManager,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import type { ItemsPage } from '@/entities/item';
import { moveItemAcrossPages } from '@/shared/lib/array';
import { getQueryPageEntriesByWindow } from '@/shared/lib/react-query/useSlidingWindowQuery.helpers';
import type { ListMove } from '@/shared/ui/list-dnd';

/** Оптимистично перемещает выбранный элемент в кеше и возвращает снимок страниц для отката. */
export function useOptimisticReorder(queryKey: QueryKey) {
  const queryClient = useQueryClient();

  return ({ fromIndex, toIndex }: ListMove, pageParams: number[]) => {
    const previousPages = getQueryPageEntriesByWindow<ItemsPage, number>(
      queryClient,
      queryKey,
      pageParams,
    );

    if (!previousPages) return undefined;

    const pages = moveItemAcrossPages(
      previousPages.map(({ page }) => page),
      fromIndex,
      toIndex,
      (page) => page.items,
      (page, items) => ({ ...page, items }),
    );

    notifyManager.batch(() => {
      previousPages.forEach(({ pageParam }, index) => {
        queryClient.setQueryData([queryKey, pageParam], pages[index]);
      });
    });

    return previousPages;
  };
}
