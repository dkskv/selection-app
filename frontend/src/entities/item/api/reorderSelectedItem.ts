export async function reorderSelectedItem(
  itemId: number,
  afterId: number | null,
): Promise<void> {
  const response = await fetch(`/api/selection/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ afterId }),
  });

  if (!response.ok) {
    throw new Error('Failed to reorder selected item.');
  }
}
