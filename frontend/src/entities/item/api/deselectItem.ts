export async function deselectItem(itemId: number): Promise<void> {
  const response = await fetch(`/api/selection/${itemId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to remove item from selection.');
  }
}
