import type { ReactNode } from 'react';
import {
  DragDropProvider,
  DragOverlay,
  type DragDropEventHandlers,
} from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';

/** Результат переноса элемента в списке. */
export type ListMove = {
  /** Идентификатор перенесённого элемента. */
  id: string | number;
  /** Позиция элемента до переноса. */
  fromIndex: number;
  /** Позиция элемента после переноса. */
  toIndex: number;
};

/** Настройки переноса и его отображения. */
type ListDndProps = {
  /** Список с перетаскиваемыми элементами. */
  children: ReactNode;
  /** Пользовательское действие после изменения позиции элемента. */
  onMove: (move: ListMove) => void;
  /** Показывает позицию вставки во время перетаскивания. */
  onDropTargetChange?: (
    target: { move: ListMove; element: Element } | null,
  ) => void;
  /** Дополнительная обработка наведения на цель переноса. */
  onDragOver?: DragDropEventHandlers['onDragOver'];
  /** Отображение копии перетаскиваемого элемента. */
  renderOverlay: (id: string | number) => ReactNode;
};

/** Подключает DnD списка и сообщает о завершённых переносах. */
export function ListDnd({
  children,
  onMove,
  onDropTargetChange,
  onDragOver,
  renderOverlay,
}: ListDndProps) {
  return (
    <DragDropProvider
      onDragOver={(event, manager) => {
        onDragOver?.(event, manager);

        const { source, target } = event.operation;

        if (
          onDropTargetChange &&
          isSortable(source) &&
          isSortable(target) &&
          source.id !== target.id
        ) {
          const element = target.sortable.element;

          if (element) {
            onDropTargetChange({
              move: {
                id: source.id,
                fromIndex: source.initialIndex,
                toIndex: target.index,
              },
              element,
            });
          }
        } else {
          onDropTargetChange?.(null);
        }
      }}
      onDragEnd={(event) => {
        const { source, target } = event.operation;

        if (event.canceled) {
          onDropTargetChange?.(null);

          return;
        }

        if (!isSortable(source) || !isSortable(target)) {
          onDropTargetChange?.(null);

          return;
        }

        // При автоматической сортировке dnd-kit цель совпадает с источником.
        const toIndex = source.id === target.id ? source.index : target.index;

        if (source.initialIndex === toIndex) {
          onDropTargetChange?.(null);

          return;
        }

        onMove({
          id: source.id,
          fromIndex: source.initialIndex,
          toIndex,
        });

        onDropTargetChange?.(null);
      }}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {(source) => renderOverlay(source.id)}
      </DragOverlay>
    </DragDropProvider>
  );
}
