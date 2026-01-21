import Link from "next/link";
import { notFound } from "next/navigation";
import { getShareResult } from "../../../lib/cache.js";

export const dynamic = "force-dynamic";

const CARD_DEFS = [
  { key: "product", icon: "📦", title: "What they sell" },
  { key: "buyer", icon: "👤", title: "Who buys it" },
  { key: "claim", icon: "💰", title: "The 'Why'" }
];
const BULLET_PREFIX = /^[-*•]\s*/;

const toBullets = (text) => {
  if (!text) {
    return [];
  }

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(BULLET_PREFIX, ""));
};

export default async function SharePage({ params }) {
  const result = await getShareResult(params.id);
  if (!result) {
    notFound();
  }

  const analysis = result.analysis || {};
  const sources = Array.isArray(result.sources) ? result.sources : [];

  return (
    <div className="relative min-h-screen overflow-hidden px-6 pb-24 pt-10">
      <div className="pointer-events-none absolute inset-0 -z-10 grid-overlay opacity-70" />
      <div className="absolute -left-10 top-32 -z-10 h-64 w-64 rounded-full bg-accent/30 blur-3xl" />
      <div className="absolute right-0 top-10 -z-10 h-72 w-72 rounded-full bg-accent-2/30 blur-[120px]" />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="animate-fade-in">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-line/70 bg-card/70 px-4 py-1 text-xs uppercase tracking-[0.3em] text-muted">
            Shared result
          </span>
          <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl lg:text-6xl">
            In English, Please
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted sm:text-xl">
            A shared snapshot of the company story, stripped of fluff.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted">
            <Link
              href="/"
              className="rounded-full border border-line/70 bg-card/80 px-4 py-2 hover:border-accent"
            >
              Back to analyzer
            </Link>
            {result.url ? (
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-line/70 bg-card/80 px-4 py-2 hover:border-accent"
              >
                Original site
              </a>
            ) : null}
          </div>
        </header>

        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-ink">The simple truth</h2>
            <span className="rounded-full border border-line/70 bg-card/80 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted">
              Fluff rating: {analysis.fluff_rating || "?"}/10
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {CARD_DEFS.map((card, index) => (
              <article
                key={card.key}
                className="animate-rise rounded-3xl border border-line/70 bg-card/90 p-5 shadow-crisp"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="mb-3 flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-muted">
                  <span className="text-lg">{card.icon}</span>
                  {card.title}
                </div>
                {analysis[card.key] ? (
                  <ul className="list-disc space-y-2 pl-5 text-base text-ink">
                    {toBullets(analysis[card.key]).map((line, lineIndex) => (
                      <li key={`${card.key}-${lineIndex}`}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-base text-ink">No clear answer yet.</p>
                )}
              </article>
            ))}
          </div>

          {sources.length ? (
            <div className="flex flex-wrap gap-3 text-xs text-muted">
              <span className="uppercase tracking-[0.2em]">Sources</span>
              {sources.map((source) => (
                <a
                  key={source}
                  href={source}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-line/70 bg-paper/70 px-3 py-1 hover:border-accent"
                >
                  {source}
                </a>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
