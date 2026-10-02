import type { ReactNode, Ref } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';

/** Настройки перетаскиваемого элемента списка. */
type SortableItemProps = {
  /** Уникальный идентификатор элемента в DnD-контексте. */
  id: string | number;
  /** Позиция элемента во всём загруженном списке. */
  index: number;
  /** Рендер содержимого с ref для кнопки переноса. */
  children: (handleRef: Ref<HTMLButtonElement>) => ReactNode;
};

/** Подключает сортировку элемента и передаёт ref для внешней ручки переноса. */
export function SortableItem({ id, index, children }: SortableItemProps) {
  const { ref, handleRef } = useSortable({ id, index });

  return (
    <div ref={ref} style={{ height: '100%' }}>
      {children(handleRef)}
    </div>
  );
}
