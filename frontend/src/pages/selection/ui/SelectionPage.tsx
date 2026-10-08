import { useCallback, useState } from 'react';
import { Flex } from 'antd';
import { useItemsQuery } from '@/entities/item';
import { useNotification } from '@/shared/lib/antd/useNotification';
import { SelectedList } from './selected-list/SelectedList';
import { UnselectedList } from './unselected-list/UnselectedList';

export function SelectionPage() {
  const [messageApi, contextHolder] = useNotification();

  const [unselectedSearch, setUnselectedSearch] = useState('');
  const [selectedSearch, setSelectedSearch] = useState('');

  const onError = useCallback(
    (error: Error) => {
      messageApi.error({ message: error.message });
    },
    [messageApi],
  );

  const unselectedQuery = useItemsQuery(
    'unselected',
    unselectedSearch,
    onError,
  );

  const selectedQuery = useItemsQuery('selected', selectedSearch, onError);

  const refreshSelection = () => {
    unselectedQuery.scheduleRefresh();

    selectedQuery.scheduleRefresh();
  };

  return (
    <Flex vertical gap="small">
      {contextHolder}
      <Flex gap="middle" align="stretch">
        <UnselectedList
          query={unselectedQuery}
          search={unselectedSearch}
          onSearchChange={setUnselectedSearch}
          onSelectionChange={refreshSelection}
        />
        <SelectedList
          query={selectedQuery}
          search={selectedSearch}
          onSearchChange={setSelectedSearch}
          onSelectionChange={refreshSelection}
        />
      </Flex>
    </Flex>
  );
}
