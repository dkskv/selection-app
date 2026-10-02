import { Flex } from 'antd';
import { SelectedList } from './SelectedList';
import { UnselectedList } from './UnselectedList';

export function SelectionPage() {
  return (
    <Flex gap="middle" align="flex-start">
      <UnselectedList />
      <SelectedList />
    </Flex>
  );
}
