import { createItem, selectItem, type ItemsPage } from '../../../entities/item';
import { useState } from 'react';
import { Button, Card, Flex, InputNumber, message, Typography } from 'antd';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import { InfiniteList } from '../../../shared/ui/infinite-list';
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
  const [messageApi, contextHolder] = message.useMessage();

  const pendingSelectedItemIds = useMutationState<number>({
    filters: { mutationKey: ['select-item'], status: 'pending' },
    select: (mutation) => mutation.state.variables as number,
  });

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
        <Flex gap={8} wrap>
          <div className={controls.half}>
            <SearchInput value={search} onChange={onSearchChange} />
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
          data={unselectedQuery.data}
          isFetchingNextPage={unselectedQuery.isFetchingNextPage}
          isFetchingPreviousPage={unselectedQuery.isFetchingPreviousPage}
          isDataLoading={unselectedQuery.isPlaceholderData || unselectedQuery.isRefreshing}
          resetScrollKey={search}
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
