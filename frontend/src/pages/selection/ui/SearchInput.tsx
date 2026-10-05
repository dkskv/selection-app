import { Input } from 'antd';
import SearchOutlined from '@ant-design/icons/SearchOutlined';

export function SearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Input
      placeholder="Filter by ID"
      aria-label="Фильтр по ID"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      prefix={<SearchOutlined />}
    />
  );
}
