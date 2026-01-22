"use client";

import { useMemo, useState } from "react";

const SORTS = [
  { id: "recent", label: "Newest" },
  { id: "az", label: "A–Z" },
  { id: "fluff", label: "Fluff" }
];

const formatCompanyCount = (total) => {
  if (!Number.isFinite(total) || total <= 0) {
    return "0 companies";
  }
  const step = total >= 100 ? 100 : 10;
  const rounded = Math.floor(total / step) * step;
  if (rounded <= 0) {
    return `${total}+ companies`;
  }
  return `${rounded}+ companies`;
};

export default function CompaniesClient({ items, total }) {
  const [sort, setSort] = useState("recent");

  const sorted = useMemo(() => {
    const list = Array.isArray(items) ? [...items] : [];
    if (sort === "az") {
      return list.sort((a, b) => (a.host || "").localeCompare(b.host || ""));
    }
    if (sort === "fluff") {
      return list.sort((a, b) => {
        const aScore = Number.isFinite(a.fluff_rating) ? a.fluff_rating : -1;
        const bScore = Number.isFinite(b.fluff_rating) ? b.fluff_rating : -1;
        return bScore - aScore || (a.host || "").localeCompare(b.host || "");
      });
    }
    return list;
  }, [items, sort]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-line/70 bg-card/80 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted">
            {formatCompanyCount(total)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted">
          {SORTS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSort(option.id)}
              className={`rounded-full border border-line/70 px-4 py-2 transition ${
                sort === option.id ? "bg-ink text-paper" : "bg-card/80 hover:border-accent"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted">
        {sorted.map((company) => (
          <a
            key={`${company.url}-${company.created_at}`}
            href={company.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border border-line/70 bg-paper/70 px-3 py-1 hover:border-accent"
          >
            <span className="uppercase tracking-[0.2em] text-muted">
              {company.host || company.url}
            </span>
            <span className="text-ink">
              {company.fluff_rating ? `Fluff ${company.fluff_rating}/10` : "Fluff ?"}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
