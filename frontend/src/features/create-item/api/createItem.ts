import { apiBaseUrl } from '@/shared/api/apiBaseUrl';

export async function createItem(id: number): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });

  if (!response.ok) {
    const body: { error: string } = await response.json();

    throw new Error(body.error);
  }
}
