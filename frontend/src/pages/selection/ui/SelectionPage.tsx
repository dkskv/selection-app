import { useCallback, useState } from 'react';
import { Flex, message } from 'antd';
import { useDebouncedRequest } from '../../../shared/lib/react/useDebouncedRequest';
import {
  getItems,
  getNextItemsPageParam,
  getPreviousItemsPageParam,
  itemsQueryKeys,
  type ItemsPage,
} from '../../../entities/item';
import { useSlidingWindowQuery } from '../../../shared/lib/react-query/useSlidingWindowQuery';
import { SelectedList } from './SelectedList';
import { UnselectedList } from './UnselectedList';

export function SelectionPage() {
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

  // TODO: Перенести вызовы хука в соответствующие компоненты списков.
  const unselectedQuery = useSlidingWindowQuery<ItemsPage, number>({
    queryKey: [...itemsQueryKeys.unselected, unselectedSearch],
    initialPageParam: 0,
    queryFn: fetchUnselectedPage,
    getNextPageParam: getNextItemsPageParam,
    getPreviousPageParam: getPreviousItemsPageParam,
    maxPages: 5,
    onError: handleRefreshError,
  });

  const selectedQuery = useSlidingWindowQuery<ItemsPage, number>({
    queryKey: [...itemsQueryKeys.selected, selectedSearch],
    initialPageParam: 0,
    queryFn: fetchSelectedPage,
    getNextPageParam: getNextItemsPageParam,
    getPreviousPageParam: getPreviousItemsPageParam,
    maxPages: 5,
    onError: handleRefreshError,
  });

  const unselectedRefresh = useDebouncedRequest({
    delay: 300,
    request: unselectedQuery.refresh,
  });

  const selectedRefresh = useDebouncedRequest({
    delay: 300,
    request: selectedQuery.refresh,
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
          selectedQueryKey={[...itemsQueryKeys.selected, selectedSearch]}
          search={selectedSearch}
          onSearchChange={setSelectedSearch}
          scheduleUnselectedRefresh={scheduleUnselectedRefresh}
          scheduleSelectedRefresh={scheduleSelectedRefresh}
        />
      </Flex>
    </Flex>
  );
}
