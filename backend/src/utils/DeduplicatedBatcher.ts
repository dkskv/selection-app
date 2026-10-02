/** Состояние ожидающего вызова для конкретного ключа дедупликации. */
type PendingCall<Arg, Result> = {
  /** Аргумент вызова (при дубликатах по ключу используется первый аргумент). */
  arg: Arg;
  /** Промис результата, возвращаемый также при повторных вызовах с этим ключом. */
  promise: Promise<Result>;
  /** Возвращает результат ожидающим вызовам. */
  resolve: (result: Result) => void;
  /** Отклоняет ожидающие вызовы. */
  reject: (reason: unknown) => void;
};

/** Обработчик пачки с результатами в порядке входных аргументов. */
type BatchCallback<Arg, Result> = (args: Arg[]) => Result[] | Promise<Result[]>;

/** Отклоняет все вызовы пачки с одной причиной. */
const rejectBatch = <Arg, Result, Key>(
  batchCalls: ReadonlyMap<Key, PendingCall<Arg, Result>>,
  reason: unknown,
): void => {
  for (const batchCall of batchCalls.values()) {
    batchCall.reject(reason);
  }
};

/** Обрабатывает одну пачку и распределяет результаты по порядку вызовов. */
const processBatch = async <Arg, Result, Key>(
  batchCalls: ReadonlyMap<Key, PendingCall<Arg, Result>>,
  batchCallback: BatchCallback<Arg, Result>,
): Promise<void> => {
  /** Ожидающие вызовы в порядке добавления в пачку. */
  const pendingCalls = Array.from(batchCalls.values());
  /** Аргументы уникальных вызовов в том же порядке. */
  const args = pendingCalls.map((batchCall) => batchCall.arg);
  /** Результаты в порядке уникальных вызовов. */
  const batchResults = await batchCallback(args);

  // Проверяем всю пачку до выдачи результатов, чтобы ошибка не дала частичный успех.
  if (batchResults.length !== pendingCalls.length) {
    throw new Error(
      'Количество результатов не совпадает с количеством аргументов пачки',
    );
  }

  pendingCalls.forEach((batchCall, resultIndex) => {
    batchCall.resolve(batchResults[resultIndex]);
  });
};

/** Собирает вызовы в пачки с дедупликацией и обрабатывает пачки последовательно. */
export class DeduplicatedBatcher<Arg, Result, Key> {
  /** Обработчик уникальных аргументов. */
  private readonly batchCallback: BatchCallback<Arg, Result>;
  /** Функция ключа дедупликации внутри окна. */
  private readonly getDeduplicateKey: (arg: Arg) => Key;
  /** Длительность окна накопления в миллисекундах. */
  private readonly windowMs: number;
  /** Вызовы, накопленные в текущем окне. */
  private bufferedCallsByKey = new Map<Key, PendingCall<Arg, Result>>();
  /** Таймер завершения текущего окна. */
  private windowTimer: ReturnType<typeof setTimeout> | null = null;
  /** Очередь последовательной обработки пачек на цепочке промисов. */
  private processingQueue = Promise.resolve();

  /**
   * @param batchCallback Обработчик уникальных аргументов; результаты идут в том же порядке.
   * @param getDeduplicateKey Ключ дедупликации внутри окна; при совпадении используется первый аргумент.
   * @param windowMs Длительность окна накопления в миллисекундах от первого вызова.
   */
  constructor(
    batchCallback: BatchCallback<Arg, Result>,
    getDeduplicateKey: (arg: Arg) => Key,
    windowMs: number,
  ) {
    if (!Number.isFinite(windowMs) || windowMs < 0) {
      throw new RangeError(
        'Длительность окна должна быть конечным неотрицательным числом',
      );
    }

    this.batchCallback = batchCallback;

    this.getDeduplicateKey = getDeduplicateKey;

    this.windowMs = windowMs;
  }

  /** Добавляет вызов в текущее окно и возвращает промис результата, общий для дубликатов. */
  call(arg: Arg): Promise<Result> {
    /** Ключ для объединения одинаковых вызовов. */
    const deduplicateKey = this.getDeduplicateKey(arg);
    /** Ранее добавленный вызов с тем же ключом. */
    const existingCall = this.bufferedCallsByKey.get(deduplicateKey);

    if (existingCall) {
      return existingCall.promise;
    }

    /** Промис результата и функции его завершения. */
    const resultPromiseWithResolvers = Promise.withResolvers<Result>();

    this.bufferedCallsByKey.set(deduplicateKey, {
      arg,
      ...resultPromiseWithResolvers,
    });

    if (this.windowTimer === null) {
      this.windowTimer = setTimeout(
        () => this.enqueueBufferedBatch(),
        this.windowMs,
      );
    }

    return resultPromiseWithResolvers.promise;
  }

  /** Отменяет текущее окно и отклоняет его промисы; очередь продолжает работать. */
  cancel(): void {
    if (this.windowTimer !== null) {
      clearTimeout(this.windowTimer);

      this.windowTimer = null;
    }

    rejectBatch(
      this.bufferedCallsByKey,
      new Error('Накопление пачки отменено'),
    );

    this.bufferedCallsByKey.clear();
  }

  /** Закрывает текущее окно и ставит накопленную пачку в очередь. */
  private enqueueBufferedBatch(): void {
    /** Готовая пачка, отделённая от нового окна. */
    const readyBatchCalls = this.bufferedCallsByKey;

    this.bufferedCallsByKey = new Map();

    this.windowTimer = null;

    this.processingQueue = this.processingQueue
      .then(() => processBatch(readyBatchCalls, this.batchCallback))
      .catch((error: unknown) => rejectBatch(readyBatchCalls, error));
  }
}
