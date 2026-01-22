import { load } from "cheerio";
import { promises as dns } from "dns";
import net from "net";

const ABOUT_KEYWORDS = ["about", "company", "team", "mission", "story", "who-we-are", "why-us"];
const PRODUCT_KEYWORDS = [
  "product",
  "products",
  "features",
  "platform",
  "solutions",
  "services",
  "what-we-do",
  "whatwedo",
  "capabilities"
];
const USE_CASE_KEYWORDS = [
  "use cases",
  "use-cases",
  "use case",
  "case studies",
  "case-studies",
  "case study",
  "customers",
  "customer-stories",
  "industries",
  "examples",
  "solutions"
];
const BLOCKLIST = [
  "blog",
  "news",
  "press",
  "careers",
  "jobs",
  "privacy",
  "terms",
  "legal",
  "support",
  "contact",
  "login",
  "signin",
  "signup"
];
const MAX_SECTION_CHARS = 4000;
const MIN_JOB_TEXT_CHARS = 200;
const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; GorillaScraper/1.0; +https://example.com)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};
const BROWSER_HEADERS = {
  ...DEFAULT_HEADERS,
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Upgrade-Insecure-Requests": "1"
};
const ABOUT_PATHS = ["/about", "/about-us", "/company", "/who-we-are", "/mission", "/story"];
const PRODUCT_PATHS = [
  "/product",
  "/products",
  "/features",
  "/platform",
  "/solutions",
  "/services",
  "/what-we-do"
];
const USE_CASE_PATHS = [
  "/use-cases",
  "/usecases",
  "/case-studies",
  "/case-study",
  "/customers",
  "/customer-stories",
  "/industries",
  "/solutions",
  "/examples"
];
const BLOCKED_STATUSES = new Set([401, 403, 429]);
const MAX_RESPONSE_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;
const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
  "instance-data",
  "metadata.google.internal."
]);
const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".test"
];

class ScrapeError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ScrapeError";
    this.status = status;
    this.code = code;
  }
}

function isBlockedError(error) {
  return error instanceof ScrapeError && BLOCKED_STATUSES.has(error.status);
}

function normalizeHostname(hostname) {
  return hostname.replace(/\.+$/, "").toLowerCase();
}

function isPrivateIpv4(ip) {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b, c, d] = parts;
  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 192 && b === 0 && c === 0) {
    return true;
  }
  if (a === 192 && b === 0 && c === 2) {
    return true;
  }
  if (a === 198 && (b === 18 || b === 19)) {
    return true;
  }
  if (a === 198 && b === 51 && c === 100) {
    return true;
  }
  if (a === 203 && b === 0 && c === 113) {
    return true;
  }
  if (a >= 224) {
    return true;
  }
  if (a === 255 && b === 255 && c === 255 && d === 255) {
    return true;
  }

  return false;
}

function isPrivateIpv6(ip) {
  const normalized = ip.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") {
    return true;
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }
  if (normalized.startsWith("ff")) {
    return true;
  }
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.replace("::ffff:", "");
    if (mapped.includes(".")) {
      return isPrivateIpv4(mapped);
    }
  }

  const lastPart = normalized.split(":").pop();
  if (lastPart && lastPart.includes(".")) {
    return isPrivateIpv4(lastPart);
  }

  return false;
}

function isPrivateIp(ip) {
  const version = net.isIP(ip);
  if (version === 4) {
    return isPrivateIpv4(ip);
  }
  if (version === 6) {
    return isPrivateIpv6(ip);
  }
  return true;
}

function isBlockedHostname(hostname) {
  const normalized = normalizeHostname(hostname);
  if (!normalized) {
    return true;
  }
  if (BLOCKED_HOSTS.has(normalized)) {
    return true;
  }
  return BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

async function assertSafeUrl(inputUrl) {
  let parsed;
  try {
    parsed = new URL(inputUrl);
  } catch (error) {
    throw new ScrapeError("Invalid URL.", 400, "invalid_url");
  }

  if (parsed.username || parsed.password) {
    throw new ScrapeError("Credentials are not allowed in URLs.", 400, "unsafe_url");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ScrapeError("Only http/https URLs are allowed.", 400, "invalid_url");
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (isBlockedHostname(hostname)) {
    throw new ScrapeError("Unsafe hostname.", 400, "unsafe_url");
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new ScrapeError("Unsafe IP address.", 400, "unsafe_url");
    }
    return;
  }

  let records;
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch (error) {
    throw new ScrapeError("Unable to resolve host.", 400, "dns_failed");
  }

  if (!records.length) {
    throw new ScrapeError("Unable to resolve host.", 400, "dns_failed");
  }

  for (const record of records) {
    if (isPrivateIp(record.address)) {
      throw new ScrapeError("Unsafe IP address.", 400, "unsafe_url");
    }
  }
}

async function readBodyWithLimit(response) {
  const lengthHeader = response.headers.get("content-length");
  const contentLength = lengthHeader ? Number.parseInt(lengthHeader, 10) : null;
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new ScrapeError("Response too large.", 413, "response_too_large");
  }

  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    received += value.length;
    if (received > MAX_RESPONSE_BYTES) {
      throw new ScrapeError("Response too large.", 413, "response_too_large");
    }

    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks).toString("utf-8");
}

