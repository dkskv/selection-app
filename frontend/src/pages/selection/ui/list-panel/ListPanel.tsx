import type { ReactNode } from 'react';
import { Card, Flex } from 'antd';
import { ProgressLoader } from '@/shared/ui/progress-loader';
import { SearchInput } from './SearchInput';
import styles from './ListPanel.module.css';

export function ListPanel({
  title,
  loading,
  search,
  onSearchChange,
  actions,
  children,
}: {
  title: string;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card title={title} className={styles.card}>
      {loading && (
        <div className={styles.progress}>
          <ProgressLoader />
        </div>
      )}
      <Flex vertical gap="middle">
        <Flex justify="space-between" gap={16} wrap>
          <div className={styles.search}>
            <SearchInput value={search} onChange={onSearchChange} />
          </div>
          {actions}
        </Flex>
        {children}
      </Flex>
    </Card>
  );
}
