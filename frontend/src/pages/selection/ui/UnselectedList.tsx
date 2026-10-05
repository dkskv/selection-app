import {
  getItems,
  getNextItemsPageParam,
  getPreviousItemsPageParam,
  itemsQueryKeys,
} from '../../../entities/item';
import { useState } from 'react';
import { Button, Card, Flex, InputNumber, message, Typography } from 'antd';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import { InfiniteList } from '../../../shared/ui/infinite-list';
import { ListRow } from '../../../shared/ui/list-row';
import { SearchInput } from './SearchInput';
import controls from './ListControls.module.css';
import { useMutation } from '@tanstack/react-query';
import { useInfiniteQuery } from '@tanstack/react-query';
import { createItem, selectItem } from '../../../entities/item';
import { ProgressLoader } from '../../../shared/ui/progress-loader';
import listStyles from './SelectionList.module.css';

export function UnselectedList({
  cancelUnselectedRefresh,
  scheduleUnselectedRefresh,
  cancelSelectedRefresh,
  scheduleSelectedRefresh,
  isRefreshing,
}: {
  cancelUnselectedRefresh: () => void;
  scheduleUnselectedRefresh: () => void;
  cancelSelectedRefresh: () => void;
  scheduleSelectedRefresh: () => void;
  isRefreshing: boolean;
}) {
  const [newItemId, setNewItemId] = useState<number | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const selectMutation = useMutation({
    mutationFn: selectItem,
    onError: (error) => messageApi.error(error.message),
    onMutate: () =>
      Promise.all([cancelUnselectedRefresh(), cancelSelectedRefresh()]),
    onSuccess: () => {
      scheduleUnselectedRefresh();

      scheduleSelectedRefresh();
    },
  });

  const createMutation = useMutation({
    mutationFn: createItem,
    onError: (error) => messageApi.error(error.message),
    onMutate: cancelUnselectedRefresh,
    onSuccess: scheduleUnselectedRefresh,
  });

  const itemsQuery = useInfiniteQuery({
    queryKey: itemsQueryKeys.unselected,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      getItems('unselected', pageParam, signal),
    getNextPageParam: getNextItemsPageParam,
    getPreviousPageParam: getPreviousItemsPageParam,
    maxPages: 5,
  });

  const addItem = () => {
    if (newItemId === null) return;

    createMutation.mutate(newItemId, {
      onSuccess: () => setNewItemId(null),
    });
  };

  return (
    <Card title="Unselected" className={listStyles.card}>
      {contextHolder}
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
          <Flex gap={8} className={controls.half}>
            <InputNumber
              aria-label="Название элемента"
              className={controls.addInput}
              placeholder="Enter ID"
              value={newItemId}
              onChange={setNewItemId}
              onPressEnter={addItem}
            />
            <Button
              className={controls.addButton}
              loading={createMutation.isPending}
              disabled={newItemId === null || createMutation.isPending}
              onClick={addItem}
            >
              Add
            </Button>
          </Flex>
        </Flex>
        <InfiniteList
          data={itemsQuery.data}
          isFetchingNextPage={itemsQuery.isFetchingNextPage}
          isFetchingPreviousPage={itemsQuery.isFetchingPreviousPage}
          hasNextPage={itemsQuery.hasNextPage}
          hasPreviousPage={itemsQuery.hasPreviousPage}
          fetchNextPage={itemsQuery.fetchNextPage}
          fetchPreviousPage={itemsQuery.fetchPreviousPage}
          getItems={(page) => page.items}
          getItemKey={(item) => item.id}
          renderItem={(item) => (
            <ListRow
              action={
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  aria-label={`Добавить ${item.id}`}
                  loading={
                    selectMutation.isPending &&
                    selectMutation.variables === item.id
                  }
                  disabled={
                    selectMutation.isPending &&
                    selectMutation.variables === item.id
                  }
                  onClick={() => selectMutation.mutate(item.id)}
                />
              }
            >
              <Typography.Text ellipsis style={{ minWidth: 0 }}>
                {item.id}
              </Typography.Text>
            </ListRow>
          )}
        />
      </Flex>
    </Card>
  );
}
