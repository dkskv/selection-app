import {
  notifyManager,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { type ItemsPage, type ItemsQuery } from '@/entities/item';
import type { ListMove } from '@/shared/ui/list-dnd';
import { getQueryPageEntriesByWindow } from '@/shared/lib/react-query/useSlidingWindowQuery.helpers';
import { reorderSelectedItem } from '../api/reorderSelectedItem';
import { useReorderSelected } from './useReorderSelected';
import { getAfterIdFromPages } from './getAfterIdFromPages';

export function useReorderItems(
  query: ItemsQuery,
  onError: (error: Error) => void,
) {
  const queryClient = useQueryClient();
  const handleMove = useReorderSelected(query.queryKey);

  const reorderMutation = useMutation({
    mutationFn: ({
      itemId,
      afterId,
    }: {
      itemId: number;
      afterId: number | null;
      move: ListMove;
      pageParams: number[];
    }) => reorderSelectedItem(itemId, afterId),
    onMutate: async ({ move, pageParams }) => {
      const queryKey = query.queryKey;

      // Ответ текущей загрузки не должен затереть оптимистическую перестановку.
      await Promise.all(
        pageParams.map((pageParam) =>
          queryClient.cancelQueries({
            queryKey: [queryKey, pageParam],
            exact: true,
          }),
        ),
      );

      const previousPages = handleMove(move, pageParams);

      return { previousPages, queryKey };
    },
    onError: (error, _variables, context) => {
      onError(error);

      const previousPages = context?.previousPages;

      if (previousPages) {
        notifyManager.batch(() => {
          previousPages.forEach(({ pageParam, page }) => {
            queryClient.setQueryData([context.queryKey, pageParam], page);
          });
        });
      }
    },
  });

  const moveSelectedItem = (move: ListMove) => {
    const pageParams = query.data?.pageParams;

    if (!pageParams) return;

    const entries = getQueryPageEntriesByWindow<ItemsPage, number>(
      queryClient,
      query.queryKey,
      pageParams,
    );

    if (!entries) return;

    const afterId = getAfterIdFromPages(
      entries.map(({ page }) => page),
      Number(move.id),
      move.toIndex,
    );

    reorderMutation.mutate({
      itemId: Number(move.id),
      afterId,
      move,
      pageParams,
    });
  };

  return { moveSelectedItem, reorderMutation };
}
