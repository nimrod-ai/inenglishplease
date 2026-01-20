import { load } from "cheerio";

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
const BLOCKED_STATUSES = new Set([401, 403, 429]);

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

export function normalizeUrl(input) {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

async function fetchHtml(url, options = {}) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      ...DEFAULT_HEADERS,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new ScrapeError(`Failed to fetch ${url} (${response.status})`, response.status, "fetch_failed");
  }

  const html = await response.text();
  return {
    html,
    finalUrl: response.url || url,
    method: options.method || "fetch"
  };
}

async function renderWithPlaywright(url) {
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
    const page = await context.newPage();

    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (type === "image" || type === "font" || type === "media") {
        return route.abort();
      }
      return route.continue();
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1000);

    const html = await page.content();
    await context.close();
    return html;
  } catch (error) {
    const message = error?.message?.includes("Cannot find module")
      ? "Playwright is not installed. Run: npm install && npx playwright install"
      : `Playwright failed to render ${url}`;
    throw new ScrapeError(message, 403, "playwright_failed");
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function fetchHtmlWithFallbacks(url) {
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

  const html = await renderWithPlaywright(url);
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

function buildCandidateUrls(baseUrl, paths) {
  const origin = new URL(baseUrl).origin;
  return paths.map((path) => `${origin}${path}`);
}

async function fetchFirstAvailable(urls) {
  const seen = new Set();
  let lastError = null;

  for (const url of urls) {
    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);

    try {
      const result = await fetchHtmlWithFallbacks(url);
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
  const baseUrl = normalizeUrl(inputUrl);
  let homepageHtml = "";
  let homepageError = null;

  try {
    const homepageResult = await fetchHtmlWithFallbacks(baseUrl);
    homepageHtml = homepageResult.html;
  } catch (error) {
    homepageError = error;
  }

  const homepageText = homepageHtml ? truncateText(extractText(homepageHtml)) : "";

  const $ = homepageHtml ? load(homepageHtml) : null;
  const links = $ ? collectLinks($, baseUrl) : [];

  const aboutUrl = pickBestLink(links, ABOUT_KEYWORDS);
  const productUrl = pickBestLink(links, PRODUCT_KEYWORDS);

  const aboutCandidates = [aboutUrl, ...buildCandidateUrls(baseUrl, ABOUT_PATHS)];
  const productCandidates = [productUrl, ...buildCandidateUrls(baseUrl, PRODUCT_PATHS)];

  const [aboutResult, productResult] = await Promise.all([
    fetchFirstAvailable(aboutCandidates),
    fetchFirstAvailable(productCandidates)
  ]);

  const aboutText = aboutResult.html ? truncateText(extractText(aboutResult.html)) : "";
  const productText = productResult.html ? truncateText(extractText(productResult.html)) : "";

  if (!homepageText && !aboutText && !productText) {
    const errors = [homepageError, aboutResult.error, productResult.error];
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

  const sources = [];
  if (homepageHtml) {
    sources.push(baseUrl);
  }
  if (aboutResult.url) {
    sources.push(aboutResult.url);
  }
  if (productResult.url) {
    sources.push(productResult.url);
  }

  return {
    homepageText,
    aboutText,
    productText,
    sources
  };
}
