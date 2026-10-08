import {
  useImperativeHandle,
  useRef,
  type Key,
  type ReactNode,
  type Ref,
} from 'react';
import type { InfiniteData } from '@tanstack/react-query';
import { useAnchoredVirtualizer } from './useAnchoredVirtualizer';
import { Empty } from 'antd';
import { useInfiniteListScroll } from './useInfiniteListScroll';
import styles from './InfiniteList.module.css';
import { ProgressLoader } from '@/shared/ui/progress-loader';

export type InfiniteListProps<TPage, TItem, TPageParam> = {
  ref?: Ref<InfiniteListHandle>;
  rowHeight?: number;
  overscan?: number;
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

export type InfiniteListHandle = {
  resetScroll: () => void;
};

/** Фиксированная высота строки по умолчанию в пикселях. */
const ROW_HEIGHT = 40;

/** Количество дополнительных строк за пределами видимой области по умолчанию. */
const OVERSCAN = 0;

export function InfiniteList<TPage, TItem, TPageParam>({
  ref,
  rowHeight = ROW_HEIGHT,
  overscan = OVERSCAN,
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

  const { virtualizer, resetScroll } = useAnchoredVirtualizer({
    items,
    getItemKey,
    getScrollElement: () => scrollRef.current,
    rowHeight,
    overscan,
  });

  useImperativeHandle(ref, () => ({ resetScroll }), [resetScroll]);

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
        <div
          style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
        >
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
        {data !== undefined && items.length === 0 && (
          <div className={styles.empty}>
            <Empty />
          </div>
        )}
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
