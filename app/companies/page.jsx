import Link from "next/link";
import CompaniesClient from "./companies-client.jsx";
import { getCompanyIndex } from "../../lib/cache.js";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const index = await getCompanyIndex();
  const items = index?.items || [];
  const total = index?.total || 0;

  return (
    <div className="relative min-h-screen overflow-hidden px-6 pb-24 pt-10">
      <div className="pointer-events-none absolute inset-0 -z-10 grid-overlay opacity-70" />
      <div className="absolute -left-10 top-32 -z-10 h-64 w-64 rounded-full bg-accent/30 blur-3xl" />
      <div className="absolute right-0 top-10 -z-10 h-72 w-72 rounded-full bg-accent-2/30 blur-[120px]" />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="animate-fade-in">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-line/70 bg-card/70 px-4 py-1 text-xs uppercase tracking-[0.3em] text-muted">
            All companies
          </span>
          <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl lg:text-6xl">
            In English, Please
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted sm:text-xl">
            A running list of companies analyzed in the past few days.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted">
            <Link
              href="/"
              className="rounded-full border border-line/70 bg-card/80 px-4 py-2 hover:border-accent"
            >
              Back to In English, Please
            </Link>
          </div>
        </header>

        <CompaniesClient items={items} total={total} />
      </div>
    </div>
  );
}
