import { z } from 'zod';

const integerSchema = z.number().int();

const integerUrlParamSchema = z
  .string()
  .regex(/^-?\d+$/)
  .transform(Number)
  .pipe(integerSchema);

const idUrlParamSchema = integerUrlParamSchema;

const paginationQueryParamSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(integerSchema);

export const paginationQuerySchema = z.object({
  limit: paginationQueryParamSchema.pipe(z.number().max(100)).default(20),
  offset: paginationQueryParamSchema.default(0),
});

export const itemsQuerySchema = paginationQuerySchema.extend({
  idPrefixFilter: z.string().default(''),
});

export const createItemBodySchema = z.object({ id: integerSchema });

export const selectItemBodySchema = z.object({ itemId: integerSchema });

export const itemUrlParamsSchema = z.object({ itemId: idUrlParamSchema });

export const reorderBodySchema = z.object({
  afterId: integerSchema.nullable(),
});
