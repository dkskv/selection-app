import { describe, expect, it } from 'vitest';
import { PromiseBatch } from './promiseBatch';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;

    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('PromiseBatch', () => {
  it('ожидает промисы, добавленные во время ожидания', async () => {
    const first = deferred<number>();
    const second = deferred<number>();
    const batch = new PromiseBatch<number>();

    batch.add(first.promise);

    const result = batch.collect();

    batch.add(second.promise);

    first.resolve(1);

    await Promise.resolve();

    second.resolve(2);

    await expect(result).resolves.toEqual([1, 2]);
  });

  it('сохраняет порядок добавления результатов при разном порядке завершения', async () => {
    const first = deferred<number>();
    const second = deferred<number>();
    const batch = new PromiseBatch<number>();

    batch.add(first.promise);

    batch.add(second.promise);

    const result = batch.collect();

    second.resolve(2);

    first.resolve(1);

    await expect(result).resolves.toEqual([1, 2]);
  });

  it('отклоняет batch и запрещает новые задачи после ошибки', async () => {
    const error = new Error('request failed');
    const batch = new PromiseBatch<number>();
    const rejected = Promise.reject<number>(error);

    batch.add(rejected);

    await expect(batch.collect()).rejects.toBe(error);

    expect(() => batch.add(Promise.resolve(2))).toThrow(
      'Cannot add a promise to a closed batch.',
    );
  });

  it('сразу отклоняет batch, если позже добавленный промис падает', async () => {
    const first = deferred<number>();
    const error = new Error('later request failed');
    const batch = new PromiseBatch<number>();

    batch.add(first.promise);

    const result = batch.collect();

    batch.add(Promise.reject(error));

    await expect(result).rejects.toBe(error);

    first.resolve(1);
  });

  it('закрывает пустой batch после collect', async () => {
    const batch = new PromiseBatch<number>();

    await expect(batch.collect()).resolves.toEqual([]);

    expect(() => batch.add(Promise.resolve(1))).toThrow(
      'Cannot add a promise to a closed batch.',
    );
  });
});
