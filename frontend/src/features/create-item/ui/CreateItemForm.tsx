import { useState } from 'react';
import { Button, Flex, InputNumber, message, Spin } from 'antd';
import { useMutation, useMutationState } from '@tanstack/react-query';
import { createItem } from '../api/createItem';
import controls from './CreateItemForm.module.css';

export function CreateItemForm({ onSuccess }: { onSuccess: () => void }) {
  const [newItemId, setNewItemId] = useState<number | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const pendingCreateCount = useMutationState({
    filters: { mutationKey: ['create-item'], status: 'pending' },
    select: () => true,
  }).length;

  const createMutation = useMutation({
    mutationKey: ['create-item'],
    mutationFn: createItem,
    onError: (error) => messageApi.error(error.message),
    onSuccess,
  });

  const addItem = () => {
    if (newItemId === null) return;

    createMutation.mutate(newItemId, {
      onSuccess: () => setNewItemId(null),
    });
  };

  return (
    <>
      {contextHolder}
      <Flex align="center" gap={8} className={controls.control}>
        <InputNumber
          aria-label="Item ID"
          className={controls.addInput}
          placeholder="Enter ID"
          value={newItemId}
          onChange={setNewItemId}
          onPressEnter={addItem}
        />
        {pendingCreateCount > 0 && (
          <span role="status" aria-label="Adding items">
            <Spin size="small" />
          </span>
        )}
        <Button
          className={controls.addButton}
          disabled={newItemId === null}
          onClick={addItem}
        >
          Add
        </Button>
      </Flex>
    </>
  );
}
