import { apiBaseUrl } from '@/shared/api/apiBaseUrl';

export async function selectItem(itemId: number): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/selection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId }),
  });

  if (!response.ok) {
    const body: { error: string } = await response.json();

    throw new Error(body.error);
  }
}
