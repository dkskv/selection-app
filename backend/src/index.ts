import express from 'express';
import { readFileSync } from 'node:fs';
import { createSecureServer } from 'node:http2';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { corsMiddleware } from './corsMiddleware.js';
import { initializeApi } from './initializeApi.js';

const require = createRequire(import.meta.url);

const http2Express = require('http2-express') as (
  expressFactory: typeof express,
) => ReturnType<typeof express>;

const app = http2Express(express);
const port = Number(process.env.PORT ?? 3000);
const backendDir = fileURLToPath(new URL('../', import.meta.url));

const frontendDist = fileURLToPath(
  new URL('../../frontend/dist/', import.meta.url),
);

app.use(corsMiddleware);

await initializeApi(app);

app.use(express.static(frontendDist));

const tlsOptions = {
  cert: readFileSync(path.resolve(backendDir, config.TLS_CERT_PATH)),
  key: readFileSync(path.resolve(backendDir, config.TLS_KEY_PATH)),
  allowHTTP1: true,
};

createSecureServer(
  tlsOptions,
  app as unknown as (
    req: import('node:http2').Http2ServerRequest,
    res: import('node:http2').Http2ServerResponse,
  ) => void,
).listen(port, () => {
  console.log(`Server listening on https://localhost:${port}`);
});
