import { Button } from 'antd';
import MinusOutlined from '@ant-design/icons/MinusOutlined';
import { ItemList, ItemRow, type ItemsQuery } from '@/entities/item';
import { useToggleItemSelection } from '@/features/toggle-item-selection';
import {
  ReorderItems,
  useReorderItems,
} from '@/features/reorder-selected-items';
import { SortableItem, DragHandle } from '@/shared/ui/list-dnd';
import { useNotification } from '@/shared/lib/antd/useNotification';
import { ListPanel } from '../list-panel/ListPanel';

export function SelectedList({
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
  const [messageApi, contextHolder] = useNotification();

  const onError = (error: Error) => {
    messageApi.error({ message: error.message });
  };

  const { toggle, pendingItemIds } = useToggleItemSelection({
    selected: true,
    onSuccess: onSelectionChange,
    onError,
  });

  const { moveSelectedItem, pendingItemIds: pendingReorderItemIds } =
    useReorderItems(query, onError);

  return (
    <ListPanel
      title="Selected"
      loading={query.isLoading || query.isRefreshing}
      search={search}
      onSearchChange={onSearchChange}
    >
      {contextHolder}
      <ReorderItems onMove={moveSelectedItem}>
        <ItemList
          query={query}
          renderItem={(item, index) => (
            <SortableItem id={item.id} index={index}>
              {(handleRef) => (
                <ItemRow
                  item={item}
                  action={
                    <Button
                      size="small"
                      icon={<MinusOutlined />}
                      aria-label={`Deselect ${item.id}`}
                      loading={pendingItemIds.includes(item.id)}
                      disabled={pendingItemIds.includes(item.id)}
                      onClick={() => toggle(item.id)}
                    />
                  }
                  handle={
                    <DragHandle
                      ref={handleRef}
                      label={`Move ${item.id}`}
                      loading={pendingReorderItemIds.includes(item.id)}
                    />
                  }
                />
              )}
            </SortableItem>
          )}
        />
      </ReorderItems>
    </ListPanel>
  );
}
