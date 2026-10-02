import { Flex } from 'antd';
import { Selected } from './Selected';
import { Unselected } from './Unselected';

export function App() {
  return (
    <Flex gap="middle" align="flex-start">
      <Unselected />
      <Selected />
    </Flex>
  );
}
