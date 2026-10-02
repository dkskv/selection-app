import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { itemsQueryKeys, type ItemsPage } from '../../../entities/item';
import { moveItemAcrossPages } from '../../../shared/lib/array';
import type { ListMove } from '../../../shared/ui/list-dnd';

export function useReorderSelected() {
  const queryClient = useQueryClient();

  return ({ fromIndex, toIndex }: ListMove) => {
    queryClient.setQueryData<InfiniteData<ItemsPage, number>>(
      itemsQueryKeys.selected,
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
            (page) => page.products,
            (page, products) => ({ ...page, products }),
          ),
        };
      },
    );
  };
}
