import styles from './ProgressLoader.module.css';

export function ProgressLoader() {
  return (
    <div className={styles.loader} aria-hidden="true">
      <div className={styles.indicator} />
    </div>
  );
}
