import { useRef, type Key, type ReactNode, type UIEvent } from 'react';
import {
  useInfiniteQuery,
  type QueryFunction,
  type QueryKey,
  type GetNextPageParamFunction,
} from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Spin } from 'antd';

export type InfiniteListProps<TPage, TItem, TPageParam> = {
  queryKey: QueryKey;
  queryFn: QueryFunction<TPage, QueryKey, TPageParam>;
  initialPageParam: TPageParam;
  getNextPageParam: GetNextPageParamFunction<TPageParam, TPage>;
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

/** Расстояние до конца блока в пикселях, при котором начинается подгрузка. */
const LOAD_MORE_THRESHOLD = 200;

export function InfiniteList<TPage, TItem, TPageParam>({
  queryKey,
  queryFn,
  initialPageParam,
  getNextPageParam,
  getItems,
  getItemKey,
  renderItem,
}: InfiniteListProps<TPage, TItem, TPageParam>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isPending, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey,
      queryFn,
      initialPageParam,
      getNextPageParam,
    });

  const items = data?.pages.flatMap(getItems) ?? [];

  const virtualizer = useVirtualizer({
    count: items.length,
    getItemKey: (index) => getItemKey(items[index]!),
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
          ))}
        </div>
      </div>
      {(isPending || isFetchingNextPage) && <Spin />}
    </>
  );
}
