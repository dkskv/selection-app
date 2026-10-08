import { useMemo } from 'react';
import { hashKey, type QueryKey } from '@tanstack/react-query';

/** Возвращает версию данных, изменение которой должно приводить к сбросу скролла */
export function useDataVersionForScroll(
  queryKey: QueryKey,
  data: object | undefined,
): string {
  return useMemo(
    () => (data === undefined ? '' : hashKey(queryKey)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );
}
