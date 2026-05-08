import styles from "./prose-strap.module.css";

export function ProseStrap() {
  return (
    <div className={styles.wrap}>
      <p className={styles.lede}>FY27 Facilities Plan</p>
      <p className={`${styles.body} balance`}>
        Baseline assumes no incremental office space. BAU growth adds square
        footage based on headcount growth, implying a $13M leasehold buildout.
        Use the levers below, or click a preset, to compare densification, base
        case, and premium expansion paths. Numbers reconcile to the underlying
        Excel model at default settings.
      </p>
    </div>
  );
}
