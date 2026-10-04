import {
  getItems,
  getNextItemsPageParam,
  getPreviousItemsPageParam,
  itemsQueryKeys,
} from '../../../entities/item';
import { Button, Card, Flex, Input, Typography } from 'antd';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import { InfiniteList } from '../../../shared/ui/infinite-list';
import { ListRow } from '../../../shared/ui/list-row';
import { SearchInput } from './SearchInput';
import controls from './ListControls.module.css';
import { useMutation } from '@tanstack/react-query';
import { selectItem } from '../../../entities/item';
import { ProgressLoader } from '../../../shared/ui/progress-loader';
import listStyles from './SelectionList.module.css';

export function UnselectedList({
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
  const selectMutation = useMutation({
    mutationFn: selectItem,
    onMutate: () =>
      Promise.all([cancelUnselectedRefresh(), cancelSelectedRefresh()]),
    onSettled: () => {
      scheduleUnselectedRefresh();

      scheduleSelectedRefresh();
    },
  });

  return (
    <Card title="Unselected" className={listStyles.card}>
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
            <Input
              aria-label="Название элемента"
              className={controls.addInput}
            />
            <Button className={controls.addButton}>Добавить</Button>
          </Flex>
        </Flex>
        {selectMutation.isError && (
          <Typography.Text type="danger">
            {selectMutation.error.message}
          </Typography.Text>
        )}
        {refreshError && (
          <Typography.Text type="danger">{refreshError}</Typography.Text>
        )}
        <InfiniteList
          queryKey={itemsQueryKeys.unselected}
          initialPageParam={0}
          queryFn={({ pageParam, signal }) =>
            getItems('unselected', pageParam, signal)
          }
          getNextPageParam={getNextItemsPageParam}
          getPreviousPageParam={getPreviousItemsPageParam}
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
