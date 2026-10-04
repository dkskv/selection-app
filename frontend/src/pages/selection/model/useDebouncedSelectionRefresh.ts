import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import debounce from 'lodash.debounce';
import { useQueryClient } from '@tanstack/react-query';
import { itemsQueryKeys } from '../../../entities/item';
import { useMounted } from '../../../shared/lib/react/useMounted';
import { refreshSelectionLists } from './refreshSelectionLists';

export function useDebouncedSelectionRefresh() {
  const queryClient = useQueryClient();
  const isMounted = useMounted();
  const [error, setError] = useState<string | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const debouncedRefresh = useMemo(
    () =>
      debounce(async (controller: AbortController) => {
        let errorMessage: string | null = null;

        try {
          await refreshSelectionLists(queryClient, controller.signal);
        } catch (caughtError) {
          if (
            caughtError instanceof DOMException &&
            caughtError.name === 'AbortError'
          ) {
            return;
          }

          errorMessage =
            caughtError instanceof Error
              ? caughtError.message
              : 'Не удалось обновить списки';
        }

        setError(errorMessage);
      }, 300),
    [queryClient],
  );

  const cancelRefresh = useCallback(async () => {
    debouncedRefresh.cancel();

    abortController.current?.abort();

    abortController.current = null;

    setError(null);

    await Promise.all([
      queryClient.cancelQueries({ queryKey: itemsQueryKeys.selected }),
      queryClient.cancelQueries({ queryKey: itemsQueryKeys.unselected }),
    ]);
  }, [debouncedRefresh, queryClient]);

  useEffect(
    () => () => {
      cancelRefresh();
    },
    [cancelRefresh],
  );

  const scheduleRefresh = useCallback(() => {
    if (!isMounted()) {
      return;
    }

    const controller = new AbortController();

    abortController.current = controller;

    setError(null);

    debouncedRefresh(controller);
  }, [debouncedRefresh, isMounted]);

  return { error, cancelRefresh, scheduleRefresh };
}
