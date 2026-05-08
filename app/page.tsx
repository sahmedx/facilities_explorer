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

      <Explorer initialLevers={initialLevers} />

      <footer className={styles.footer}>
        <Footer />
      </footer>
    </main>
  );
}
