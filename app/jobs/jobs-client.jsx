"use client";

import { useMemo, useState } from "react";

const SORTS = [
  { id: "recent", label: "Newest" },
  { id: "az", label: "A–Z" },
  { id: "fluff", label: "Fluff" }
];

const formatJobCount = (total) => {
  if (!Number.isFinite(total) || total <= 0) {
    return "0 jobs";
  }
  const step = total >= 100 ? 100 : 10;
  const rounded = Math.floor(total / step) * step;
  if (rounded <= 0) {
    return `${total}+ jobs`;
  }
  return `${rounded}+ jobs`;
};

const getJobLabel = (value) => {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    const parts = url.pathname.split("/").filter(Boolean);
    const tail = parts[parts.length - 1];
    return tail ? `${host}/${tail}` : host;
  } catch (error) {
    return value;
  }
};

export default function JobsClient({ items, total }) {
  const [sort, setSort] = useState("recent");

  const sorted = useMemo(() => {
    const list = Array.isArray(items) ? [...items] : [];
    if (sort === "az") {
      return list.sort((a, b) => getJobLabel(a.url).localeCompare(getJobLabel(b.url)));
    }
    if (sort === "fluff") {
      return list.sort((a, b) => {
        const aScore = Number.isFinite(a.fluff_rating) ? a.fluff_rating : -1;
        const bScore = Number.isFinite(b.fluff_rating) ? b.fluff_rating : -1;
        return bScore - aScore || getJobLabel(a.url).localeCompare(getJobLabel(b.url));
      });
    }
    return list;
  }, [items, sort]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-line/70 bg-card/80 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted">
            {formatJobCount(total)}
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
        {sorted.map((job) => (
          <a
            key={`${job.url}-${job.created_at}`}
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border border-line/70 bg-paper/70 px-3 py-1 hover:border-accent"
          >
            <span className="uppercase tracking-[0.2em] text-muted">
              {getJobLabel(job.url)}
            </span>
            <span className="text-ink">
              {job.fluff_rating ? `Fluff ${job.fluff_rating}/10` : "Fluff ?"}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
