import { Input } from 'antd';
import SearchOutlined from '@ant-design/icons/SearchOutlined';

export function SearchInput() {
  return (
    <Input
      placeholder="Filter by ID"
      aria-label="Фильтр по ID"
      prefix={<SearchOutlined />}
    />
  );
}
