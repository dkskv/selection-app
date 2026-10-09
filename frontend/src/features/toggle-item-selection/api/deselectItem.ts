import { apiBaseUrl } from '@/shared/api/apiBaseUrl';

export async function deselectItem(itemId: number): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/selection/${itemId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const body: { error: string } = await response.json();

    throw new Error(body.error);
  }
}
