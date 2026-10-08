/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedRefresh } from './useDebouncedRefresh';

function deferred<T>() {
  return Promise.withResolvers<T>();
}

describe('Хук useDebouncedRefresh', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('объединяет ожидания вызовов, попавших в один debounce', async () => {
    vi.useFakeTimers();

    const markRefreshScheduled = vi.fn();
    const refresh = vi.fn<() => Promise<void>>().mockResolvedValue();

    const { result } = renderHook(() =>
      useDebouncedRefresh({ delay: 300, markRefreshScheduled, refresh }),
    );

    let first!: Promise<void>;
    let second!: Promise<void>;

    act(() => {
      first = result.current();

      second = result.current();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await Promise.all([first, second]);

    expect(markRefreshScheduled).toHaveBeenCalledTimes(2);

    expect(refresh).toHaveBeenCalledOnce();
  });

  it('разрешает ожидание только после завершения refresh', async () => {
    vi.useFakeTimers();

    const refreshRequest = deferred<void>();
    const refresh = vi.fn(() => refreshRequest.promise);

    const { result } = renderHook(() =>
      useDebouncedRefresh({
        delay: 300,
        markRefreshScheduled: vi.fn(),
        refresh,
      }),
    );

    let settled = false;
    let scheduledRefresh!: Promise<void>;

    act(() => {
      scheduledRefresh = result.current().then(() => {
        settled = true;
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(refresh).toHaveBeenCalledOnce();

    expect(settled).toBe(false);

    refreshRequest.resolve();

    await scheduledRefresh;

    expect(settled).toBe(true);
  });

  it('не смешивает ожидания нового вызова с уже выполняющимся refresh', async () => {
    vi.useFakeTimers();

    const refreshRequests = [deferred<void>(), deferred<void>()];

    const refresh = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(refreshRequests[0]!.promise)
      .mockReturnValueOnce(refreshRequests[1]!.promise);

    const { result } = renderHook(() =>
      useDebouncedRefresh({
        delay: 300,
        markRefreshScheduled: vi.fn(),
        refresh,
      }),
    );

    let firstSettled = false;
    let secondSettled = false;
    let first!: Promise<void>;
    let second!: Promise<void>;

    act(() => {
      first = result.current().then(() => {
        firstSettled = true;
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    act(() => {
      second = result.current().then(() => {
        secondSettled = true;
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    refreshRequests[0]!.resolve();

    await first;

    expect(firstSettled).toBe(true);

    expect(secondSettled).toBe(false);

    refreshRequests[1]!.resolve();

    await second;

    expect(secondSettled).toBe(true);

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('разрешает ожидание, если debounce отменён при размонтировании', async () => {
    vi.useFakeTimers();

    const refresh = vi.fn<() => Promise<void>>().mockResolvedValue();

    const { result, unmount } = renderHook(() =>
      useDebouncedRefresh({
        delay: 300,
        markRefreshScheduled: vi.fn(),
        refresh,
      }),
    );

    let settled = false;
    let scheduledRefresh!: Promise<void>;

    act(() => {
      scheduledRefresh = result.current().then(() => {
        settled = true;
      });
    });

    unmount();

    await scheduledRefresh;

    expect(settled).toBe(true);

    expect(refresh).not.toHaveBeenCalled();
  });

  it('разрешает ожидание при ошибке refresh и не выпускает необработанное отклонение', async () => {
    vi.useFakeTimers();

    const refreshError = new Error('Refresh failed');
    const refresh = vi.fn<() => Promise<void>>().mockRejectedValue(refreshError);

    const { result } = renderHook(() =>
      useDebouncedRefresh({
        delay: 300,
        markRefreshScheduled: vi.fn(),
        refresh,
      }),
    );

    let scheduledRefresh!: Promise<void>;

    act(() => {
      scheduledRefresh = result.current();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await expect(scheduledRefresh).resolves.toBeUndefined();

    expect(refresh).toHaveBeenCalledOnce();
  });
});
