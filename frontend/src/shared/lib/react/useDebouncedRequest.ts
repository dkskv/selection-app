import { useCallback, useEffect, useMemo } from 'react';
import debounce from 'lodash.debounce';

type UseDebouncedRequestOptions = {
  delay: number;
  request: () => Promise<void>;
  cancelRequest?: () => void;
};

export function useDebouncedRequest({
  delay,
  request,
  cancelRequest,
}: UseDebouncedRequestOptions) {
  const scheduleRequest = useMemo(
    () =>
      debounce(() => {
        request();
      }, delay),
    [delay, request],
  );

  const cancel = useCallback(() => {
    scheduleRequest.cancel();

    cancelRequest?.();
  }, [cancelRequest, scheduleRequest]);

  useEffect(() => cancel, [cancel]);

  return { scheduleRequest, cancel };
}
