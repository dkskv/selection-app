import { useRef, type Key, type ReactNode } from 'react';
import type { InfiniteData } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useInfiniteListScroll } from './useInfiniteListScroll';
import styles from './InfiniteList.module.css';
import { ProgressLoader } from '../progress-loader';

export type InfiniteListProps<TPage, TItem, TPageParam> = {
  data: InfiniteData<TPage, TPageParam> | undefined;
  isFetchingNextPage: boolean;
  isFetchingPreviousPage: boolean;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  fetchPreviousPage: () => Promise<unknown>;
  getItems: (page: TPage) => TItem[];
  getItemKey: (item: TItem) => Key;
  renderItem: (item: TItem, index: number) => ReactNode;
};

/** Фиксированная высота строки в пикселях для расчёта виртуализации. */
const ROW_HEIGHT = 40;

/** Количество дополнительных строк за пределами видимой области. */
const OVERSCAN = 5;

export function InfiniteList<TPage, TItem, TPageParam>({
  data,
  isFetchingNextPage,
  isFetchingPreviousPage,
  hasNextPage,
  hasPreviousPage,
  fetchNextPage,
  fetchPreviousPage,
  getItems,
  getItemKey,
  renderItem,
}: InfiniteListProps<TPage, TItem, TPageParam>) {
  const scrollRef = useRef<HTMLDivElement>(null);

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
    <div className={styles.container}>
      <div
        ref={scrollRef}
        className={styles.scrollArea}
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
      {isFetchingPreviousPage && (
        <div className={styles.loaderTop}>
          <ProgressLoader />
        </div>
      )}
      {isFetchingNextPage && (
        <div className={styles.loaderBottom}>
          <ProgressLoader />
        </div>
      )}
    </div>
  );
}
