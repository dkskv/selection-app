import { useLayoutEffect, useRef } from 'react';

/** Хранит последнее значение в ref, обновляя его после каждого рендера. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);

  useLayoutEffect(() => {
    ref.current = value;
  });

  return ref;
}
