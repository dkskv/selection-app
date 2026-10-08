import { useCallback, useEffect, useMemo } from 'react';
import debounce from 'lodash/debounce';
import { useLatest } from './useLatest';

type UseDebouncedRequestOptions = {
  delay: number;
  request: () => Promise<void>;
  cancelRequest?: () => void;
};

/** Планирует запрос с задержкой и отменяет таймер при размонтировании. */
export function useDebouncedRequest({
  delay,
  request,
  cancelRequest,
}: UseDebouncedRequestOptions) {
  const requestRef = useLatest(request);
  const cancelRequestRef = useLatest(cancelRequest);

  const scheduleRequest = useMemo(
    () =>
      // debounce вызывает callback после задержки, за пределами рендера.
      // eslint-disable-next-line react-hooks/refs
      debounce(() => requestRef.current(), delay),
    [requestRef, delay],
  );

  const cancel = useCallback(() => {
    scheduleRequest.cancel();

    cancelRequestRef.current?.();
  }, [cancelRequestRef, scheduleRequest]);

  useEffect(() => cancel, [cancel]);

  return { scheduleRequest, cancel };
}
