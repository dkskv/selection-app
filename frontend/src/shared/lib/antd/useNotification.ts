import { notification } from 'antd';

export function useNotification() {
  return notification.useNotification({ placement: 'bottom' });
}
