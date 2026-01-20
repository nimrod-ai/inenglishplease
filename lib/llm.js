import OpenAI, { AzureOpenAI } from "openai";
import { CHAT_SYSTEM_PROMPT, SYSTEM_PROMPT } from "./prompts.js";
import { normalizeAnalysis, safeJsonParse } from "./json.js";
import { flushLangfuse, getLangfuse } from "./langfuse.js";

const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const DEFAULT_AZURE_API_VERSION =
  process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview";

const MODEL_TEMPERATURE_OVERRIDES = [
  { pattern: /gpt-5-mini/i, temperature: 1 }
];

function resolveTemperature(model, fallback) {
  if (!model) {
    return fallback;
  }

  for (const override of MODEL_TEMPERATURE_OVERRIDES) {
    if (override.pattern.test(model)) {
      return override.temperature;
    }
  }

  return fallback;
}

let cachedConfig = null;
let cachedProvider = null;

function getProvider() {
  const rawProvider =
    process.env.OPENAI_PROVIDER || process.env.LLM_PROVIDER || "";
  const normalized = rawProvider.trim().toLowerCase();
  if (normalized) {
    return normalized;
  }

  if (process.env.AZURE_OPENAI_ENDPOINT || process.env.AZURE_OPENAI_API_KEY) {
    return "azure";
  }

  return "openai";
}

function getClientConfig() {
  const provider = getProvider();
  if (cachedConfig && cachedProvider === provider) {
    return cachedConfig;
  }

  if (provider === "azure" || provider === "azure_openai" || provider === "azure-openai") {
    const apiKey =
      process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const endpoint =
      process.env.AZURE_OPENAI_ENDPOINT || process.env.OPENAI_API_BASE;
    const deployment =
      process.env.AZURE_OPENAI_DEPLOYMENT || process.env.OPENAI_DEPLOYMENT_NAME;
    const apiVersion =
      process.env.AZURE_OPENAI_API_VERSION ||
      process.env.OPENAI_API_VERSION ||
      DEFAULT_AZURE_API_VERSION;

    if (!apiKey || !endpoint || !deployment) {
      throw new Error(
        "Missing Azure OpenAI config: AZURE_OPENAI_ENDPOINT (or OPENAI_API_BASE), AZURE_OPENAI_API_KEY (or OPENAI_API_KEY), AZURE_OPENAI_DEPLOYMENT (or OPENAI_DEPLOYMENT_NAME)"
      );
    }

    cachedProvider = provider;
    cachedConfig = {
      client: new AzureOpenAI({
        apiKey,
        endpoint,
        apiVersion
      }),
      model: deployment
    };

    return cachedConfig;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  cachedProvider = provider;
  cachedConfig = {
    client: new OpenAI({ apiKey }),
    model: DEFAULT_OPENAI_MODEL
  };

  return cachedConfig;
}

export async function simplifyWithLLM(text) {
  const { client, model } = getClientConfig();
  const response = await client.chat.completions.create({
    model,
    temperature: resolveTemperature(model, 0.2),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Website text:\n${text}\n\nReturn JSON only.`
      }
    ],
    response_format: { type: "json_object" }
  });

  const content = response.choices?.[0]?.message?.content?.trim() || "";
  const parsed = safeJsonParse(content);
  if (!parsed) {
    throw new Error("LLM did not return valid JSON");
  }

  return normalizeAnalysis(parsed);
}

export async function answerFollowup({ question, context, analysis }) {
  const { client, model } = getClientConfig();
  const summary = analysis
    ? `Summary:\nProduct: ${analysis.product}\nBuyer: ${analysis.buyer}\nClaim: ${analysis.claim}\nFluff rating: ${analysis.fluff_rating}`
    : "";

  const langfuse = getLangfuse();
  const trace = langfuse
    ? langfuse.trace({
        name: "chat_followup",
        input: { question }
      })
    : null;
  let span = null;

  try {
    if (trace) {
      span = trace.span({
        name: "chat_completion",
        input: {
          model,
          contextLength: context?.length || 0,
          hasSummary: Boolean(summary)
        }
      });
    }

    const response = await client.chat.completions.create({
      model,
      temperature: resolveTemperature(model, 0.3),
      messages: [
        { role: "system", content: CHAT_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Context:\n${context}\n\n${summary}\n\nQuestion: ${question}\nAnswer in plain language.`
        }
      ]
    });

    const answer =
      response.choices?.[0]?.message?.content?.trim() || "I don't know yet.";

    if (span) {
      span.end({ output: { answer } });
      span = null;
    }

    return answer;
  } catch (error) {
    if (span) {
      span.end({ output: { error: error.message } });
    }
    throw error;
  } finally {
    await flushLangfuse(langfuse);
  }
}
