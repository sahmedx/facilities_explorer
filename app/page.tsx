import { Wordmark } from "@/components/wordmark";
import { ProseStrap } from "@/components/prose-strap";
import { Explorer } from "@/components/explorer";
import { Footer } from "@/components/footer";
import { leversFromSearchParams } from "@/lib/levers";
import styles from "./page.module.css";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const initialLevers = leversFromSearchParams(params);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Wordmark />
      </header>

      <section className={`${styles.strap} stagger stagger-1`}>
        <ProseStrap />
      </section>

      <aside className={styles.mobileNotice} aria-label="Viewport notice">
        <h2 className={styles.mobileNoticeTitle}>Best viewed on desktop</h2>
        <p className={styles.mobileNoticeBody}>
          This dashboard puts six draggable levers next to four KPI cards, a
          driver waterfall, a reasonability table, and a three-statement walk.
          That comparison surface needs at least a 1024px viewport to fit
          without compromise. Open this URL on a laptop or larger to use the
          explorer.
        </p>
      </aside>

      <Explorer initialLevers={initialLevers} />

      <footer className={styles.footer}>
        <Footer />
      </footer>
    </main>
  );
}
