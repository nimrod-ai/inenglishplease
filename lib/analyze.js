import { scrapeSite } from "./scrape.js";
import { simplifyWithLLM } from "./llm.js";
import { flushLangfuse, getLangfuse } from "./langfuse.js";

export async function analyzeCompany(url) {
  const langfuse = getLangfuse();
  const trace = langfuse
    ? langfuse.trace({
        name: "analyze_company",
        input: { url }
      })
    : null;

  let scrapeSpan = null;
  let llmSpan = null;

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
      scraped.productText ? `Product/Features:\n${scraped.productText}` : ""
    ].filter(Boolean);

    const context = sections.join("\n\n").trim();
    if (!context) {
      throw new Error("No readable text found on the website.");
    }

    if (trace) {
      llmSpan = trace.span({
        name: "simplify_with_llm",
        input: { contextLength: context.length }
      });
    }

    const analysis = await simplifyWithLLM(context);

    if (llmSpan) {
      llmSpan.end({ output: analysis });
      llmSpan = null;
    }

    return {
      analysis,
      context,
      sources: scraped.sources
    };
  } catch (error) {
    if (llmSpan) {
      llmSpan.end({ output: { error: error.message } });
    }
    if (scrapeSpan) {
      scrapeSpan.end({ output: { error: error.message } });
    }
    throw error;
  } finally {
    await flushLangfuse(langfuse);
  }
}
