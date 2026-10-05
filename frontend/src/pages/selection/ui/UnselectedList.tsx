import { createItem, selectItem, type ItemsPage } from '../../../entities/item';
import { useRef, useState } from 'react';
import { Button, Card, Flex, InputNumber, message, Spin, Typography } from 'antd';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import {
  InfiniteList,
  type InfiniteListHandle,
  useResetInfiniteListScroll,
} from '../../../shared/ui/infinite-list';
import { ListRow } from '../../../shared/ui/list-row';
import { SearchInput } from './SearchInput';
import controls from './ListControls.module.css';
import { useMutation, useMutationState } from '@tanstack/react-query';
import { ProgressLoader } from '../../../shared/ui/progress-loader';
import listStyles from './SelectionList.module.css';
import { useSlidingWindowQuery } from '../../../shared/lib/react-query/useSlidingWindowQuery';

type SlidingQuery = ReturnType<typeof useSlidingWindowQuery<ItemsPage, number>>;

export function UnselectedList({
  unselectedQuery,
  search,
  onSearchChange,
  scheduleUnselectedRefresh,
  scheduleSelectedRefresh,
}: {
  unselectedQuery: SlidingQuery;
  search: string;
  onSearchChange: (value: string) => void;
  scheduleUnselectedRefresh: () => void;
  scheduleSelectedRefresh: () => void;
}) {
  const [newItemId, setNewItemId] = useState<number | null>(null);
  const listRef = useRef<InfiniteListHandle>(null);
  const [messageApi, contextHolder] = message.useMessage();

  useResetInfiniteListScroll({
    listRef,
    scrollKey: search,
    isLoading:
      unselectedQuery.isPlaceholderData || unselectedQuery.isRefreshing,
  });

  const pendingSelectedItemIds = useMutationState<number>({
    filters: { mutationKey: ['select-item'], status: 'pending' },
    select: (mutation) => mutation.state.variables as number,
  });

  const pendingCreateCount = useMutationState({
    filters: { mutationKey: ['create-item'], status: 'pending' },
    select: () => true,
  }).length;

  const selectMutation = useMutation({
    mutationKey: ['select-item'],
    mutationFn: selectItem,
    onError: (error) => messageApi.error(error.message),
    onSuccess: () => {
      scheduleUnselectedRefresh();

      scheduleSelectedRefresh();
    },
  });

  const createMutation = useMutation({
    mutationKey: ['create-item'],
    mutationFn: createItem,
    onError: (error) => messageApi.error(error.message),
    onSuccess: scheduleUnselectedRefresh,
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
      {unselectedQuery.isRefreshing && (
        <div className={listStyles.progress}>
          <ProgressLoader />
        </div>
      )}
      <Flex vertical gap="middle">
        <Flex justify="space-between" gap={16} wrap>
          <div className={controls.control}>
            <SearchInput value={search} onChange={onSearchChange} />
          </div>
          <Flex align="center" gap={8} className={controls.control}>
            <InputNumber
              aria-label="Название элемента"
              className={controls.addInput}
              placeholder="Enter ID"
              value={newItemId}
              onChange={setNewItemId}
              onPressEnter={addItem}
            />
            {pendingCreateCount > 0 && (
              <span role="status" aria-label="Adding items">
                <Spin size="small" />
              </span>
            )}
            <Button
              className={controls.addButton}
              disabled={newItemId === null}
              onClick={addItem}
            >
              Add
            </Button>
          </Flex>
        </Flex>
        <InfiniteList
          ref={listRef}
          data={unselectedQuery.data}
          isFetchingNextPage={unselectedQuery.isFetchingNextPage}
          isFetchingPreviousPage={unselectedQuery.isFetchingPreviousPage}
          hasNextPage={unselectedQuery.hasNextPage}
          hasPreviousPage={unselectedQuery.hasPreviousPage}
          fetchNextPage={unselectedQuery.fetchNextPage}
          fetchPreviousPage={unselectedQuery.fetchPreviousPage}
          getItems={(page) => page.items}
          getItemKey={(item) => item.id}
          renderItem={(item) => (
            <ListRow
              action={
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  aria-label={`Добавить ${item.id}`}
                  loading={pendingSelectedItemIds.includes(item.id)}
                  disabled={pendingSelectedItemIds.includes(item.id)}
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