export function normalizeUrl(input) {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function buildBaseCandidates(inputUrl) {
  const trimmed = inputUrl.trim();
  const normalized = normalizeUrl(trimmed);
  const candidates = [];
  const addCandidate = (url) => {
    if (url && !candidates.includes(url)) {
      candidates.push(url);
    }
  };

  addCandidate(normalized);

  try {
    const url = new URL(normalized);
    const host = url.hostname;
    const isIpHost = /^[0-9.]+$/.test(host) || host.includes(":");
    const altHost =
      !isIpHost && host !== "localhost"
        ? host.startsWith("www.")
          ? host.slice(4)
          : `www.${host}`
        : null;
    const protocols = [url.protocol];
    const altProtocol = url.protocol === "https:" ? "http:" : "https:";
    if (!protocols.includes(altProtocol)) {
      protocols.push(altProtocol);
    }
    const hosts = altHost && altHost !== host ? [host, altHost] : [host];

    for (const protocol of protocols) {
      for (const hostname of hosts) {
        const candidate = new URL(url.toString());
        candidate.protocol = protocol;
        candidate.hostname = hostname;
        addCandidate(candidate.toString());
      }
    }
  } catch (error) {
    return candidates;
  }

  return candidates;
}

async function fetchHtml(url, options = {}) {
  const headers = {
    ...DEFAULT_HEADERS,
    ...(options.headers || {})
  };
  let currentUrl = url;

  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    await assertSafeUrl(currentUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response;

    try {
      response = await fetch(currentUrl, {
        redirect: "manual",
        headers,
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new ScrapeError(`Request timed out for ${currentUrl}.`, 408, "timeout");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new ScrapeError(`Redirect missing location for ${currentUrl}.`, 400, "redirect_failed");
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!response.ok) {
      throw new ScrapeError(`Failed to fetch ${currentUrl} (${response.status})`, response.status, "fetch_failed");
    }

    const html = await readBodyWithLimit(response);
    return {
      html,
      finalUrl: currentUrl,
      method: options.method || "fetch"
    };
  }

  throw new ScrapeError(`Too many redirects for ${url}.`, 400, "redirect_loop");
}

async function createPlaywrightContext() {
  let browser;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const context = await browser.newContext({
      userAgent: DEFAULT_HEADERS["User-Agent"],
      locale: "en-US",
      viewport: { width: 1280, height: 720 }
    });
    const hostSafetyCache = new Map();
    const isSafeRequest = async (requestUrl) => {
      let hostname = "";
      try {
        hostname = normalizeHostname(new URL(requestUrl).hostname);
      } catch (error) {
        return false;
      }

      if (hostSafetyCache.has(hostname)) {
        return hostSafetyCache.get(hostname);
      }

      try {
        await assertSafeUrl(requestUrl);
        hostSafetyCache.set(hostname, true);
        return true;
      } catch (error) {
        hostSafetyCache.set(hostname, false);
        return false;
      }
    };

    await context.route("**/*", async (route) => {
      const request = route.request();
      const type = request.resourceType();
      if (type === "image" || type === "font" || type === "media") {
        return route.abort();
      }

      const requestUrl = request.url();
      if (!(await isSafeRequest(requestUrl))) {
        return route.abort();
      }

      return route.continue();
    });

    return {
      browser,
      context,
      async close() {
        await context.close();
        await browser.close();
      }
    };
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    const message = error?.message?.includes("Cannot find module")
      ? "Playwright is not installed. Run: npm install && npx playwright install"
      : "Playwright failed to launch.";
    throw new ScrapeError(message, 403, "playwright_failed");
  }
}

async function renderWithPlaywright(url, options = {}) {
  let localContext = null;
  let page = null;
  let context = options.context;
  let browser = options.browser;

  try {
    await assertSafeUrl(url);

    if (!context || !browser) {
      localContext = await createPlaywrightContext();
      context = localContext.context;
      browser = localContext.browser;
    }

    const waitUntil = options.waitUntil || "domcontentloaded";
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 20000;
    const postWaitMs = Number.isFinite(options.postWaitMs) ? options.postWaitMs : 500;

    page = await context.newPage();
    await page.goto(url, { waitUntil, timeout: timeoutMs });
    if (postWaitMs > 0) {
      await page.waitForTimeout(postWaitMs);
    }

    return await page.content();
  } catch (error) {
    if (error instanceof ScrapeError) {
      throw error;
    }
    const message = `Playwright failed to render ${url}`;
    throw new ScrapeError(message, 403, "playwright_failed");
  } finally {
    if (page) {
      await page.close();
    }
    if (localContext) {
      await localContext.close();
    }
  }
}

async function fetchHtmlWithFallbacks(url, options = {}) {
  let lastError;

  try {
    return await fetchHtml(url, { method: "fetch" });
  } catch (error) {
    lastError = error;
  }

  if (!isBlockedError(lastError)) {
    throw lastError;
  }

  try {
    return await fetchHtml(url, { headers: BROWSER_HEADERS, method: "fetch_browser" });
  } catch (error) {
    lastError = error;
  }

  if (!isBlockedError(lastError)) {
    throw lastError;
  }

  let playwrightContext = null;
  if (options.getPlaywrightContext) {
    playwrightContext = await options.getPlaywrightContext();
  } else if (options.playwrightContext) {
    playwrightContext = options.playwrightContext;
  }

  const html = await renderWithPlaywright(url, playwrightContext || {});
  return {
    html,
    finalUrl: url,
    method: "playwright"
  };
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
}

function extractText(html) {
  const $ = load(html);
  $("script, style, noscript, svg, canvas, iframe").remove();
  $("nav, header, footer, form, aside").remove();
  $("[role='navigation'], [aria-label*='nav']").remove();
  $(".nav, .navbar, .menu, .header, .footer, .site-header, .site-footer").remove();

  const main = $("main");
  const text = main.length ? main.text() : $("body").text();
  return cleanText(text);
}

function truncateText(text) {
  if (text.length <= MAX_SECTION_CHARS) {
    return text;
  }
  return text.slice(0, MAX_SECTION_CHARS);
}

function looksClientRendered(html, text) {
  if (!html) {
    return true;
  }

  if (text && text.length >= MIN_JOB_TEXT_CHARS) {
    return false;
  }

  const markers = [
    "__NEXT_DATA__",
    "data-reactroot",
    "id=\"root\"",
    "id=\"app\"",
    "id=\"__nuxt\"",
    "window.__NUXT__"
  ];

  return markers.some((marker) => html.includes(marker));
}

function collectLinks($, baseUrl) {
  const base = new URL(baseUrl);
  const seen = new Set();
  const links = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return;
    }

    let absolute;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch (error) {
      return;
    }

    const url = new URL(absolute);
    if (url.origin !== base.origin) {
      return;
    }

    const normalized = url.toString().split("#")[0];
    if (seen.has(normalized) || normalized === baseUrl) {
      return;
    }

    seen.add(normalized);
    links.push({
      url: normalized,
      text: $(element).text().trim().toLowerCase(),
      href: href.toLowerCase()
    });
  });

  return links;
}

