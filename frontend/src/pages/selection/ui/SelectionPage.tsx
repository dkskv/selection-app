import { useCallback } from 'react';
import { Flex, message } from 'antd';
import {
  getItems,
  itemsQueryKeys,
  type ItemsPage,
} from '../../../entities/item';
import { useDebouncedRequest } from '../../../shared/lib/react/useDebouncedRequest';
import { useParallelPageRefresh } from '../../../shared/lib/react-query/useParallelPageRefresh';
import { SelectedList } from './SelectedList';
import { UnselectedList } from './UnselectedList';

export function SelectionPage() {
  const [messageApi, contextHolder] = message.useMessage();

  const fetchUnselectedPage = useCallback(
    (pageParam: number, signal: AbortSignal) =>
      getItems('unselected', pageParam, signal),
    [],
  );

  const fetchSelectedPage = useCallback(
    (pageParam: number, signal: AbortSignal) =>
      getItems('selected', pageParam, signal),
    [],
  );

  const handleRefreshError = useCallback(
    (error: Error) => messageApi.error(error.message),
    [messageApi],
  );

  const unselectedPages = useParallelPageRefresh<ItemsPage, number>({
    queryKey: itemsQueryKeys.unselected,
    initialPageParam: 0,
    fetchPage: fetchUnselectedPage,
    onError: handleRefreshError,
  });

  const selectedPages = useParallelPageRefresh<ItemsPage, number>({
    queryKey: itemsQueryKeys.selected,
    initialPageParam: 0,
    fetchPage: fetchSelectedPage,
    onError: handleRefreshError,
  });

  const {
    cancel: cancelUnselectedRefresh,
    scheduleRequest: scheduleUnselectedRefresh,
  } = useDebouncedRequest({
    delay: 300,
    request: unselectedPages.refresh,
    cancelRequest: unselectedPages.cancel,
  });

  const {
    cancel: cancelSelectedRefresh,
    scheduleRequest: scheduleSelectedRefresh,
  } = useDebouncedRequest({
    delay: 300,
    request: selectedPages.refresh,
    cancelRequest: selectedPages.cancel,
  });

  return (
    <Flex vertical gap="small">
      {contextHolder}
      <Flex gap="middle" align="stretch">
        <UnselectedList
          cancelUnselectedRefresh={cancelUnselectedRefresh}
          scheduleUnselectedRefresh={scheduleUnselectedRefresh}
          cancelSelectedRefresh={cancelSelectedRefresh}
          scheduleSelectedRefresh={scheduleSelectedRefresh}
          isRefreshing={unselectedPages.isRefreshing}
        />
        <SelectedList
          cancelUnselectedRefresh={cancelUnselectedRefresh}
          scheduleUnselectedRefresh={scheduleUnselectedRefresh}
          cancelSelectedRefresh={cancelSelectedRefresh}
          scheduleSelectedRefresh={scheduleSelectedRefresh}
          isRefreshing={selectedPages.isRefreshing}
        />
      </Flex>
    </Flex>
  );
}
