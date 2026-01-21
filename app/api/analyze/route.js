import { NextResponse } from "next/server";
import { analyzeCompany } from "../../../lib/analyze.js";
import { getClientKey } from "../../../lib/token-limit.js";

export async function POST(request) {
  try {
    const body = await request.json();
    const url = body?.url;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "A valid url string is required." },
        { status: 400 }
      );
    }

    const userKey = getClientKey(request);
    const result = await analyzeCompany(url, { userKey });
    return NextResponse.json(result);
  } catch (error) {
    const status =
      typeof error.status === "number" && error.status >= 400 && error.status < 600
        ? error.status
        : 500;
    let message = error.message || "Failed to analyze the company.";
    const payload = { error: message };

    if (error.code === "playwright_failed") {
      message = error.message || "Playwright fallback failed.";
      payload.error = message;
    } else if (error.code === "unsafe_url") {
      message = "That URL points to a private or blocked address.";
      payload.error = message;
    } else if (error.code === "invalid_url") {
      message = "That URL is not valid.";
      payload.error = message;
    } else if (error.code === "dns_failed") {
      message = "Could not resolve that hostname.";
      payload.error = message;
    } else if (error.code === "response_too_large") {
      message = "That page is too large to process.";
      payload.error = message;
    } else if (status === 403) {
      message =
        "This site blocks automated scraping. Try another URL or enable the Playwright fallback.";
      payload.error = message;
    }

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
  }
}
