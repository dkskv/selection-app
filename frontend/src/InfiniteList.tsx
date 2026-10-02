import { useRef, type UIEvent } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Spin, Typography } from 'antd';

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

/** Высота прокручиваемого блока в пикселях. */
const LIST_HEIGHT = 400;

/** Фиксированная высота строки в пикселях для расчёта виртуализации. */
const ROW_HEIGHT = 40;

/** Количество дополнительных строк за пределами видимой области. */
const OVERSCAN = 5;

/** Расстояние до конца блока в пикселях, при котором начинается подгрузка. */
const LOAD_MORE_THRESHOLD = 200;

export function InfiniteList() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isPending, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ['products'],
      initialPageParam: 0,
      queryFn: async ({ pageParam, signal }): Promise<ProductsPage> => {
        const response = await fetch(
          `https://dummyjson.com/products?limit=${PAGE_SIZE}&skip=${pageParam}&select=title`,
          { signal },
        );

        if (!response.ok) {
          throw new Error('Не удалось загрузить данные');
        }

        return response.json();
      },
      getNextPageParam: (lastPage) => {
        const nextSkip = lastPage.skip + lastPage.products.length;

        return nextSkip < lastPage.total ? nextSkip : undefined;
      },
    });

  const products = data?.pages.flatMap((page) => page.products) ?? [];

  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualRows = virtualizer.getVirtualItems();

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;

    if (
      scrollHeight - scrollTop - clientHeight <= LOAD_MORE_THRESHOLD &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage();
    }
  };

  return (
    <>
      <div
        ref={scrollRef}
        style={{ height: LIST_HEIGHT, overflow: 'auto' }}
        onScroll={handleScroll}
      >
        <div
          style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
        >
          {virtualRows.map((row) => (
            <div
              key={products[row.index]!.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: row.size,
                transform: `translateY(${row.start}px)`,
              }}
            >
              <Typography.Text ellipsis>
                {products[row.index]!.title}
              </Typography.Text>
            </div>
          ))}
        </div>
      </div>
      {(isPending || isFetchingNextPage) && <Spin />}
    </>
  );
}
