import { useRef, type Key, type ReactNode } from 'react';
import {
  useInfiniteQuery,
  type QueryFunction,
  type QueryKey,
  type GetNextPageParamFunction,
  type GetPreviousPageParamFunction,
} from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useInfiniteListScroll } from './useInfiniteListScroll';

export type InfiniteListProps<TPage, TItem, TPageParam> = {
  queryKey: QueryKey;
  queryFn: QueryFunction<TPage, QueryKey, TPageParam>;
  initialPageParam: TPageParam;
  getNextPageParam: GetNextPageParamFunction<TPageParam, TPage>;
  getPreviousPageParam: GetPreviousPageParamFunction<TPageParam, TPage>;
  getItems: (page: TPage) => TItem[];
  getItemKey: (item: TItem) => Key;
  renderItem: (item: TItem, index: number) => ReactNode;
};

/** Высота прокручиваемого блока в пикселях. */
const LIST_HEIGHT = 400;

/** Фиксированная высота строки в пикселях для расчёта виртуализации. */
const ROW_HEIGHT = 40;

/** Количество дополнительных строк за пределами видимой области. */
const OVERSCAN = 5;

/** Максимальное количество страниц, хранящихся в кеше списка. */
const MAX_PAGES = 5;

export function InfiniteList<TPage, TItem, TPageParam>({
  queryKey,
  queryFn,
  initialPageParam,
  getNextPageParam,
  getPreviousPageParam,
  getItems,
  getItemKey,
  renderItem,
}: InfiniteListProps<TPage, TItem, TPageParam>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isFetchingNextPage,
    isFetchingPreviousPage,
    hasNextPage,
    hasPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn,
    initialPageParam,
    getNextPageParam,
    getPreviousPageParam,
    maxPages: MAX_PAGES,
  });

  const items = data?.pages.flatMap(getItems) ?? [];

  const virtualizer = useVirtualizer({
    count: items.length,
    getItemKey: (index) => `item:${getItemKey(items[index]!)}`,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    // Сохраняет видимую строку при добавлении страницы сверху и вытеснении страниц с края.
    anchorTo: 'end',
  });

  const virtualRows = virtualizer.getVirtualItems();

  const handleScroll = useInfiniteListScroll({
    hasPreviousPage,
    hasNextPage,
    isFetchingPreviousPage,
    isFetchingNextPage,
    fetchPreviousPage,
    fetchNextPage,
  });

  return (
    <div
      ref={scrollRef}
      style={{ height: LIST_HEIGHT, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualRows.map((row) => {
          return (
            <div
              key={row.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: row.size,
                transform: `translateY(${row.start}px)`,
              }}
            >
              {renderItem(items[row.index]!, row.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
