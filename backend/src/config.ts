import { z } from 'zod';

const envSchema = z.object({
  INITIAL_ITEMS_COUNT: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().nonnegative().max(10_000_000)),
  TLS_CERT_PATH: z.string().trim().min(1, 'TLS_CERT_PATH is required'),
  TLS_KEY_PATH: z.string().trim().min(1, 'TLS_KEY_PATH is required'),
  CORS_ORIGIN: z.url().trim().optional(),
});

export const config = envSchema.parse(process.env);
