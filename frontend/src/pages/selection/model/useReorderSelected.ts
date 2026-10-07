import {
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from '@tanstack/react-query';
import type { ItemsPage } from '@/entities/item';
import { moveItemAcrossPages } from '@/shared/lib/array';
import type { ListMove } from '@/shared/ui/list-dnd';

export function useReorderSelected(queryKey: QueryKey) {
  const queryClient = useQueryClient();

  return ({ fromIndex, toIndex }: ListMove) => {
    queryClient.setQueryData<InfiniteData<ItemsPage, number>>(
      queryKey,
      (data) => {
        if (!data) {
          return data;
        }

        // TODO: Учесть изменение порядка элементов в кеше во время переноса: fromIndex и toIndex могут устареть.
        return {
          ...data,
          pages: moveItemAcrossPages(
            data.pages,
            fromIndex,
            toIndex,
            (page) => page.items,
            (page, items) => ({ ...page, items }),
          ),
        };
      },
    );
  };
}
