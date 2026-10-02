import type { CSSProperties, ReactNode } from 'react';
import { Flex, theme } from 'antd';
import styles from './ListRow.module.css';

type ListRowProps = {
  children: ReactNode;
  action: ReactNode;
};

export function ListRow({ children, action }: ListRowProps) {
  const { token } = theme.useToken();

  return (
    <Flex
      className={styles.row}
      justify="space-between"
      align="center"
      gap="small"
      style={
        { '--list-row-hover-bg': token.colorFillTertiary } as CSSProperties
      }
    >
      {children}
      <div className={styles.action}>{action}</div>
    </Flex>
  );
}
