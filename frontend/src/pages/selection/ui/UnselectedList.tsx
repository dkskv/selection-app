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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { selectItem } from '../../../entities/item';

export function UnselectedList() {
  const queryClient = useQueryClient();

  const selectMutation = useMutation({
    mutationFn: selectItem,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: itemsQueryKeys.unselected }),
        queryClient.invalidateQueries({ queryKey: itemsQueryKeys.selected }),
      ]);
    },
  });

  return (
    <Card title="Unselected" style={{ flex: 1, minWidth: 0 }}>
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
                  disabled={selectMutation.isPending}
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
