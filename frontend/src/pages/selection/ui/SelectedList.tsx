import {
  deselectItem,
  reorderSelectedItem,
  itemsQueryKeys,
  type ItemsPage,
} from '../../../entities/item';
import { Button, Card, Flex, message, Typography } from 'antd';
import MinusOutlined from '@ant-design/icons/MinusOutlined';
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { InfiniteList } from '../../../shared/ui/infinite-list';
import { ListRow } from '../../../shared/ui/list-row';
import { SearchInput } from './SearchInput';
import controls from './ListControls.module.css';
import {
  ListDnd,
  SortableItem,
  DragHandle,
  type ListMove,
} from '../../../shared/ui/list-dnd';
import { ProgressLoader } from '../../../shared/ui/progress-loader';
import { getRelativeRect } from '../../../shared/lib/dom';
import listStyles from './SelectionList.module.css';
import { DropIndicator } from './DropIndicator';
import { useReorderSelected } from '../model/useReorderSelected';
import { getAfterIdFromPages } from '../model/getAfterIdFromPages';
import { useSlidingWindowQuery } from '../../../shared/lib/react-query/useSlidingWindowQuery';

type SlidingQuery = ReturnType<typeof useSlidingWindowQuery<ItemsPage, number>>;

export function SelectedList({
  selectedQuery,
  scheduleUnselectedRefresh,
  scheduleSelectedRefresh,
}: {
  selectedQuery: SlidingQuery;
  scheduleUnselectedRefresh: () => void;
  scheduleSelectedRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const listContainerRef = useRef<HTMLDivElement>(null);

  const [dropIndicatorPosition, setDropIndicatorPosition] = useState<{
    top: number;
    left: number;
    right: number;
  } | null>(null);

  const [messageApi, contextHolder] = message.useMessage();

  const deselectMutation = useMutation({
    mutationFn: deselectItem,
    onError: (error) => messageApi.error(error.message),
    onSuccess: () => {
      scheduleUnselectedRefresh();

      scheduleSelectedRefresh();
    },
  });

  const handleMove = useReorderSelected();

  const reorderMutation = useMutation({
    mutationFn: ({
      itemId,
      afterId,
    }: {
      itemId: number;
      afterId: number | null;
      move: ListMove;
    }) => reorderSelectedItem(itemId, afterId),
    onMutate: ({ move }) => {
      const previousData = queryClient.getQueryData<
        InfiniteData<ItemsPage, number>
      >(itemsQueryKeys.selected);

      handleMove(move);

      return { previousData };
    },
    onSuccess: scheduleSelectedRefresh,
    onError: (error, _variables, context) => {
      messageApi.error(error.message);

      if (context?.previousData) {
        queryClient.setQueryData(itemsQueryKeys.selected, context.previousData);
      }
    },
  });

  const moveSelectedItem = (move: ListMove) => {
    const data = queryClient.getQueryData<InfiniteData<ItemsPage, number>>(
      itemsQueryKeys.selected,
    );

    const afterId = getAfterIdFromPages(
      data?.pages,
      Number(move.id),
      move.toIndex,
    );

    reorderMutation.mutate({
      itemId: Number(move.id),
      afterId,
      move,
    });
  };

  return (
    <Card title="Selected" className={listStyles.card}>
      {contextHolder}
      {selectedQuery.isRefreshing && (
        <div className={listStyles.progress}>
          <ProgressLoader />
        </div>
      )}
      <Flex vertical gap="middle">
        <Flex gap={8} wrap>
          <div className={controls.half}>
            <SearchInput />
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
              data={selectedQuery.data}
              isFetchingNextPage={selectedQuery.isFetchingNextPage}
              isFetchingPreviousPage={selectedQuery.isFetchingPreviousPage}
              hasNextPage={selectedQuery.hasNextPage}
              hasPreviousPage={selectedQuery.hasPreviousPage}
              fetchNextPage={selectedQuery.fetchNextPage}
              fetchPreviousPage={selectedQuery.fetchPreviousPage}
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
                          loading={
                            deselectMutation.isPending &&
                            deselectMutation.variables === item.id
                          }
                          disabled={
                            deselectMutation.isPending &&
                            deselectMutation.variables === item.id
                          }
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
