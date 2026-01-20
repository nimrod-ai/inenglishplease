const DEFAULT_WINDOW_MS = 60 * 60 * 1000;
const tokenBudgets = new Map();

export class TokenLimitError extends Error {
  constructor(message, { remaining, resetAt, maxTokens }) {
    super(message);
    this.name = "TokenLimitError";
    this.status = 429;
    this.code = "token_limit";
    this.remaining = remaining;
    this.resetAt = resetAt;
    this.maxTokens = maxTokens;
  }
}

export function estimateTokensFromText(text) {
  if (!text) {
    return 0;
  }

  return Math.max(1, Math.ceil(text.length / 4));
}

export function getTokenBudgetConfig() {
  const maxTokensRaw = process.env.TOKEN_BUDGET_MAX_TOKENS || "";
  const windowRaw = process.env.TOKEN_BUDGET_WINDOW_MS || "";
  const maxTokens = Number.parseInt(maxTokensRaw, 10);
  const windowMs = Number.parseInt(windowRaw, 10);

  return {
    enabled: Number.isFinite(maxTokens) && maxTokens > 0,
    maxTokens: Number.isFinite(maxTokens) ? maxTokens : 0,
    windowMs:
      Number.isFinite(windowMs) && windowMs > 0 ? windowMs : DEFAULT_WINDOW_MS
  };
}

export function getClientKey(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) {
      return ip;
    }
  }

  const headerIp =
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("true-client-ip");
  if (headerIp) {
    return headerIp.trim();
  }

  return request.ip || "unknown";
}

export function consumeTokens({ key, tokens, maxTokens, windowMs }) {
  if (!maxTokens || maxTokens <= 0 || !tokens || tokens <= 0) {
    return { remaining: maxTokens || Infinity, resetAt: null };
  }

  const now = Date.now();
  const normalizedKey = key || "anonymous";
  let entry = tokenBudgets.get(normalizedKey);

  if (!entry || entry.resetAt <= now) {
    entry = {
      used: 0,
      resetAt: now + windowMs
    };
  }

  if (tokens > maxTokens) {
    throw new TokenLimitError("Request exceeds the token budget.", {
      remaining: 0,
      resetAt: entry.resetAt,
      maxTokens
    });
  }

  if (entry.used + tokens > maxTokens) {
    throw new TokenLimitError("Token limit exceeded for this user.", {
      remaining: Math.max(0, maxTokens - entry.used),
      resetAt: entry.resetAt,
      maxTokens
    });
  }

  entry.used += tokens;
  tokenBudgets.set(normalizedKey, entry);

  return {
    remaining: Math.max(0, maxTokens - entry.used),
    resetAt: entry.resetAt
  };
}
