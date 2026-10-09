import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv, type UserConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const backendDir = path.resolve(import.meta.dirname, '../backend');
  let server: UserConfig['server'];

  if (command === 'serve') {
    const env = loadEnv(mode, backendDir, '');

    const tlsCertPath = process.env.TLS_CERT_PATH ?? env.TLS_CERT_PATH;
    const tlsKeyPath = process.env.TLS_KEY_PATH ?? env.TLS_KEY_PATH;

    if (!tlsCertPath || !tlsKeyPath) {
      throw new Error(
        'TLS_CERT_PATH and TLS_KEY_PATH must be configured for the Vite dev server.',
      );
    }

    server = {
      strictPort: true,
      https: {
        cert: readFileSync(path.resolve(backendDir, tlsCertPath)),
        key: readFileSync(path.resolve(backendDir, tlsKeyPath)),
      },
    };
  }

  return {
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
      },
    },
    plugins: [react()],
    server,
  };
});
