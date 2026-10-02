import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeduplicatedBatcher } from './DeduplicatedBatcher.js';

describe('DeduplicatedBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();

    vi.useRealTimers();
  });

  it('собирает вызовы в окно от первого вызова и распределяет результаты по порядку', async () => {
    const batchCallback = vi.fn((args: number[]) =>
      args.map((arg) => arg * 10),
    );

    const batcher = new DeduplicatedBatcher(batchCallback, (arg) => arg, 100);

    const firstResult = batcher.call(3);

    await vi.advanceTimersByTimeAsync(70);

    const secondResult = batcher.call(1);

    await vi.advanceTimersByTimeAsync(29);

    expect(batchCallback).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(batchCallback).toHaveBeenCalledExactlyOnceWith([3, 1]);

    await expect(Promise.all([firstResult, secondResult])).resolves.toEqual([
      30, 10,
    ]);

    expect(vi.getTimerCount()).toBe(0);
  });

  it('дедуплицирует по ключу, сохраняя первый аргумент и общий промис', async () => {
    const batchCallback = vi.fn((args: { id: number; value: string }[]) =>
      args.map((arg) => arg.value),
    );

    const batcher = new DeduplicatedBatcher(
      batchCallback,
      (arg) => arg.id,
      100,
    );

    const firstResult = batcher.call({ id: 1, value: 'первый' });
    const duplicateResult = batcher.call({ id: 1, value: 'второй' });

    expect(duplicateResult).toBe(firstResult);

    await vi.advanceTimersByTimeAsync(100);

    expect(batchCallback).toHaveBeenCalledExactlyOnceWith([
      { id: 1, value: 'первый' },
    ]);

    await expect(duplicateResult).resolves.toBe('первый');
  });

  it('создаёт новое окно и повторно обрабатывает тот же ключ в следующей пачке', async () => {
    const batchCallback = vi.fn((args: number[]) => args);

    const batcher = new DeduplicatedBatcher(batchCallback, (arg) => arg, 100);

    expect(vi.getTimerCount()).toBe(0);

    const firstResult = batcher.call(1);

    await vi.advanceTimersByTimeAsync(100);

    await expect(firstResult).resolves.toBe(1);

    await vi.advanceTimersByTimeAsync(500);

    expect(batchCallback).toHaveBeenCalledTimes(1);

    const nextResult = batcher.call(1);

    expect(nextResult).not.toBe(firstResult);

    await vi.advanceTimersByTimeAsync(100);

    await expect(nextResult).resolves.toBe(1);

    expect(batchCallback).toHaveBeenCalledTimes(2);
  });

  it('накапливает следующие пачки во время обработки и выполняет их последовательно', async () => {
    const firstBatch = Promise.withResolvers<number[]>();

    const batchCallback = vi.fn((args: number[]) =>
      args[0] === 1 ? firstBatch.promise : Promise.resolve(args),
    );

    const batcher = new DeduplicatedBatcher(batchCallback, (arg) => arg, 100);

    const firstResult = batcher.call(1);

    await vi.advanceTimersByTimeAsync(100);

    const secondResult = batcher.call(2);

    await vi.advanceTimersByTimeAsync(100);

    expect(batchCallback).toHaveBeenCalledTimes(1);

    firstBatch.resolve([10]);

    await expect(firstResult).resolves.toBe(10);

    await expect(secondResult).resolves.toBe(2);

    expect(batchCallback.mock.calls).toEqual([[[1]], [[2]]]);
  });

  it.each(['синхронная', 'асинхронная'])(
    'отклоняет всю пачку при ошибке (%s), не останавливая очередь',
    async (errorKind) => {
      const error = new Error('Ошибка обработки');

      const batchCallback = vi.fn(
        (args: number[]): number[] | Promise<number[]> => {
          if (args[0] === 1) {
            if (errorKind === 'синхронная') throw error;

            return Promise.reject(error);
          }

          return args;
        },
      );

      const batcher = new DeduplicatedBatcher(batchCallback, (arg) => arg, 100);

      const firstResult = batcher.call(1);
      const duplicateResult = batcher.call(1);
      const secondResult = batcher.call(2);

      const settledResults = Promise.allSettled([
        firstResult,
        duplicateResult,
        secondResult,
      ]);

      await vi.advanceTimersByTimeAsync(100);

      expect(await settledResults).toEqual([
        { status: 'rejected', reason: error },
        { status: 'rejected', reason: error },
        { status: 'rejected', reason: error },
      ]);

      const nextResult = batcher.call(3);

      await vi.advanceTimersByTimeAsync(100);

      await expect(nextResult).resolves.toBe(3);
    },
  );

  it.each([{ results: [] }, { results: [10] }, { results: [10, 20, 30] }])(
    'отклоняет всю пачку при несовпадении количества результатов: %j',
    async ({ results }) => {
      const batcher = new DeduplicatedBatcher(
        () => results,
        (arg: number) => arg,
        100,
      );

      const settledResults = Promise.allSettled([
        batcher.call(1),
        batcher.call(2),
      ]);

      await vi.advanceTimersByTimeAsync(100);

      for (const result of await settledResults) {
        expect(result.status).toBe('rejected');

        if (result.status === 'rejected') {
          expect(result.reason).toEqual(
            new Error(
              'Количество результатов не совпадает с количеством аргументов пачки',
            ),
          );
        }
      }
    },
  );

  it('отменяет окно, отклоняет его промисы и позволяет начать новое окно', async () => {
    const batchCallback = vi.fn((args: number[]) => args);

    const batcher = new DeduplicatedBatcher(batchCallback, (arg) => arg, 100);

    const settledResults = Promise.allSettled([
      batcher.call(1),
      batcher.call(1),
      batcher.call(2),
    ]);

    batcher.cancel();

    batcher.cancel();

    expect(vi.getTimerCount()).toBe(0);

    expect(await settledResults).toEqual(
      Array.from({ length: 3 }, () => ({
        status: 'rejected',
        reason: new Error('Накопление пачки отменено'),
      })),
    );

    await vi.advanceTimersByTimeAsync(100);

    expect(batchCallback).not.toHaveBeenCalled();

    const nextResult = batcher.call(1);

    await vi.advanceTimersByTimeAsync(100);

    await expect(nextResult).resolves.toBe(1);
  });

  it('при отмене окна сохраняет выполняющуюся и уже поставленную в очередь пачки', async () => {
    const firstBatch = Promise.withResolvers<number[]>();

    const batchCallback = vi.fn((args: number[]) =>
      args[0] === 1 ? firstBatch.promise : args,
    );

    const batcher = new DeduplicatedBatcher(batchCallback, (arg) => arg, 100);

    const firstResult = batcher.call(1);

    await vi.advanceTimersByTimeAsync(100);

    const queuedResult = batcher.call(2);

    await vi.advanceTimersByTimeAsync(100);

    const cancelledResult = Promise.allSettled([batcher.call(3)]);

    batcher.cancel();

    firstBatch.resolve([1]);

    await expect(firstResult).resolves.toBe(1);

    await expect(queuedResult).resolves.toBe(2);

    expect((await cancelledResult)[0].status).toBe('rejected');

    expect(batchCallback.mock.calls).toEqual([[[1]], [[2]]]);
  });

  it.each([-1, NaN, Infinity])(
    'отклоняет некорректную длительность окна: %s',
    (windowMs) => {
      expect(
        () =>
          new DeduplicatedBatcher(
            (args: number[]) => args,
            (arg) => arg,
            windowMs,
          ),
      ).toThrow(RangeError);
    },
  );

  it('поддерживает нулевое окно', async () => {
    const batcher = new DeduplicatedBatcher(
      (args: number[]) => args,
      (arg) => arg,
      0,
    );

    const result = batcher.call(1);

    await vi.advanceTimersByTimeAsync(0);

    await expect(result).resolves.toBe(1);
  });
});
