import type { Ref } from 'react';
import { Button } from 'antd';

/** Настройки ручки переноса. */
type DragHandleProps = {
  /** Ref, полученный от SortableItem. */
  ref: Ref<HTMLButtonElement>;
  /** Доступное название действия переноса. */
  label: string;
};

/** Отображает кнопку для начала переноса элемента. */
export function DragHandle({ ref, label }: DragHandleProps) {
  return (
    <Button
      ref={ref}
      type="text"
      aria-label={label}
      style={{ cursor: 'grab', touchAction: 'none' }}
    >
      ⠿
    </Button>
  );
}
