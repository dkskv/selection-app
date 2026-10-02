import { Button, Card, Flex, Input, Typography } from 'antd';
import { InfiniteList } from './InfiniteList';

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
        <Flex gap="small">
          <Input aria-label="Название элемента" />
          <Button>Добавить</Button>
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
            <Typography.Text ellipsis>{item.title}</Typography.Text>
          )}
        />
      </Flex>
    </Card>
  );
}
