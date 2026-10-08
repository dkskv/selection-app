import {
  notifyManager,
  useMutation,
  useMutationState,
  useQueryClient,
} from '@tanstack/react-query';
import {
  itemsQueryKeys,
  type ItemsPage,
  type ItemsQuery,
} from '@/entities/item';
import type { ListMove } from '@/shared/ui/list-dnd';
import {
  getQueryPageEntriesByWindow,
  removeOtherQueryCaches,
} from '@/shared/lib/react-query/useSlidingWindowQuery.helpers';
import { reorderSelectedItem } from '../api/reorderSelectedItem';
import { useOptimisticReorder } from './useOptimisticReorder';
import { getAfterIdFromPages } from './getAfterIdFromPages';

type ReorderMutationVariables = {
  itemId: number;
  afterId: number | null;
  move: ListMove;
  pageParams: number[];
};

/** Управляет перестановкой выбранного элемента и её оптимистичным обновлением в кеше. */
export function useReorderItems(
  query: ItemsQuery,
  onError: (error: Error) => void,
) {
  const queryClient = useQueryClient();
  const applyOptimisticMove = useOptimisticReorder(query.queryKey);
  const mutationKey = ['reorder-selected-item'];

  const pendingItemIds = useMutationState<number>({
    filters: { mutationKey, status: 'pending' },
    select: (mutation) =>
      (mutation.state.variables as ReorderMutationVariables).itemId,
  });

  const reorderMutation = useMutation({
    mutationKey,
    mutationFn: ({ itemId, afterId }: ReorderMutationVariables) =>
      reorderSelectedItem(itemId, afterId),
    onMutate: async ({ move, pageParams }) => {
      const { queryKey } = query;

      // Ответ текущей загрузки не должен затереть оптимистическую перестановку.
      await Promise.all(
        pageParams.map((pageParam) =>
          queryClient.cancelQueries({
            queryKey: [queryKey, pageParam],
            exact: true,
          }),
        ),
      );

      const previousPages = applyOptimisticMove(move, pageParams);

      return { previousPages, queryKey };
    },
    onSuccess: (_data, _variables, context) => {
      if (context) {
        removeOtherQueryCaches(
          queryClient,
          itemsQueryKeys.selected,
          context.queryKey,
        );
      }
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

  return { moveSelectedItem, pendingItemIds };
}
