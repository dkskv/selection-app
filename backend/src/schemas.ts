import { z } from 'zod';

const idSchema = z.number().int();

const integerParamSchema = z
  .string()
  .regex(/^-?\d+$/)
  .transform(Number)
  .pipe(idSchema);

export const paginationSchema = z.object({
  limit: integerParamSchema.pipe(z.number().nonnegative()).default(20),
  offset: integerParamSchema.pipe(z.number().nonnegative()).default(0),
});

export const itemsQuerySchema = paginationSchema.extend({
  idPrefixFilter: z.string().regex(/^\d*$/).default(''),
});

export const createItemSchema = z.object({ id: idSchema });

export const selectItemSchema = z.object({ itemId: idSchema });

export const itemParamsSchema = z.object({ itemId: integerParamSchema });

export const reorderSchema = z.object({ afterId: idSchema.nullable() });
