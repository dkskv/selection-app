import { useCallback, useState } from 'react';
import { Flex, message } from 'antd';
import { useDebouncedRequest } from '@/shared/lib/react/useDebouncedRequest';
import {
  getItems,
  getNextItemsPageParam,
  getPreviousItemsPageParam,
  itemsQueryKeys,
  type ItemsPage,
} from '@/entities/item';
import { useSlidingWindowQuery } from '@/shared/lib/react-query/useSlidingWindowQuery';
import { removeOtherQueryCaches } from '@/shared/lib/react-query/useSlidingWindowQuery.helpers';
import { SelectedList } from './SelectedList';
import { UnselectedList } from './UnselectedList';
import { keepPreviousData, useQueryClient } from '@tanstack/react-query';

export function SelectionPage() {
  const queryClient = useQueryClient();
  const [unselectedSearch, setUnselectedSearch] = useState('');
  const [selectedSearch, setSelectedSearch] = useState('');
  const [messageApi, contextHolder] = message.useMessage();

  const fetchUnselectedPage = useCallback(
    (pageParam: number, signal: AbortSignal) =>
      getItems('unselected', pageParam, signal, unselectedSearch),
    [unselectedSearch],
  );

  const fetchSelectedPage = useCallback(
    (pageParam: number, signal: AbortSignal) =>
      getItems('selected', pageParam, signal, selectedSearch),
    [selectedSearch],
  );

  const handleRefreshError = useCallback(
    (error: Error) => messageApi.error(error.message),
    [messageApi],
  );

  const unselectedQueryKey = [...itemsQueryKeys.unselected, unselectedSearch];
  const selectedQueryKey = [...itemsQueryKeys.selected, selectedSearch];

  // TODO: Перенести вызовы хука в соответствующие компоненты списков.
  const unselectedQuery = useSlidingWindowQuery<ItemsPage, number>({
    queryKey: unselectedQueryKey,
    initialPageParam: 0,
    queryFn: fetchUnselectedPage,
    getNextPageParam: getNextItemsPageParam,
    getPreviousPageParam: getPreviousItemsPageParam,
    maxPages: 5,
    onError: handleRefreshError,
    placeholderData: keepPreviousData,
  });

  const selectedQuery = useSlidingWindowQuery<ItemsPage, number>({
    queryKey: selectedQueryKey,
    initialPageParam: 0,
    queryFn: fetchSelectedPage,
    getNextPageParam: getNextItemsPageParam,
    getPreviousPageParam: getPreviousItemsPageParam,
    maxPages: 5,
    onError: handleRefreshError,
    placeholderData: keepPreviousData,
  });

  const unselectedRefresh = useDebouncedRequest({
    delay: 300,
    request: () => {
      removeOtherQueryCaches(
        queryClient,
        itemsQueryKeys.unselected,
        unselectedQueryKey,
      );

      return unselectedQuery.refresh();
    },
  });

  const selectedRefresh = useDebouncedRequest({
    delay: 300,
    request: () => {
      removeOtherQueryCaches(
        queryClient,
        itemsQueryKeys.selected,
        selectedQueryKey,
      );

      return selectedQuery.refresh();
    },
  });

  const prepareUnselectedRefresh = unselectedQuery.scheduleRefresh;
  const requestUnselectedRefresh = unselectedRefresh.scheduleRequest;

  const scheduleUnselectedRefresh = useCallback(() => {
    prepareUnselectedRefresh();

    requestUnselectedRefresh();
  }, [prepareUnselectedRefresh, requestUnselectedRefresh]);

  const prepareSelectedRefresh = selectedQuery.scheduleRefresh;
  const requestSelectedRefresh = selectedRefresh.scheduleRequest;

  const scheduleSelectedRefresh = useCallback(() => {
    prepareSelectedRefresh();

    requestSelectedRefresh();
  }, [prepareSelectedRefresh, requestSelectedRefresh]);

  return (
    <Flex vertical gap="small">
      {contextHolder}
      <Flex gap="middle" align="stretch">
        <UnselectedList
          unselectedQuery={unselectedQuery}
          search={unselectedSearch}
          onSearchChange={setUnselectedSearch}
          scheduleUnselectedRefresh={scheduleUnselectedRefresh}
          scheduleSelectedRefresh={scheduleSelectedRefresh}
        />
        <SelectedList
          selectedQuery={selectedQuery}
          selectedQueryKey={selectedQueryKey}
          search={selectedSearch}
          onSearchChange={setSelectedSearch}
          scheduleUnselectedRefresh={scheduleUnselectedRefresh}
          scheduleSelectedRefresh={scheduleSelectedRefresh}
        />
      </Flex>
    </Flex>
  );
}
