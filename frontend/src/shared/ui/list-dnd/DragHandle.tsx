import type { Ref } from 'react';
import { Button } from 'antd';
import HolderOutlined from '@ant-design/icons/HolderOutlined';

/** Настройки ручки переноса. */
type DragHandleProps = {
  /** Ref, полученный от SortableItem. */
  ref: Ref<HTMLButtonElement>;
  /** Доступное название действия переноса. */
  label: string;
  /** Показывает выполнение сохранения позиции. */
  loading?: boolean;
};

/** Отображает кнопку для начала переноса элемента. */
export function DragHandle({ ref, label, loading = false }: DragHandleProps) {
  return (
    <Button
      ref={ref}
      type="text"
      aria-label={label}
      loading={loading}
      icon={<HolderOutlined />}
      style={{ cursor: 'grab', touchAction: 'none', flexShrink: 0 }}
    />
  );
}
