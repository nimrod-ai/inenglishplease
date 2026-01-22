"use client";

import { useEffect, useState } from "react";

const CARD_DEFS = [
  { key: "product", icon: "📦", title: "What they sell" },
  { key: "buyer", icon: "👤", title: "Who buys it" },
  { key: "claim", icon: "💰", title: "The 'Why'" }
];
const JOB_CARD_DEFS = [
  { key: "company_team", icon: "🏢", title: "What the company/team does" },
  { key: "you_will_do", icon: "🧭", title: "What you will do" },
  { key: "requirements", icon: "✅", title: "Requirements" }
];
const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL || "";
const BULLET_PREFIX = /^[-*•]\s*/;
const getFaviconUrl = (domain) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
const getCompanyHost = (value) => {
  if (!value) {
    return "";
  }

  try {
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch (error) {
    return value;
  }
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
const formatCount = (total, label) => {
  if (!Number.isFinite(total) || total <= 0) {
    return `0 ${label}`;
  }
  const step = total >= 100 ? 100 : 10;
  const rounded = Math.floor(total / step) * step;
  if (rounded <= 0) {
    return `${total}+ ${label}`;
  }
  return `${rounded}+ ${label}`;
};

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
export default function Home() {
  const [mode, setMode] = useState("company");
  const [url, setUrl] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [context, setContext] = useState("");
  const [sources, setSources] = useState([]);
  const [companyUrl, setCompanyUrl] = useState("");
  const [showFluffHelp, setShowFluffHelp] = useState(false);
  const [showJobFluffHelp, setShowJobFluffHelp] = useState(false);
  const [jobUrl, setJobUrl] = useState("");
  const [jobText, setJobText] = useState("");
  const [jobAnalysis, setJobAnalysis] = useState(null);
  const [jobContext, setJobContext] = useState("");
  const [shareId, setShareId] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jobError, setJobError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [jobChatInput, setJobChatInput] = useState("");
  const [jobChatMessages, setJobChatMessages] = useState([]);
  const [jobChatLoading, setJobChatLoading] = useState(false);
  const [jobLoading, setJobLoading] = useState(false);
  const [recentCompanies, setRecentCompanies] = useState([]);
  const [recentTotal, setRecentTotal] = useState(0);
  const [recentJobs, setRecentJobs] = useState([]);
  const [recentJobsTotal, setRecentJobsTotal] = useState(0);

  const loadRecent = async () => {
    try {
      const response = await fetch("/api/recent", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setRecentCompanies(Array.isArray(data.items) ? data.items : []);
      setRecentTotal(typeof data.total === "number" ? data.total : 0);
    } catch (error) {
      // Ignore fetch errors to avoid blocking the UI.
    }
  };

  const loadRecentJobs = async () => {
    try {
      const response = await fetch("/api/jobs", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setRecentJobs(Array.isArray(data.items) ? data.items : []);
      setRecentJobsTotal(typeof data.total === "number" ? data.total : 0);
    } catch (error) {
      // Ignore fetch errors to avoid blocking the UI.
    }
  };

  useEffect(() => {
    loadRecent();
  }, []);

  useEffect(() => {
    if (mode === "job") {
      loadRecentJobs();
    }
  }, [mode]);

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setError("");
    setJobError("");
    setLoading(false);
    setJobLoading(false);
    setAnalysis(null);
    setJobAnalysis(null);
    setChatMessages([]);
    setChatInput("");
    setJobChatMessages([]);
    setJobChatInput("");
    setShowFluffHelp(false);
    setShowJobFluffHelp(false);
    setShareId("");
    setShareStatus("");
    setShareNote("");
    setJobUrl("");
    setJobText("");
    setJobContext("");
  };

  const handleAnalyze = async (event) => {
    event.preventDefault();
    if (!url.trim()) {
      setError("Paste a company URL first.");
      return;
    }

    setLoading(true);
    setError("");
    setAnalysis(null);
    setChatMessages([]);
    setShowFluffHelp(false);
    setShareId("");
    setShareStatus("");
    setShareNote("");

    try {
      const submittedUrl = url.trim();
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: submittedUrl })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze the site.");
      }

      setAnalysis(data.analysis);
      setContext(data.context || "");
      setSources(data.sources || []);
      setShareId(data.shareId || "");
      setShareNote(data.shareReason || "");
      setCompanyUrl(submittedUrl);
      loadRecent();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJobAnalyze = async (event) => {
    event.preventDefault();
    const trimmedText = jobText.trim();
    const trimmedUrl = jobUrl.trim();
    if (!trimmedText && !trimmedUrl) {
      setJobError("Paste a job link or description first.");
      return;
    }

    setJobLoading(true);
    setJobError("");
    setJobAnalysis(null);
    setJobChatMessages([]);
    setJobChatInput("");
    setShowJobFluffHelp(false);

    try {
      const response = await fetch("/api/job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl, text: trimmedText })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze the job.");
      }

      setJobAnalysis(data.analysis);
      setJobContext(data.context || "");
      loadRecentJobs();
    } catch (err) {
      setJobError(err.message);
    } finally {
      setJobLoading(false);
    }
  };

  const handleJobChat = async (event) => {
    event.preventDefault();
    if (!jobChatInput.trim() || jobChatLoading) {
      return;
    }

    const question = jobChatInput.trim();
    setJobChatInput("");
    setJobChatMessages((prev) => [...prev, { role: "user", text: question }]);
    setJobChatLoading(true);

    try {
      const response = await fetch("/api/job-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context: jobContext, analysis: jobAnalysis })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to answer.");
      }

      setJobChatMessages((prev) => [...prev, { role: "assistant", text: data.answer }]);
    } catch (err) {
      setJobChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: "I couldn't answer that yet. Try again." }
      ]);
      setJobError(err.message);
    } finally {
      setJobChatLoading(false);
    }
  };

  const handleShareCopy = async () => {
    if (!shareId) {
      return;
    }

    const shareUrl = `${window.location.origin}/share/${shareId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus("Copied");
    } catch (err) {
      setShareStatus("Copy failed");
    }
  };

  const getShareUrl = () => {
    if (!shareId) {
      return "";
    }
    return `${window.location.origin}/share/${shareId}`;
  };

  const shareUrl = typeof window !== "undefined" ? getShareUrl() : "";
  const shareCompanyHost = getCompanyHost(companyUrl || sources[0] || "");
  const shareMessage = shareCompanyHost
    ? `I used 'In English, Please' to understand what the company at ${shareCompanyHost} actually does. Check it out:`
    : "I used 'In English, Please' to understand what a company actually does. Check it out:";

  const handleChat = async (event) => {
    event.preventDefault();
    if (!chatInput.trim() || chatLoading) {
      return;
    }

    const question = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text: question }]);
    setChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context, analysis })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to answer.");
      }

      setChatMessages((prev) => [...prev, { role: "assistant", text: data.answer }]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: "I couldn't answer that yet. Try again." }
      ]);
      setError(err.message);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-6 pb-24 pt-10">
      <div className="pointer-events-none absolute inset-0 -z-10 grid-overlay opacity-70" />
      <div className="absolute -left-10 top-32 -z-10 h-64 w-64 rounded-full bg-accent/30 blur-3xl" />
      <div className="absolute right-0 top-10 -z-10 h-72 w-72 rounded-full bg-accent-2/30 blur-[120px]" />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="animate-fade-in">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-line/70 bg-card/70 px-4 py-1 text-xs uppercase tracking-[0.3em] text-muted">
            Kid-level clarity
          </span>
          <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl lg:text-6xl">
            In English, Please
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted sm:text-xl">
            {mode === "company"
              ? "Paste a company URL and get the truth, translated into the language of a five-year-old."
              : "Paste a job post link or description and get the plain-English version without fluff."}
          </p>
        </header>

        <div className="inline-flex w-full max-w-sm rounded-full border border-line/70 bg-card/70 p-1 text-xs uppercase tracking-[0.2em] text-muted">
          <button
            type="button"
            onClick={() => handleModeChange("company")}
            className={`flex-1 rounded-full px-4 py-2 transition ${
              mode === "company" ? "bg-ink text-paper" : "hover:bg-card/90"
            }`}
          >
            Company
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("job")}
            className={`flex-1 rounded-full px-4 py-2 transition ${
              mode === "job" ? "bg-ink text-paper" : "hover:bg-card/90"
            }`}
          >
            Job
          </button>
        </div>

        {mode === "company" ? (
          <form
            onSubmit={handleAnalyze}
            noValidate
            className="animate-rise rounded-3xl border border-line/70 bg-card/80 p-6 shadow-soft backdrop-blur"
          >
            <label className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
              Company website
            </label>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row">
              <input
                type="text"
                inputMode="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://company.com"
                className="h-12 flex-1 rounded-2xl border border-line/80 bg-paper/80 px-4 text-base text-ink shadow-inner outline-none transition focus:border-accent"
              />
              <button
                type="submit"
                disabled={loading}
                className="h-12 rounded-2xl bg-ink px-6 text-sm font-semibold uppercase tracking-[0.2em] text-paper transition hover:-translate-y-0.5 hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Scraping..." : "Tell me the truth"}
              </button>
            </div>
            {error ? (
              <p className="mt-3 text-sm text-red-700">{error}</p>
            ) : null}
            <p className="mt-4 text-xs text-muted">
              We grab the homepage, the About page, and the Product/Features page.
            </p>
          </form>
        ) : (
          <form
            onSubmit={handleJobAnalyze}
            noValidate
            className="animate-rise rounded-3xl border border-line/70 bg-card/80 p-6 shadow-soft backdrop-blur"
          >
            <label className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
              Job post link
            </label>
            <div className="mt-4 flex flex-col gap-4">
              <input
                type="text"
                inputMode="url"
                value={jobUrl}
                onChange={(event) => setJobUrl(event.target.value)}
                placeholder="Paste the job post link..."
                className="h-12 w-full rounded-2xl border border-line/80 bg-paper/80 px-4 text-base text-ink shadow-inner outline-none transition focus:border-accent"
              />
              <p className="text-xs text-muted">
                LinkedIn and some job boards block scraping. If it fails, paste the
                description below.
              </p>
              <details className="rounded-2xl border border-line/70 bg-paper/60 px-4 py-3">
                <summary className="cursor-pointer text-xs uppercase tracking-[0.2em] text-muted">
                  Or paste the description
                </summary>
                <div className="mt-3">
                  <textarea
                    value={jobText}
                    onChange={(event) => setJobText(event.target.value)}
                    placeholder="Paste the full job description here..."
                    rows={6}
                    className="w-full rounded-2xl border border-line/80 bg-paper/80 px-4 py-3 text-base text-ink shadow-inner outline-none transition focus:border-accent"
                  />
                </div>
              </details>
              <button
                type="submit"
                disabled={jobLoading}
                className="h-12 rounded-2xl bg-ink px-6 text-sm font-semibold uppercase tracking-[0.2em] text-paper transition hover:-translate-y-0.5 hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {jobLoading ? "Scraping..." : "Tell me the truth"}
              </button>
            </div>
            {jobError ? (
              <p className="mt-3 text-sm text-red-700">{jobError}</p>
            ) : null}
            <p className="mt-4 text-xs text-muted">
              We strip buzzwords and keep only what the role really asks for.
            </p>
          </form>
        )}

        {mode === "company" && analysis ? (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl text-ink">The simple truth</h2>
              <div className="relative">
                <button
                  type="button"
                  className="group inline-flex items-center gap-2 rounded-full border border-line/70 bg-card/80 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted"
                  aria-label="Fluff rating explanation"
                  aria-expanded={showFluffHelp}
                  aria-describedby="fluff-help"
                  onClick={() => setShowFluffHelp((prev) => !prev)}
                  onBlur={() => setShowFluffHelp(false)}
                >
                  Fluff rating: {analysis.fluff_rating || "?"}/10
                  <span className="text-sm">ⓘ</span>
                  <span
                    id="fluff-help"
                    data-open={showFluffHelp}
                    className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-64 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-line/70 bg-paper px-3 py-2 text-xs normal-case tracking-normal text-ink opacity-0 shadow-soft transition data-[open=true]:opacity-100 sm:left-auto sm:right-0 sm:top-0 sm:mt-0 sm:w-64 sm:-translate-y-full sm:text-[11px] sm:group-hover:opacity-100 sm:group-focus:opacity-100"
                  >
                    High = lots of fluff and buzzwords. Low = plain, direct language.
                  </span>
                </button>
              </div>
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

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
              {shareId ? (
                <>
                  <button
                    type="button"
                    onClick={handleShareCopy}
                    title="Copy share link"
                    aria-label="Copy share link"
                    className="rounded-full border border-line/70 bg-paper/70 px-3 py-1 uppercase tracking-[0.2em] text-muted hover:border-accent"
                  >
                    Copy link
                  </button>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Share on LinkedIn"
                    aria-label="Share on LinkedIn"
                    className="rounded-full border border-line/70 bg-paper/70 px-3 py-1 hover:border-accent"
                  >
                    <img
                      src={getFaviconUrl("linkedin.com")}
                      alt="LinkedIn"
                      className="h-4 w-4"
                    />
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareMessage)}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Share on Twitter"
                    aria-label="Share on Twitter"
                    className="rounded-full border border-line/70 bg-paper/70 px-3 py-1 hover:border-accent"
                  >
                    <img
                      src={getFaviconUrl("twitter.com")}
                      alt="Twitter"
                      className="h-4 w-4"
                    />
                  </a>
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareMessage} ${shareUrl}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Share on WhatsApp"
                    aria-label="Share on WhatsApp"
                    className="rounded-full border border-line/70 bg-paper/70 px-3 py-1 hover:border-accent"
                  >
                    <img
                      src={getFaviconUrl("whatsapp.com")}
                      alt="WhatsApp"
                      className="h-4 w-4"
                    />
                  </a>
                  {shareStatus ? (
                    <span
                      className="uppercase tracking-[0.2em]"
                      title={shareStatus}
                    >
                      {shareStatus}
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled
                    title="Copy share link"
                    aria-label="Copy share link"
                    className="cursor-not-allowed rounded-full border border-line/70 bg-paper/50 px-3 py-1 uppercase tracking-[0.2em] text-muted/70"
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Share on LinkedIn"
                    aria-label="Share on LinkedIn"
                    className="cursor-not-allowed rounded-full border border-line/70 bg-paper/50 px-3 py-1 text-muted/70"
                  >
                    <img
                      src={getFaviconUrl("linkedin.com")}
                      alt="LinkedIn"
                      className="h-4 w-4 opacity-60"
                    />
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Share on Twitter"
                    aria-label="Share on Twitter"
                    className="cursor-not-allowed rounded-full border border-line/70 bg-paper/50 px-3 py-1 text-muted/70"
                  >
                    <img
                      src={getFaviconUrl("twitter.com")}
                      alt="Twitter"
                      className="h-4 w-4 opacity-60"
                    />
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Share on WhatsApp"
                    aria-label="Share on WhatsApp"
                    className="cursor-not-allowed rounded-full border border-line/70 bg-paper/50 px-3 py-1 text-muted/70"
                  >
                    <img
                      src={getFaviconUrl("whatsapp.com")}
                      alt="WhatsApp"
                      className="h-4 w-4 opacity-60"
                    />
                  </button>
                  <span
                    className="uppercase tracking-[0.2em]"
                    title={shareNote || "Sharing unavailable"}
                  >
                    {shareNote || "Sharing unavailable"}
                  </span>
                </>
              )}
            </div>
          </section>
        ) : null}

        {mode === "job" && jobAnalysis ? (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl text-ink">The simple truth</h2>
              <div className="relative">
                <button
                  type="button"
                  className="group inline-flex items-center gap-2 rounded-full border border-line/70 bg-card/80 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted"
                  aria-label="Fluff rating explanation"
                  aria-expanded={showJobFluffHelp}
                  aria-describedby="job-fluff-help"
                  onClick={() => setShowJobFluffHelp((prev) => !prev)}
                  onBlur={() => setShowJobFluffHelp(false)}
                >
                  Fluff rating: {jobAnalysis.fluff_rating || "?"}/10
                  <span className="text-sm">ⓘ</span>
                  <span
                    id="job-fluff-help"
                    data-open={showJobFluffHelp}
                    className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-64 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-line/70 bg-paper px-3 py-2 text-xs normal-case tracking-normal text-ink opacity-0 shadow-soft transition data-[open=true]:opacity-100 sm:left-auto sm:right-0 sm:top-0 sm:mt-0 sm:w-64 sm:-translate-y-full sm:text-[11px] sm:group-hover:opacity-100 sm:group-focus:opacity-100"
                  >
                    High = lots of fluff and buzzwords. Low = plain, direct language.
                  </span>
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {JOB_CARD_DEFS.map((card, index) => (
                <article
                  key={card.key}
                  className="animate-rise rounded-3xl border border-line/70 bg-card/90 p-5 shadow-crisp"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <div className="mb-3 flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-muted">
                    <span className="text-lg">{card.icon}</span>
                    {card.title}
                  </div>
                  {jobAnalysis[card.key] ? (
                    <ul className="list-disc space-y-2 pl-5 text-base text-ink">
                      {toBullets(jobAnalysis[card.key]).map((line, lineIndex) => (
                        <li key={`${card.key}-${lineIndex}`}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-base text-ink">No clear answer yet.</p>
                  )}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {mode === "job" && jobAnalysis ? (
          <section className="animate-rise rounded-3xl border border-line/70 bg-card/90 p-6 shadow-soft">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-xl text-ink">Ask follow-up questions</h3>
              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                Keep it simple
              </span>
            </div>

            <div className="space-y-4">
              <div className="max-h-72 space-y-3 overflow-y-auto rounded-2xl border border-line/60 bg-paper/70 p-4">
                {jobChatMessages.length === 0 ? (
                  <p className="text-sm text-muted">
                    Try: &quot;What is the day-to-day?&quot; or &quot;Is this senior?&quot;
                  </p>
                ) : null}
                {jobChatMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      message.role === "user"
                        ? "ml-auto bg-ink text-paper"
                        : "mr-auto bg-card text-ink"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <ul className="list-disc space-y-2 pl-5">
                        {toBullets(message.text).map((line, lineIndex) => (
                          <li key={`${message.role}-${index}-${lineIndex}`}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      message.text
                    )}
                  </div>
                ))}
              </div>

              <form onSubmit={handleJobChat} className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={jobChatInput}
                  onChange={(event) => setJobChatInput(event.target.value)}
                  placeholder="Ask about the role..."
                  className="h-11 flex-1 rounded-2xl border border-line/80 bg-paper/80 px-4 text-sm text-ink outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={jobChatLoading}
                  className="h-11 rounded-2xl bg-accent px-6 text-xs font-semibold uppercase tracking-[0.2em] text-paper transition hover:-translate-y-0.5 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {jobChatLoading ? "Thinking..." : "Ask"}
                </button>
              </form>
            </div>
          </section>
        ) : null}

        {mode === "company" && analysis ? (
          <section className="animate-rise rounded-3xl border border-line/70 bg-card/90 p-6 shadow-soft">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-xl text-ink">Ask follow-up questions</h3>
              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                Keep it simple
              </span>
            </div>

            <div className="space-y-4">
              <div className="max-h-72 space-y-3 overflow-y-auto rounded-2xl border border-line/60 bg-paper/70 p-4">
                {chatMessages.length === 0 ? (
                  <p className="text-sm text-muted">
                    Try: &quot;How do they make money?&quot; or &quot;Who signs the contract?&quot;
                  </p>
                ) : null}
                {chatMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      message.role === "user"
                        ? "ml-auto bg-ink text-paper"
                        : "mr-auto bg-card text-ink"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <ul className="list-disc space-y-2 pl-5">
                        {toBullets(message.text).map((line, lineIndex) => (
                          <li key={`${message.role}-${index}-${lineIndex}`}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      message.text
                    )}
                  </div>
                ))}
              </div>

              <form onSubmit={handleChat} className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Ask about the business model..."
                  className="h-11 flex-1 rounded-2xl border border-line/80 bg-paper/80 px-4 text-sm text-ink outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={chatLoading}
                  className="h-11 rounded-2xl bg-accent px-6 text-xs font-semibold uppercase tracking-[0.2em] text-paper transition hover:-translate-y-0.5 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {chatLoading ? "Thinking..." : "Ask"}
                </button>
              </form>
            </div>
          </section>
        ) : null}

        {recentCompanies.length ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-xl text-ink">Recently analyzed</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">
                  {formatCount(recentTotal, "companies")}
                </span>
                <a
                  href="/companies"
                  className="rounded-full border border-line/70 bg-card/80 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted hover:border-accent"
                >
                  See all companies
                </a>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted">
              {recentCompanies.map((company) => (
                <a
                  key={company.id || `${company.url}-${company.created_at}`}
                  href={company.id ? `/share/${company.id}` : company.url}
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
        ) : null}

        {mode === "job" && recentJobs.length ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-xl text-ink">Recently analyzed jobs</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">
                  {formatCount(recentJobsTotal, "jobs")}
                </span>
                <a
                  href="/jobs"
                  className="rounded-full border border-line/70 bg-card/80 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted hover:border-accent"
                >
                  See all jobs
                </a>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted">
              {recentJobs.map((job) => (
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
        ) : null}

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-muted">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Made by</span>
            <a
              href="https://x.com/harel_nimrod"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-line/70 bg-card/80 px-3 py-2 hover:border-accent"
              title="Twitter/X"
              aria-label="Twitter/X"
            >
              <img
                src={getFaviconUrl("x.com")}
                alt="Twitter/X"
                className="h-4 w-4"
              />
            </a>
            <a
              href="https://www.linkedin.com/in/nimrodharel999/"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-line/70 bg-card/80 px-3 py-2 hover:border-accent"
              title="LinkedIn"
              aria-label="LinkedIn"
            >
              <img
                src={getFaviconUrl("linkedin.com")}
                alt="LinkedIn"
                className="h-4 w-4"
              />
            </a>
            <a
              href="mailto:nimrodharel1@gmail.com?subject=In%20English%2C%20Please%20contact"
              className="rounded-full border border-line/70 bg-card/80 px-3 py-2 hover:border-accent"
              title="Email"
              aria-label="Email"
            >
              <img
                src="/icons/mail.svg"
                alt="Email"
                className="h-4 w-4"
              />
            </a>
          </div>
          {REPO_URL ? (
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-line/70 bg-card/80 px-3 py-2 hover:border-accent"
              title="GitHub"
              aria-label="GitHub"
            >
              <img
                src={getFaviconUrl("github.com")}
                alt="GitHub"
                className="h-4 w-4"
              />
            </a>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
