import { NextResponse } from "next/server";
import { analyzeCompany } from "../../../lib/analyze.js";

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

    const result = await analyzeCompany(url);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to analyze the company." },
      { status: 500 }
    );
  }
}
