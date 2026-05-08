import styles from "./wordmark.module.css";

export function Wordmark() {
  return (
    <div className={styles.row}>
      <h1 className={styles.mark}>
        TechCo <span className={styles.dot}>·</span> Facilities
      </h1>
      <span className="code-badge code-badge--team">FY27 · INTERACTIVE</span>
    </div>
  );
}
