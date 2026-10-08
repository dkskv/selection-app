import type { ReactNode } from 'react';
import { Flex } from 'antd';
import styles from './ListRow.module.css';

type ListRowProps = {
  children: ReactNode;
};

export function ListRow({ children }: ListRowProps) {
  return (
    <Flex
      className={styles.row}
      align="center"
      gap="small"
    >
      {children}
    </Flex>
  );
}
