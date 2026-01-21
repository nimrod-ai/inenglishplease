import { scrapeSite } from "./scrape.js";
import { simplifyWithLLM } from "./llm.js";
import { flushLangfuse, getLangfuse } from "./langfuse.js";
import { consumeTokens, estimateTokensFromText, getTokenBudgetConfig } from "./token-limit.js";
import { getCachedResultForUrl, normalizeUrlKey, storeResult } from "./cache.js";

export async function analyzeCompany(url, options = {}) {
  const { userKey } = options;
  const urlKey = normalizeUrlKey(url);
  const cachedResult = await getCachedResultForUrl(url);
  if (cachedResult) {
    return {
      analysis: cachedResult.analysis,
      context: cachedResult.context,
      sources: cachedResult.sources || [],
      shareId: cachedResult.id,
      shareAvailable: true,
      shareReason: null,
      cached: true
    };
  }

  const langfuse = getLangfuse();
  const trace = langfuse
    ? langfuse.trace({
        name: "analyze_company",
        input: { url }
      })
    : null;

  let scrapeSpan = null;

  try {
    if (trace) {
      scrapeSpan = trace.span({
        name: "scrape_site",
        input: { url }
      });
    }

    const scraped = await scrapeSite(url);

    if (scrapeSpan) {
      scrapeSpan.end({
        output: { sources: scraped.sources }
      });
      scrapeSpan = null;
    }

    const sections = [
      scraped.homepageText ? `Homepage:\n${scraped.homepageText}` : "",
      scraped.aboutText ? `About:\n${scraped.aboutText}` : "",
      scraped.productText ? `Product/Features:\n${scraped.productText}` : "",
      scraped.useCasesText ? `Use cases:\n${scraped.useCasesText}` : ""
    ].filter(Boolean);

    const context = sections.join("\n\n").trim();
    if (!context) {
      throw new Error("No readable text found on the website.");
    }

    const tokenConfig = getTokenBudgetConfig();
    if (tokenConfig.enabled) {
      consumeTokens({
        key: userKey,
        tokens: estimateTokensFromText(context),
        maxTokens: tokenConfig.maxTokens,
        windowMs: tokenConfig.windowMs
      });
    }

    const analysis = await simplifyWithLLM(context, { trace });

    const storedResult = await storeResult({
      url,
      urlKey,
      analysis,
      context,
      sources: scraped.sources
    });

    const shareAvailable = Boolean(storedResult?.id);
    const shareReason = shareAvailable
      ? null
      : process.env.DATABASE_URL
        ? "Sharing isn't available right now."
        : "Sharing isn't set up yet.";

    return {
      analysis,
      context,
      sources: scraped.sources,
      shareId: storedResult?.id || null,
      shareAvailable,
      shareReason,
      cached: false
    };
  } catch (error) {
    if (scrapeSpan) {
      scrapeSpan.end({ output: { error: error.message } });
    }
    throw error;
  } finally {
    await flushLangfuse(langfuse);
  }
}
