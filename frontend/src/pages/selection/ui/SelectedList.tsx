import {
  deselectItem,
  reorderSelectedItem,
  type ItemsPage,
} from '@/entities/item';
import { Button, Card, Flex, message, Typography } from 'antd';
import MinusOutlined from '@ant-design/icons/MinusOutlined';
import {
  notifyManager,
  useMutation,
  useMutationState,
  useQueryClient,
} from '@tanstack/react-query';
import { useRef, useState } from 'react';
import {
  InfiniteList,
  type InfiniteListHandle,
  useResetInfiniteListScroll,
} from '@/shared/ui/infinite-list';
import { ListRow } from '@/shared/ui/list-row';
import { SearchInput } from './SearchInput';
import controls from './ListControls.module.css';
import {
  ListDnd,
  SortableItem,
  DragHandle,
  type ListMove,
} from '@/shared/ui/list-dnd';
import { ProgressLoader } from '@/shared/ui/progress-loader';
import { getRelativeRect } from '@/shared/lib/dom';
import listStyles from './SelectionList.module.css';
import { DropIndicator } from './DropIndicator';
import { useReorderSelected } from '../model/useReorderSelected';
import { getAfterIdFromPages } from '../model/getAfterIdFromPages';
import { useSlidingWindowQuery } from '@/shared/lib/react-query/useSlidingWindowQuery';
import { getQueryPageEntriesByWindow } from '@/shared/lib/react-query/useSlidingWindowQuery.helpers';

type SlidingQuery = ReturnType<typeof useSlidingWindowQuery<ItemsPage, number>>;

export function SelectedList({
  selectedQuery,
  selectedQueryKey,
  search,
  onSearchChange,
  scheduleUnselectedRefresh,
  scheduleSelectedRefresh,
}: {
  selectedQuery: SlidingQuery;
  selectedQueryKey: readonly unknown[];
  search: string;
  onSearchChange: (value: string) => void;
  scheduleUnselectedRefresh: () => void;
  scheduleSelectedRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const listContainerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<InfiniteListHandle>(null);

  useResetInfiniteListScroll({
    listRef,
    scrollKey: search,
    isLoading: selectedQuery.isLoading || selectedQuery.isRefreshing,
  });

  const [dropIndicatorPosition, setDropIndicatorPosition] = useState<{
    top: number;
    left: number;
    right: number;
  } | null>(null);

  const [messageApi, contextHolder] = message.useMessage();

  const pendingDeselectedItemIds = useMutationState<number>({
    filters: { mutationKey: ['deselect-item'], status: 'pending' },
    select: (mutation) => mutation.state.variables as number,
  });

  const deselectMutation = useMutation({
    mutationKey: ['deselect-item'],
    mutationFn: deselectItem,
    onError: (error) => messageApi.error(error.message),
    onSuccess: () => {
      scheduleUnselectedRefresh();

      scheduleSelectedRefresh();
    },
  });

  const handleMove = useReorderSelected(selectedQueryKey);

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
      const queryKey = selectedQueryKey;

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
      messageApi.error(error.message);

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
    const pageParams = selectedQuery.data?.pageParams;

    if (!pageParams) return;

    const entries = getQueryPageEntriesByWindow<ItemsPage, number>(
      queryClient,
      selectedQueryKey,
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

  return (
    <Card title="Selected" className={listStyles.card}>
      {contextHolder}
      {(selectedQuery.isLoading || selectedQuery.isRefreshing) && (
        <div className={listStyles.progress}>
          <ProgressLoader />
        </div>
      )}
      <Flex vertical gap="middle">
        <Flex justify="space-between" gap={16} wrap>
          <div className={controls.control}>
            <SearchInput value={search} onChange={onSearchChange} />
          </div>
        </Flex>
        <div className={listStyles.dragArea} ref={listContainerRef}>
          <ListDnd
            onMove={moveSelectedItem}
            onDropTargetChange={(target) => {
              if (!target || !listContainerRef.current) {
                setDropIndicatorPosition(null);

                return;
              }

              const targetPosition = getRelativeRect(
                target.element,
                listContainerRef.current,
              );

              const insertAfter = target.move.fromIndex < target.move.toIndex;

              setDropIndicatorPosition({
                top:
                  targetPosition.top +
                  (insertAfter ? targetPosition.height : 0),
                left: targetPosition.left,
                right: targetPosition.right,
              });
            }}
            // Позициями строк управляет виртуализатор, поэтому отключаем перестановку DOM во время переноса.
            onDragOver={(event) => event.preventDefault()}
            renderOverlay={(id) => <Typography.Text>{id}</Typography.Text>}
          >
            <InfiniteList
              ref={listRef}
              data={selectedQuery.data}
              isFetchingNextPage={selectedQuery.isFetchingNextPage}
              isFetchingPreviousPage={selectedQuery.isFetchingPreviousPage}
              hasNextPage={selectedQuery.hasNextPage}
              hasPreviousPage={selectedQuery.hasPreviousPage}
              fetchNextPage={selectedQuery.loadNextPage}
              fetchPreviousPage={selectedQuery.loadPreviousPage}
              getItems={(page) => page.items}
              getItemKey={(item) => item.id}
              renderItem={(item, index) => (
                <SortableItem id={item.id} index={index}>
                  {(handleRef) => (
                    <ListRow
                      action={
                        <Button
                          size="small"
                          icon={<MinusOutlined />}
                          aria-label={`Удалить ${item.id}`}
                          loading={pendingDeselectedItemIds.includes(item.id)}
                          disabled={pendingDeselectedItemIds.includes(item.id)}
                          onClick={() => deselectMutation.mutate(item.id)}
                        />
                      }
                    >
                      <Flex align="center" gap="small" style={{ minWidth: 0 }}>
                        <DragHandle
                          ref={handleRef}
                          label={`Move ${item.id}`}
                          loading={
                            reorderMutation.isPending &&
                            reorderMutation.variables.itemId === item.id
                          }
                        />
                        <Typography.Text ellipsis style={{ minWidth: 0 }}>
                          {item.id}
                        </Typography.Text>
                      </Flex>
                    </ListRow>
                  )}
                </SortableItem>
              )}
            />
          </ListDnd>
          {dropIndicatorPosition !== null && (
            <DropIndicator {...dropIndicatorPosition} />
          )}
        </div>
      </Flex>
    </Card>
  );
}
