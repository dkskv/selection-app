import {
  getItems,
  getNextItemsPageParam,
  getPreviousItemsPageParam,
  itemsQueryKeys,
  deselectItem,
  type ItemsPage,
} from '../../../entities/item';
import { Button, Card, Flex, Typography } from 'antd';
import MinusOutlined from '@ant-design/icons/MinusOutlined';
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { InfiniteList } from '../../../shared/ui/infinite-list';
import { ListRow } from '../../../shared/ui/list-row';
import { SearchInput } from './SearchInput';
import controls from './ListControls.module.css';
import { ListDnd, SortableItem, DragHandle } from '../../../shared/ui/list-dnd';
import { useReorderSelected } from '../model/useReorderSelected';
import { ProgressLoader } from '../../../shared/ui/progress-loader';
import listStyles from './SelectionList.module.css';

export function SelectedList({
  cancelUnselectedRefresh,
  scheduleUnselectedRefresh,
  cancelSelectedRefresh,
  scheduleSelectedRefresh,
  isRefreshing,
  refreshError,
}: {
  cancelUnselectedRefresh: () => void;
  scheduleUnselectedRefresh: () => void;
  cancelSelectedRefresh: () => void;
  scheduleSelectedRefresh: () => void;
  isRefreshing: boolean;
  refreshError: string | null;
}) {
  const queryClient = useQueryClient();

  const deselectMutation = useMutation({
    mutationFn: deselectItem,
    onMutate: () =>
      Promise.all([cancelUnselectedRefresh(), cancelSelectedRefresh()]),
    onSettled: () => {
      scheduleUnselectedRefresh();

      scheduleSelectedRefresh();
    },
  });

  const handleMove = useReorderSelected();

  return (
    <Card title="Selected" className={listStyles.card}>
      {isRefreshing && (
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
        {deselectMutation.isError && (
          <Typography.Text type="danger">
            {deselectMutation.error.message}
          </Typography.Text>
        )}
        {refreshError && (
          <Typography.Text type="danger">{refreshError}</Typography.Text>
        )}
        <ListDnd
          onMove={handleMove}
          // Позициями строк управляет виртуализатор, поэтому отключаем перестановку DOM во время переноса.
          onDragOver={(event) => event.preventDefault()}
          renderOverlay={(id) => {
            const data = queryClient.getQueryData<
              InfiniteData<ItemsPage, number>
            >(itemsQueryKeys.selected);

            const item = data?.pages
              .flatMap((page) => page.items)
              .find((item) => item.id === id);

            return <Typography.Text>{item?.id}</Typography.Text>;
          }}
        >
          <InfiniteList
            queryKey={itemsQueryKeys.selected}
            initialPageParam={0}
            queryFn={({ pageParam, signal }) =>
              getItems('selected', pageParam, signal)
            }
            getNextPageParam={getNextItemsPageParam}
            getPreviousPageParam={getPreviousItemsPageParam}
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
                        label={`Переместить ${item.id}`}
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
      </Flex>
    </Card>
  );
}
