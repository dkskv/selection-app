import type { ReactNode } from 'react';
import { Flex, Typography } from 'antd';
import { ListRow } from '@/shared/ui/list-row';
import type { Item } from '../model/types';

export function ItemRow({
  item,
  action,
  handle,
}: {
  item: Item;
  action: ReactNode;
  handle?: ReactNode;
}) {
  return (
    <ListRow action={action}>
      <Flex align="center" gap="small" style={{ minWidth: 0 }}>
        {handle}
        <Typography.Text ellipsis style={{ minWidth: 0 }}>
          {item.id}
        </Typography.Text>
      </Flex>
    </ListRow>
  );
}
