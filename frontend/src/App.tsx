import { Typography } from 'antd';
import { InfiniteList } from './InfiniteList';

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

export function App() {
  return (
    <InfiniteList
      queryKey={['products']}
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
  );
}
