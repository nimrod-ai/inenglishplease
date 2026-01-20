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

export function normalizeUrl(input) {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; GorillaScraper/1.0; +https://example.com)"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }

  return response.text();
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

export async function scrapeSite(inputUrl) {
  const baseUrl = normalizeUrl(inputUrl);
  const homepageHtml = await fetchHtml(baseUrl);
  const homepageText = truncateText(extractText(homepageHtml));

  const $ = load(homepageHtml);
  const links = collectLinks($, baseUrl);

  const aboutUrl = pickBestLink(links, ABOUT_KEYWORDS);
  const productUrl = pickBestLink(links, PRODUCT_KEYWORDS);

  const [aboutHtml, productHtml] = await Promise.all([
    aboutUrl ? fetchHtml(aboutUrl).catch(() => "") : "",
    productUrl ? fetchHtml(productUrl).catch(() => "") : ""
  ]);

  const aboutText = aboutHtml ? truncateText(extractText(aboutHtml)) : "";
  const productText = productHtml ? truncateText(extractText(productHtml)) : "";

  const sources = [baseUrl];
  if (aboutUrl) {
    sources.push(aboutUrl);
  }
  if (productUrl) {
    sources.push(productUrl);
  }

  return {
    homepageText,
    aboutText,
    productText,
    sources
  };
}
