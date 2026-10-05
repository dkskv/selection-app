/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MutationObserver, QueryClient } from '@tanstack/query-core';
import { useDebouncedRequest } from './useDebouncedRequest';

describe('Хук useDebouncedRequest', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('объединяет успешные мутации в один запрос обновления', async () => {
    vi.useFakeTimers();

    const request = vi.fn<() => Promise<void>>().mockResolvedValue();
    const scheduleRefresh = vi.fn();

    const { result } = renderHook(() =>
      useDebouncedRequest({ delay: 300, request }),
    );

    const queryClient = new QueryClient();

    const mutation = new MutationObserver<void, Error, void>(queryClient, {
      mutationFn: async () => undefined,
      onSuccess: () => {
        scheduleRefresh();

        result.current.scheduleRequest();
      },
    });

    await Promise.all([mutation.mutate(), mutation.mutate(), mutation.mutate()]);

    expect(request).not.toHaveBeenCalled();

    expect(scheduleRefresh).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(300);

    expect(request).toHaveBeenCalledTimes(1);

    queryClient.clear();
  });

  it('не планирует обновление после ошибки мутации', async () => {
    vi.useFakeTimers();

    const request = vi.fn<() => Promise<void>>().mockResolvedValue();
    const scheduleRefresh = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useDebouncedRequest({ delay: 300, request }),
    );

    const queryClient = new QueryClient();

    const mutation = new MutationObserver<void, Error, void>(queryClient, {
      mutationFn: async () => {
        throw new Error('Ошибка мутации');
      },
      onSuccess: () => {
        scheduleRefresh();

        result.current.scheduleRequest();
      },
      onError,
    });

    await expect(mutation.mutate()).rejects.toThrow('Ошибка мутации');

    await vi.advanceTimersByTimeAsync(300);

    expect(onError).toHaveBeenCalledOnce();

    expect(scheduleRefresh).not.toHaveBeenCalled();

    expect(request).not.toHaveBeenCalled();

    queryClient.clear();
  });

  it('отменяет только таймер debounce, если отмена запроса не передана', () => {
    vi.useFakeTimers();

    const request = vi.fn<() => Promise<void>>().mockResolvedValue();

    const { result } = renderHook(() =>
      useDebouncedRequest({ delay: 300, request }),
    );

    result.current.scheduleRequest();

    result.current.cancel();

    expect(request).not.toHaveBeenCalled();
  });
});
