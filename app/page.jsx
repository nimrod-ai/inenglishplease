"use client";

import { useState } from "react";

const CARD_DEFS = [
  { key: "product", icon: "📦", title: "What they sell" },
  { key: "buyer", icon: "👤", title: "Who buys it" },
  { key: "claim", icon: "💰", title: "The 'Why'" }
];
const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL || "";
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

export default function Home() {
  const [url, setUrl] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [context, setContext] = useState("");
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

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

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze the site.");
      }

      setAnalysis(data.analysis);
      setContext(data.context || "");
      setSources(data.sources || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
            Paste a company URL and get the truth, translated into the language of a
            five-year-old.
          </p>
        </header>

        <form
          onSubmit={handleAnalyze}
          className="animate-rise rounded-3xl border border-line/70 bg-card/80 p-6 shadow-soft backdrop-blur"
        >
          <label className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
            Company website
          </label>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row">
            <input
              type="url"
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

        {analysis ? (
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
        ) : null}

        {analysis ? (
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

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-muted">
          <a
            href="mailto:nimrodharel1@gmail.com?subject=In%20English%2C%20Please%20contact"
            className="rounded-full border border-line/70 bg-card/80 px-4 py-2 hover:border-accent"
          >
            Email contact
          </a>
          {REPO_URL ? (
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-line/70 bg-card/80 px-4 py-2 hover:border-accent"
            >
              Git repo
            </a>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
