import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import uniqBy from 'lodash/uniqBy';
import {
  InfiniteList,
  type InfiniteListApi,
  useResetInfiniteListScroll,
} from '@/shared/ui/infinite-list';
import type { ItemsQuery } from '../model/useItemsQuery';
import type { Item } from '../model/types';
import { useDataVersionForScroll } from './useDataVersionForScroll';

export function ItemList({
  query,
  renderItem,
}: {
  query: ItemsQuery;
  renderItem: (item: Item, index: number) => ReactNode;
}) {
  const listApiRef = useRef<InfiniteListApi>(null);

  const getItemKey = useCallback((item: Item) => item.id, []);

  const items = useMemo(() => {
    const pages = query.data?.pages;

    if (pages === undefined) {
      return undefined;
    }

    // На всякий случай убираем дубликаты: при параллельной загрузке страницы могут временно отражать разное состояние сервера.
    return uniqBy(
      pages.flatMap((page) => page.items),
      getItemKey,
    );
  }, [query.data?.pages, getItemKey]);

  const dataVersionForScroll = useDataVersionForScroll(
    query.queryKey,
    query.data,
  );

  useResetInfiniteListScroll(listApiRef, dataVersionForScroll);

  return (
    <InfiniteList
      apiRef={listApiRef}
      items={items}
      isFetchingNextPage={query.isFetchingNextPage}
      isFetchingPreviousPage={query.isFetchingPreviousPage}
      hasNextPage={query.hasNextPage}
      hasPreviousPage={query.hasPreviousPage}
      fetchNextPage={query.fetchNextPage}
      fetchPreviousPage={query.fetchPreviousPage}
      getItemKey={getItemKey}
      renderItem={renderItem}
    />
  );
}
