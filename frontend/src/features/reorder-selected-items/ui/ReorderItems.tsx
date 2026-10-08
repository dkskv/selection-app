import { useRef, useState, type ReactNode } from 'react';
import { Typography } from 'antd';
import { ListDnd, type ListMove } from '@/shared/ui/list-dnd';
import { getRelativeRect } from '@/shared/lib/dom';
import { DropIndicator } from './DropIndicator';
import listStyles from './ReorderItems.module.css';

export function ReorderItems({
  onMove,
  children,
}: {
  onMove: (move: ListMove) => void;
  children: ReactNode;
}) {
  const listContainerRef = useRef<HTMLDivElement>(null);

  const [dropIndicatorPosition, setDropIndicatorPosition] = useState<{
    top: number;
    left: number;
    right: number;
  } | null>(null);

  return (
    <div className={listStyles.dragArea} ref={listContainerRef}>
      <ListDnd
        onMove={onMove}
        onDropTargetChange={(target) => {
          if (!target || !listContainerRef.current) {
            setDropIndicatorPosition(null);

            return;
          }

          const targetPosition = getRelativeRect(
            target.element,
            listContainerRef.current,
          );

          const insertAfter = target.move.fromIndex < target.move.toIndex;

          setDropIndicatorPosition({
            top: targetPosition.top + (insertAfter ? targetPosition.height : 0),
            left: targetPosition.left,
            right: targetPosition.right,
          });
        }}
        // Позициями строк управляет виртуализатор, поэтому отключаем перестановку DOM во время переноса.
        onDragOver={(event) => event.preventDefault()}
        renderOverlay={(id) => <Typography.Text>{id}</Typography.Text>}
      >
        {children}
      </ListDnd>
      {dropIndicatorPosition !== null && (
        <DropIndicator {...dropIndicatorPosition} />
      )}
    </div>
  );
}
