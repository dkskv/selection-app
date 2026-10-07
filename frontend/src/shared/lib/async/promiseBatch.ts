/**
 * Объединяет промисы в batch, принимающий новые задачи, пока выполняется `collect`.
 * Успешно завершённый batch возвращает результаты в порядке добавления; ошибка
 * сразу отклоняет ожидание. После завершения или ошибки batch закрывается.
 */
export class PromiseBatch<T> {
  /** Добавленные задачи в порядке их регистрации. */
  private readonly promises: Promise<T>[] = [];
  /** Общий промис сбора результатов всех задач batch. */
  private resultPromise: Promise<T[]> | undefined;
  /** Показывает, что batch завершён или отклонён. */
  private isClosed = false;

  /** Отклоняется при ошибке любой добавленной задачи. */
  private readonly failurePromise: Promise<never>;
  /** Отклоняет `failurePromise` с ошибкой первой завершившейся задачи. */
  private rejectFailure!: (reason: unknown) => void;

  constructor() {
    this.failurePromise = new Promise((_, reject) => {
      this.rejectFailure = reject;
    });

    this.failurePromise.catch(() => undefined);
  }

  /** Добавляет задачу до завершения ожидания batch. */
  add(promise: Promise<T>) {
    if (this.isClosed) {
      throw new Error('Cannot add a promise to a closed batch.');
    }

    promise.catch((error) => this.fail(error));

    this.promises.push(promise);

    return this;
  }

  /** Собирает результаты всех задач, включая добавленные во время сбора. */
  collect(): Promise<T[]> {
    if (!this.resultPromise) {
      this.resultPromise = this.collectResults();
    }

    return this.resultPromise;
  }

  private async collectResults(): Promise<T[]> {
    const results: T[] = [];
    let collectedCount = 0;

    try {
      while (collectedCount < this.promises.length) {
        const batchEnd = this.promises.length;
        const nextPromises = this.promises.slice(collectedCount, batchEnd);

        collectedCount = batchEnd;

        results.push(
          ...(await Promise.race([
            Promise.all(nextPromises),
            this.failurePromise,
          ])),
        );
      }

      this.isClosed = true;

      return results;
    } catch (error) {
      this.isClosed = true;

      throw error;
    }
  }

  private fail(error: unknown): void {
    if (this.isClosed) return;

    this.isClosed = true;

    this.rejectFailure(error);
  }
}
