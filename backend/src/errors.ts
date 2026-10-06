import { ZodError } from 'zod';

/** Ошибка бизнес-правила, безопасная для отображения клиенту. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'DomainError';
  }
}

/** Ошибка проверки входных данных запроса. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'ValidationError';
  }

  static fromZod(error: ZodError): ValidationError {
    return new ValidationError(
      error.issues.map(({ message }) => message).join('; '),
    );
  }
}
