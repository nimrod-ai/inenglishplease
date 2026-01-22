import { NextResponse } from "next/server";
import { answerJobFollowup } from "../../../lib/llm.js";
import { getClientKey } from "../../../lib/token-limit.js";

export async function POST(request) {
  try {
    const body = await request.json();
    const question = body?.question;

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "A question string is required." },
        { status: 400 }
      );
    }

    const userKey = getClientKey(request);
    const answer = await answerJobFollowup({
      question,
      context: body?.context || "",
      analysis: body?.analysis || null,
      userKey
    });

    return NextResponse.json({ answer });
  } catch (error) {
    const status =
      typeof error.status === "number" && error.status >= 400 && error.status < 600
        ? error.status
        : 500;
    const payload = { error: error.message || "Failed to answer." };
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
