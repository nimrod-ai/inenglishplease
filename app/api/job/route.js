import { NextResponse } from "next/server";
import { simplifyJobDescription } from "../../../lib/llm.js";
import { scrapeJobPage } from "../../../lib/scrape.js";
import {
  consumeTokens,
  estimateTokensFromText,
  getClientKey,
  getTokenBudgetConfig
} from "../../../lib/token-limit.js";
import { flushLangfuse, getLangfuse } from "../../../lib/langfuse.js";

const MIN_JOB_CHARS = 80;
const LINKEDIN_LOGIN_HINTS = [
  /sign in/i,
  /log in/i,
  /join linkedin/i,
  /forgot password/i,
  /new to linkedin/i,
  /continue with/i
];
const LINKEDIN_JOB_HINTS = [
  /responsibilit/i,
  /qualifications?/i,
  /requirements?/i,
  /job description/i,
  /what you(?:'|’)ll do/i,
  /seniority level/i,
  /employment type/i,
  /job function/i,
  /industries?/i,
  /apply/i
];

function looksLikeLinkedInLogin(text, url) {
  if (!url || !/linkedin\.com/i.test(url)) {
    return false;
  }

  const loginHits = LINKEDIN_LOGIN_HINTS.some((pattern) => pattern.test(text));
  if (!loginHits) {
    return false;
  }

  const jobHits = LINKEDIN_JOB_HINTS.some((pattern) => pattern.test(text));
  return !jobHits;
}

export async function POST(request) {
  const langfuse = getLangfuse();
  let trace = null;

  try {
    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const rawText = typeof body?.text === "string" ? body.text.trim() : "";
    let text = rawText;
    let sourceUrl = "";
    let scrapeError = null;

    if (url) {
      try {
        const scraped = await scrapeJobPage(url);
        text = scraped.text || "";
        sourceUrl = scraped.url || url;
      } catch (error) {
        scrapeError = error;
      }
    }

    if (!text) {
      return NextResponse.json(
        { error: url ? "Couldn't fetch that job link. Paste the description instead." : "Paste a job link or description first." },
        { status: 400 }
      );
    }

    if (scrapeError && rawText) {
      text = rawText;
      sourceUrl = "";
      scrapeError = null;
    } else if (scrapeError) {
      return NextResponse.json(
        { error: "Couldn't fetch that job link. Paste the description instead." },
        { status: 400 }
      );
    }

    if (looksLikeLinkedInLogin(text, sourceUrl || url)) {
      if (rawText) {
        text = rawText;
        sourceUrl = "";
      } else {
        return NextResponse.json(
          { error: "LinkedIn blocks scraping. Paste the job description instead." },
          { status: 400 }
        );
      }
    }

    if (text.length < MIN_JOB_CHARS) {
      if (rawText && rawText.length >= MIN_JOB_CHARS) {
        text = rawText;
        sourceUrl = "";
      } else {
        return NextResponse.json(
          { error: "Job description looks too short. Add more details." },
          { status: 400 }
        );
      }
    }

    if (langfuse) {
      trace = langfuse.trace({
        name: "analyze_job",
        input: { textLength: text.length, url: sourceUrl || undefined }
      });
    }

    const tokenConfig = getTokenBudgetConfig();
    if (tokenConfig.enabled) {
      const userKey = getClientKey(request);
      consumeTokens({
        key: userKey,
        tokens: estimateTokensFromText(text),
        maxTokens: tokenConfig.maxTokens,
        windowMs: tokenConfig.windowMs
      });
    }

    const analysis = await simplifyJobDescription(text, { trace });
    return NextResponse.json({ analysis, source: sourceUrl, context: text });
  } catch (error) {
    const status =
      typeof error.status === "number" && error.status >= 400 && error.status < 600
        ? error.status
        : 500;
    const payload = { error: error.message || "Failed to analyze the job." };
    if (error.code === "token_limit") {
      payload.resetAt = error.resetAt;
      payload.remaining = error.remaining;
    }

    return NextResponse.json(
      payload,
      {
        status,
        headers:
          error.code === "token_limit" && error.resetAt
            ? {
                "Retry-After": Math.max(
                  1,
                  Math.ceil((error.resetAt - Date.now()) / 1000)
                ).toString()
              }
            : undefined
      }
    );
  } finally {
    await flushLangfuse(langfuse);
  }
}
