import { Button, Card, Flex, Input, Typography } from 'antd';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import { InfiniteList } from './InfiniteList';
import { ListRow } from './ListRow';
import { SearchInput } from './SearchInput';
import controls from './ListControls.module.css';

type ProductsPage = {
  products: { id: number; title: string }[];
  total: number;
  skip: number;
};

const PAGE_SIZE = 20;
const PRODUCTS_QUERY_KEY = ['products', 'unselected'] as const;

export function Unselected() {
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
          queryKey={PRODUCTS_QUERY_KEY}
          initialPageParam={0}
          queryFn={async ({ pageParam, signal }): Promise<ProductsPage> => {
            const response = await fetch(
              `https://dummyjson.com/products?limit=${PAGE_SIZE}&skip=${pageParam}&select=title`,
              { signal },
            );

            if (!response.ok) {
              throw new Error('Не удалось загрузить данные');
            }

            return response.json();
          }}
          getNextPageParam={(lastPage) => {
            const nextSkip = lastPage.skip + lastPage.products.length;

            return nextSkip < lastPage.total ? nextSkip : undefined;
          }}
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
