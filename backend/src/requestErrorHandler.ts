import { ZodError } from 'zod';
import { DomainError, ValidationError } from './errors.js';

export type RequestErrorResult = { status: number; body: { error: string } };

/** Преобразует ошибку обработчика запроса в безопасный HTTP-ответ. */
export const handleRequestError = (error: unknown): RequestErrorResult => {
  if (error instanceof DomainError) {
    return { status: 409, body: { error: `DomainError: ${error.message}` } };
  }

  if (error instanceof ZodError) {
    const validationError = ValidationError.fromZod(error);

    return {
      status: 400,
      body: { error: `ValidationError: ${validationError.message}` },
    };
  }

  return { status: 500, body: { error: 'Internal Server Error' } };
};
