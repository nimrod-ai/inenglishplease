import { scrapeSite } from "./scrape.js";
import { simplifyWithLLM } from "./llm.js";

export async function analyzeCompany(url) {
  const scraped = await scrapeSite(url);
  const sections = [
    scraped.homepageText ? `Homepage:\n${scraped.homepageText}` : "",
    scraped.aboutText ? `About:\n${scraped.aboutText}` : "",
    scraped.productText ? `Product/Features:\n${scraped.productText}` : ""
  ].filter(Boolean);

  const context = sections.join("\n\n").trim();
  if (!context) {
    throw new Error("No readable text found on the website.");
  }

  const analysis = await simplifyWithLLM(context);

  return {
    analysis,
    context,
    sources: scraped.sources
  };
}
