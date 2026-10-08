import { useRef, type ReactNode } from 'react';
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

  const dataVersionForScroll = useDataVersionForScroll(
    query.queryKey,
    query.data,
  );

  useResetInfiniteListScroll(listApiRef, dataVersionForScroll);

  return (
    <InfiniteList
      apiRef={listApiRef}
      data={query.data}
      isFetchingNextPage={query.isFetchingNextPage}
      isFetchingPreviousPage={query.isFetchingPreviousPage}
      hasNextPage={query.hasNextPage}
      hasPreviousPage={query.hasPreviousPage}
      fetchNextPage={query.fetchNextPage}
      fetchPreviousPage={query.fetchPreviousPage}
      getItems={(page) => page.items}
      getItemKey={(item) => item.id}
      renderItem={renderItem}
    />
  );
}
