import { Button, Card, Flex, Typography } from 'antd';
import MinusOutlined from '@ant-design/icons/MinusOutlined';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { InfiniteList } from './InfiniteList';
import { ListRow } from './ListRow';
import { ListDnd, type ListMove } from './dnd/ListDnd';
import { SortableItem } from './dnd/SortableItem';
import { DragHandle } from './dnd/DragHandle';
import { moveItemAcrossPages } from './utils/moveItemAcrossPages';

type ProductsPage = {
  /** Элементы текущей страницы. */
  products: { id: number; title: string }[];
  /** Общее количество элементов в API. */
  total: number;
  /** Количество пропущенных элементов перед текущей страницей. */
  skip: number;
};

/** Количество элементов в одной странице API. */
const PAGE_SIZE = 20;
const PRODUCTS_QUERY_KEY = ['products', 'selected'] as const;

export function Selected() {
  const queryClient = useQueryClient();

  const handleMove = ({ fromIndex, toIndex }: ListMove) => {
    queryClient.setQueryData<InfiniteData<ProductsPage, number>>(
      PRODUCTS_QUERY_KEY,
      (data) => {
        if (!data) {
          return data;
        }

        // TODO: Учесть изменение порядка элементов в кеше во время переноса: fromIndex и toIndex могут устареть.
        return {
          ...data,
          pages: moveItemAcrossPages(
            data.pages,
            fromIndex,
            toIndex,
            (page) => page.products,
            (page, products) => ({ ...page, products }),
          ),
        };
      },
    );
  };

  return (
    <Card title="Selected" style={{ flex: 1, minWidth: 0 }}>
      <ListDnd
        onMove={handleMove}
        // Позициями строк управляет виртуализатор, поэтому отключаем перестановку DOM во время переноса.
        onDragOver={(event) => event.preventDefault()}
        renderOverlay={(id) => {
          const data =
            queryClient.getQueryData<InfiniteData<ProductsPage, number>>(
              PRODUCTS_QUERY_KEY,
            );

          const item = data?.pages
            .flatMap((page) => page.products)
            .find((item) => item.id === id);

          return <Typography.Text>{item?.title}</Typography.Text>;
        }}
      >
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
          renderItem={(item, index) => (
            <SortableItem id={item.id} index={index}>
              {(handleRef) => (
                <ListRow
                  action={
                    <Button
                      size="small"
                      icon={<MinusOutlined />}
                      aria-label={`Удалить ${item.title}`}
                    />
                  }
                >
                  <Flex align="center" gap="small" style={{ minWidth: 0 }}>
                    <DragHandle
                      ref={handleRef}
                      label={`Переместить ${item.title}`}
                    />
                    <Typography.Text ellipsis style={{ minWidth: 0 }}>
                      {item.title}
                    </Typography.Text>
                  </Flex>
                </ListRow>
              )}
            </SortableItem>
          )}
        />
      </ListDnd>
    </Card>
  );
}
