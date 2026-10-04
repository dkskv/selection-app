import { Alert, Flex } from 'antd';
import { SelectedList } from './SelectedList';
import { UnselectedList } from './UnselectedList';
import { useDebouncedSelectionRefresh } from '../model/useDebouncedSelectionRefresh';

export function SelectionPage() {
  const { error, cancelRefresh, scheduleRefresh } =
    useDebouncedSelectionRefresh();

  return (
    <Flex vertical gap="small">
      {error && <Alert type="error" title={error} />}
      <Flex gap="middle" align="stretch">
        <UnselectedList
          cancelRefresh={cancelRefresh}
          scheduleRefresh={scheduleRefresh}
        />
        <SelectedList
          cancelRefresh={cancelRefresh}
          scheduleRefresh={scheduleRefresh}
        />
      </Flex>
    </Flex>
  );
}
