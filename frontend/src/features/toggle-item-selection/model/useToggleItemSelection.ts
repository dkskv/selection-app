import { useMutation, useMutationState } from '@tanstack/react-query';
import { selectItem } from '../api/selectItem';
import { deselectItem } from '../api/deselectItem';

export function useToggleItemSelection({
  selected,
  onSuccess,
  onError,
}: {
  selected: boolean;
  onSuccess: () => Promise<void>;
  onError: (error: Error) => void;
}) {
  const mutationKey = [selected ? 'deselect-item' : 'select-item'];

  const pendingItemIds = useMutationState<number>({
    filters: { mutationKey, status: 'pending' },
    select: (mutation) => mutation.state.variables as number,
  });

  const mutation = useMutation({
    mutationKey,
    mutationFn: selected ? deselectItem : selectItem,
    onSuccess,
    onError,
  });

  return { toggle: mutation.mutate, pendingItemIds };
}
