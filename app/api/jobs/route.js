import { NextResponse } from "next/server";
import { getRecentJobResults } from "../../../lib/cache.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 8;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : 8;
  const result = await getRecentJobResults(safeLimit);
  if (!result) {
    return NextResponse.json({ total: 0, items: [] });
  }

  return NextResponse.json(result);
}
