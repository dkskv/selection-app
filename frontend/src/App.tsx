import { Space, Typography } from 'antd';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { InfiniteList } from './InfiniteList';
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
const PRODUCTS_QUERY_KEY = ['products'] as const;

export function App() {
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
              <Space>
                <DragHandle
                  ref={handleRef}
                  label={`Переместить ${item.title}`}
                />
                <Typography.Text ellipsis>{item.title}</Typography.Text>
              </Space>
            )}
          </SortableItem>
        )}
      />
    </ListDnd>
  );
}
