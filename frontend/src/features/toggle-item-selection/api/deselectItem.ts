export async function deselectItem(itemId: number): Promise<void> {
  const response = await fetch(`/api/selection/${itemId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const body: { error: string } = await response.json();

    throw new Error(body.error);
  }
}
