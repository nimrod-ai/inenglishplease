import { NextResponse } from "next/server";
import { answerFollowup } from "../../../lib/llm.js";

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

    const answer = await answerFollowup({
      question,
      context: body?.context || "",
      analysis: body?.analysis || null
    });

    return NextResponse.json({ answer });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to answer." },
      { status: 500 }
    );
  }
}