function scoreLink(link, keywords) {
  let score = 0;
  for (const keyword of keywords) {
    if (link.href.includes(keyword)) {
      score += 2;
    }
    if (link.text.includes(keyword)) {
      score += 3;
    }
  }

  for (const blocked of BLOCKLIST) {
    if (link.href.includes(blocked) || link.text.includes(blocked)) {
      score -= 5;
    }
  }

  const depth = link.url.split("/").length;
  score -= Math.min(3, Math.max(0, depth - 4));

  return score;
}

function pickBestLink(links, keywords) {
  let best = null;
  let bestScore = 0;

  for (const link of links) {
    const score = scoreLink(link, keywords);
    if (score > bestScore) {
      best = link;
      bestScore = score;
    }
  }

  return best ? best.url : null;
}

function buildCandidateUrls(baseUrls, paths) {
  const bases = Array.isArray(baseUrls) ? baseUrls : [baseUrls];
  const urls = [];

  for (const baseUrl of bases) {
    if (!baseUrl) {
      continue;
    }

    try {
      const origin = new URL(baseUrl).origin;
      for (const path of paths) {
        urls.push(`${origin}${path}`);
      }
    } catch (error) {
      continue;
    }
  }

  return urls;
}

async function fetchFirstAvailable(urls, options = {}) {
  const seen = new Set();
  let lastError = null;

  for (const url of urls) {
    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);

    try {
      const result = await fetchHtmlWithFallbacks(url, options);
      return {
        html: result.html,
        url: result.finalUrl || url,
        method: result.method,
        error: null
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    html: "",
    url: "",
    method: "",
    error: lastError
  };
}

export async function scrapeSite(inputUrl) {
  let playwrightContext = null;
  let playwrightError = null;
  const getPlaywrightContext = async () => {
    if (playwrightContext) {
      return playwrightContext;
    }
    if (playwrightError) {
      throw playwrightError;
    }

    try {
      playwrightContext = await createPlaywrightContext();
      return playwrightContext;
    } catch (error) {
      playwrightError = error;
      throw error;
    }
  };

  try {
    const baseCandidates = buildBaseCandidates(inputUrl);
    const homepageResult = await fetchFirstAvailable(baseCandidates, { getPlaywrightContext });
    const baseUrl = homepageResult.url || baseCandidates[0];
    const baseOrigins = baseUrl && !baseCandidates.includes(baseUrl)
      ? [baseUrl, ...baseCandidates]
      : baseCandidates;
    const homepageHtml = homepageResult.html;
    const homepageError = homepageResult.error;

    const homepageText = homepageHtml ? truncateText(extractText(homepageHtml)) : "";

    const $ = homepageHtml ? load(homepageHtml) : null;
    const links = $ ? collectLinks($, baseUrl) : [];

    const aboutUrl = pickBestLink(links, ABOUT_KEYWORDS);
    const productUrl = pickBestLink(links, PRODUCT_KEYWORDS);
    const useCasesUrl = pickBestLink(links, USE_CASE_KEYWORDS);

    const aboutCandidates = [aboutUrl, ...buildCandidateUrls(baseOrigins, ABOUT_PATHS)];
    const productCandidates = [productUrl, ...buildCandidateUrls(baseOrigins, PRODUCT_PATHS)];
    const useCaseCandidates = [useCasesUrl, ...buildCandidateUrls(baseOrigins, USE_CASE_PATHS)];

    const [aboutResult, productResult, useCaseResult] = await Promise.all([
      fetchFirstAvailable(aboutCandidates, { getPlaywrightContext }),
      fetchFirstAvailable(productCandidates, { getPlaywrightContext }),
      fetchFirstAvailable(useCaseCandidates, { getPlaywrightContext })
    ]);

    const aboutText = aboutResult.html ? truncateText(extractText(aboutResult.html)) : "";
    const productText = productResult.html ? truncateText(extractText(productResult.html)) : "";
    const useCasesText = useCaseResult.html ? truncateText(extractText(useCaseResult.html)) : "";

    if (!homepageText && !aboutText && !productText && !useCasesText) {
      const errors = [homepageError, aboutResult.error, productResult.error, useCaseResult.error];
      const playwrightError = errors.find(
        (error) => error instanceof ScrapeError && error.code === "playwright_failed"
      );
      if (playwrightError) {
        throw playwrightError;
      }

      const blockedError = errors.find(isBlockedError);
      if (blockedError) {
        throw new ScrapeError("Site blocked by anti-bot protection.", blockedError.status, "blocked");
      }
    }

    const sourceSet = new Set();
    if (homepageHtml && baseUrl) {
      sourceSet.add(baseUrl);
    }
    if (aboutResult.url) {
      sourceSet.add(aboutResult.url);
    }
    if (productResult.url) {
      sourceSet.add(productResult.url);
    }
    if (useCaseResult.url) {
      sourceSet.add(useCaseResult.url);
    }

    return {
      homepageText,
      aboutText,
      productText,
      useCasesText,
      sources: Array.from(sourceSet)
    };
  } finally {
    if (playwrightContext) {
      await playwrightContext.close();
    }
  }
}

export async function scrapeJobPage(inputUrl) {
  const normalized = normalizeUrl(inputUrl);
  const result = await fetchHtmlWithFallbacks(normalized);
  let text = result.html ? truncateText(extractText(result.html)) : "";
  let finalUrl = result.finalUrl || normalized;

  if (looksClientRendered(result.html, text) || text.length < MIN_JOB_TEXT_CHARS) {
    const renderedHtml = await renderWithPlaywright(normalized, {
      waitUntil: "networkidle",
      postWaitMs: 1200,
      timeoutMs: 30000
    });
    text = renderedHtml ? truncateText(extractText(renderedHtml)) : text;
    finalUrl = normalized;
  }

  return {
    text,
    url: finalUrl
  };
}
