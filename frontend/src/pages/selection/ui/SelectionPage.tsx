import { useCallback, useState } from 'react';
import { Flex, message } from 'antd';
import { useItemsQuery } from '@/entities/item';
import { SelectedList } from './selected-list/SelectedList';
import { UnselectedList } from './unselected-list/UnselectedList';

export function SelectionPage() {
  const [unselectedSearch, setUnselectedSearch] = useState('');
  const [selectedSearch, setSelectedSearch] = useState('');
  const [messageApi, contextHolder] = message.useMessage();

  const onError = useCallback(
    (error: Error) => {
      messageApi.error(error.message);
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
