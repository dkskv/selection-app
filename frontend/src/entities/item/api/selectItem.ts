export async function selectItem(itemId: number): Promise<void> {
  const response = await fetch('/api/selection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId }),
  });

  if (!response.ok) {
    throw new Error('Не удалось выбрать элемент');
  }
}
