import { theme } from 'antd';
import styles from './DropIndicator.module.css';

export function DropIndicator({
  top,
  left,
  right,
}: {
  top: number;
  left: number;
  right: number;
}) {
  const { token } = theme.useToken();

  return (
    <div
      className={styles.indicator}
      style={{ top, left, right, background: token.colorPrimary }}
    />
  );
}
