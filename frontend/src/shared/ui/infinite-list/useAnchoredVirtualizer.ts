import { useLayoutEffect, useRef, type Key } from 'react';
import {
  observeElementOffset,
  useVirtualizer,
  type ReactVirtualizerOptions,
  type VirtualizerOptions,
} from '@tanstack/react-virtual';
import { getScrollOffsetByAnchor } from './getScrollOffsetByAnchor';

type UseAnchoredVirtualizerArgs<T> = Pick<
  ReactVirtualizerOptions<HTMLDivElement, Element>,
  'overscan' | 'getScrollElement'
> & {
  items: readonly T[];
  getItemKey: (item: T) => Key;
  rowHeight: number;
};

/** Виртуализация строк фиксированной высоты с сохранением позиции по ключу. */
export function useAnchoredVirtualizer<T>({
  items,
  getItemKey,
  getScrollElement,
  rowHeight,
  overscan,
}: UseAnchoredVirtualizerArgs<T>) {
  const keys = items.map(getItemKey);
  const previousKeysRef = useRef<Key[]>([]);

  /** Актуальное (последнее полученное или программно вызванное) смещение прокрутки */
  const scrollOffsetRef = useRef(0);

  /** Передать актуальное смещение прокрутки в useVirtualizer и в scrollOffsetRef */
  const syncScrollOffsetRef = useRef<
    ((offset: number, isScrolling: boolean) => void) | null
  >(null);

  /** Наблюдает прокрутку и сохраняет callback для синхронизации */
  const observeScrollOffset: VirtualizerOptions<
    HTMLDivElement,
    Element
  >['observeElementOffset'] = (instance, callback) => {
    syncScrollOffsetRef.current = (offset: number, isScrolling: boolean) => {
      // Сохранить для нас
      scrollOffsetRef.current = offset;

      // Передать для useVirtualizer
      callback(offset, isScrolling);
    };

    const cleanup = observeElementOffset(instance, syncScrollOffsetRef.current);

    return () => {
      syncScrollOffsetRef.current = null;

      cleanup?.();
    };
  };

  const virtualizer = useVirtualizer({
    count: keys.length,
    getItemKey: (index) => keys[index]!,
    getScrollElement,
    estimateSize: () => rowHeight,
    overscan,
    observeElementOffset: observeScrollOffset,
  });

  const scrollToOffset = (offset: number) => {
    const element = getScrollElement();

    if (!element) {
      return;
    }

    virtualizer.scrollToOffset(offset, { behavior: 'instant' });

    syncScrollOffsetRef.current?.(element.scrollTop, false);
  };

  useLayoutEffect(() => {
    const previousKeys = previousKeysRef.current;

    previousKeysRef.current = keys;

    const element = getScrollElement();

    if (!element) {
      return;
    }

    const nextOffset = getScrollOffsetByAnchor({
      previousKeys,
      nextKeys: keys,
      previousOffset: scrollOffsetRef.current,
      rowHeight,
      viewportHeight: element.clientHeight,
    });

    if (
      nextOffset === element.scrollTop &&
      nextOffset === scrollOffsetRef.current
    ) {
      return;
    }

    scrollToOffset(nextOffset);
  });

  const resetScroll = () => {
    scrollToOffset(0);
  };

  return { virtualizer, resetScroll };
}
