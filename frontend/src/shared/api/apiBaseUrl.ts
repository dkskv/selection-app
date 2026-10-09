// В dev обращаемся к backend напрямую по HTTP/2, потому что Vite proxy понижает соединение до HTTP/1.1.
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
