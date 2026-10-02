import {
  getItems,
  getNextItemsPageParam,
  itemsQueryKeys,
} from '../../../entities/item';
import { Button, Card, Flex, Input, Typography } from 'antd';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import { InfiniteList } from '../../../shared/ui/infinite-list';
import { ListRow } from '../../../shared/ui/list-row';
import { SearchInput } from './SearchInput';
import controls from './ListControls.module.css';

export function UnselectedList() {
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
        <InfiniteList
          queryKey={itemsQueryKeys.unselected}
          initialPageParam={0}
          queryFn={({ pageParam, signal }) => getItems(pageParam, signal)}
          getNextPageParam={getNextItemsPageParam}
          getItems={(page) => page.products}
          getItemKey={(item) => item.id}
          renderItem={(item) => (
            <ListRow
              action={
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  aria-label={`Добавить ${item.title}`}
                />
              }
            >
              <Typography.Text ellipsis style={{ minWidth: 0 }}>
                {item.title}
              </Typography.Text>
            </ListRow>
          )}
        />
      </Flex>
    </Card>
  );
}
