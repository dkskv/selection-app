import type { Request, Response } from 'express';
import { DeduplicatedBatcher } from './utils/DeduplicatedBatcher.js';
import { stableStringify } from './utils/stableStringify.js';
import { handleRequestError } from './requestErrorHandler.js';

type BatchedResult = { status?: number; body?: unknown };

type BatchedOperation = { key: string; run: () => Promise<BatchedResult> };

/** Создаёт батчер запросов с указанным окном дедупликации. */
export const createRequestBatcher = (windowMs: number) =>
  new DeduplicatedBatcher<BatchedOperation, BatchedResult, string>(
    (operations) =>
      Promise.all(
        operations.map(async ({ run }): Promise<BatchedResult> => {
          try {
            return await run();
          } catch (error) {
            return handleRequestError(error);
          }
        }),
      ),
    ({ key }) => key,
    windowMs,
  );

/** Выполняет обработчик в общем батчере и отправляет его результат клиенту. */
export const runBatchedRequest = async (
  req: Request,
  res: Response,
  run: () => Promise<BatchedResult>,
  batcher: DeduplicatedBatcher<BatchedOperation, BatchedResult, string>,
): Promise<void> => {
  const key = `${req.method}:${req.originalUrl}:${stableStringify(req.body)}`;
  const result = await batcher.call({ key, run });

  if (result.status === 204) {
    res.status(204).end();

    return;
  }

  res.status(result.status ?? 200).json(result.body);
};
