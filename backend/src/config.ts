import { z } from 'zod';

const envSchema = z.object({
  INITIAL_ITEMS_COUNT: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().nonnegative().max(10_000_000)),
});

export const config = envSchema.parse(process.env);
