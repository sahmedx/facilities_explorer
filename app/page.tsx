import { Wordmark } from "@/components/wordmark";
import { ProseStrap } from "@/components/prose-strap";
import { Explorer } from "@/components/explorer";
import { Footer } from "@/components/footer";
import { presets } from "@/lib/base-case";
import { leversFromSearchParams } from "@/lib/levers";
import styles from "./page.module.css";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  // Fresh page load (no shared-link params) starts on Expand to plan.
  // URLs with explicit lever params still hydrate to whatever they encode.
  const hasParams = Object.keys(params).length > 0;
  const initialLevers = hasParams
    ? leversFromSearchParams(params)
    : { ...presets.expandToPlan };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Wordmark />
      </header>

      <section className={`${styles.strap} stagger stagger-1`}>
        <ProseStrap />
      </section>

      <Explorer initialLevers={initialLevers} />

      <footer className={styles.footer}>
        <Footer />
      </footer>
    </main>
  );
}
