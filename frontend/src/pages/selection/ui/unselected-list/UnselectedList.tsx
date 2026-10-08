import { Button, message } from 'antd';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import { ItemList, ItemRow, type ItemsQuery } from '@/entities/item';
import { useToggleItemSelection } from '@/features/toggle-item-selection';
import { CreateItemForm } from '@/features/create-item';
import { ListPanel } from '../list-panel/ListPanel';

export function UnselectedList({
  query,
  search,
  onSearchChange,
  onSelectionChange,
}: {
  query: ItemsQuery;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectionChange: () => void;
}) {
  const [messageApi, contextHolder] = message.useMessage();

  const onError = (error: Error) => {
    messageApi.error(error.message);
  };

  const { toggle, pendingItemIds } = useToggleItemSelection({
    selected: false,
    onSuccess: onSelectionChange,
    onError,
  });

  return (
    <ListPanel
      title="Unselected"
      loading={query.isLoading || query.isRefreshing}
      search={search}
      onSearchChange={onSearchChange}
      actions={<CreateItemForm onSuccess={query.scheduleRefresh} />}
    >
      {contextHolder}
      <ItemList
        query={query}
        search={search}
        renderItem={(item) => (
          <ItemRow
            item={item}
            action={
              <Button
                size="small"
                icon={<PlusOutlined />}
                aria-label={`Select ${item.id}`}
                loading={pendingItemIds.includes(item.id)}
                disabled={pendingItemIds.includes(item.id)}
                onClick={() => toggle(item.id)}
              />
            }
          />
        )}
      />
    </ListPanel>
  );
}
