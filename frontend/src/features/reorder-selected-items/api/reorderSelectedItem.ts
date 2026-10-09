import { apiBaseUrl } from '@/shared/api/apiBaseUrl';

export async function reorderSelectedItem(
  itemId: number,
  afterId: number | null,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/selection/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ afterId }),
  });

  if (!response.ok) {
    const body: { error: string } = await response.json();

    throw new Error(body.error);
  }
}
