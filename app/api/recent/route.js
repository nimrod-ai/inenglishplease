import { NextResponse } from "next/server";
import { getRecentCompanyResults } from "../../../lib/cache.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getRecentCompanyResults(8);
  if (!result) {
    return NextResponse.json({ total: 0, items: [] });
  }

  return NextResponse.json(result);
}
