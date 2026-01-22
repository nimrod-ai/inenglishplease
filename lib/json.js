export function safeJsonParse(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch (innerError) {
      return null;
    }
  }
}

export function normalizeAnalysis(data) {
  const result = {
    product: data.product || "",
    buyer: data.buyer || "",
    claim: data.claim || "",
    fluff_rating: data.fluff_rating || data.fluffRating || ""
  };

  if (typeof result.fluff_rating === "string") {
    const parsed = parseInt(result.fluff_rating, 10);
    if (!Number.isNaN(parsed)) {
      result.fluff_rating = parsed;
    }
  }

  if (typeof result.fluff_rating !== "number") {
    result.fluff_rating = "";
  } else {
    result.fluff_rating = Math.min(10, Math.max(1, result.fluff_rating));
  }

  return result;
}

export function normalizeJobAnalysis(data) {
  const result = {
    company_team: data.company_team || data.companyTeam || "",
    you_will_do: data.you_will_do || data.youWillDo || "",
    requirements: data.requirements || "",
    fluff_rating: data.fluff_rating || data.fluffRating || ""
  };

  const textKeys = ["company_team", "you_will_do", "requirements"];
  for (const key of textKeys) {
    if (typeof result[key] !== "string") {
      result[key] = result[key] ? String(result[key]) : "";
    }
  }

  if (typeof result.fluff_rating === "string") {
    const parsed = parseInt(result.fluff_rating, 10);
    if (!Number.isNaN(parsed)) {
      result.fluff_rating = parsed;
    }
  }

  if (typeof result.fluff_rating !== "number") {
    result.fluff_rating = "";
  } else {
    result.fluff_rating = Math.min(10, Math.max(1, result.fluff_rating));
  }

  return result;
}
