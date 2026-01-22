import OpenAI, { AzureOpenAI } from "openai";
import {
  CHAT_SYSTEM_PROMPT,
  JOB_CHAT_SYSTEM_PROMPT,
  JOB_SYSTEM_PROMPT,
  SYSTEM_PROMPT
} from "./prompts.js";
import { normalizeAnalysis, normalizeJobAnalysis, safeJsonParse } from "./json.js";
import { flushLangfuse, getLangfuse } from "./langfuse.js";
import { consumeTokens, estimateTokensFromText, getTokenBudgetConfig } from "./token-limit.js";

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

function getLangfuseModelName(model, provider) {
  if (process.env.LANGFUSE_MODEL_NAME) {
    return process.env.LANGFUSE_MODEL_NAME;
  }

  const normalized = provider || "";
  if (normalized === "azure" || normalized === "azure_openai" || normalized === "azure-openai") {
    return process.env.AZURE_OPENAI_MODEL_NAME || model;
  }

  return process.env.OPENAI_MODEL || model;
}

function mapUsage(usage) {
  if (!usage) {
    return undefined;
  }

  const promptTokens = usage.prompt_tokens ?? usage.promptTokens ?? null;
  const completionTokens = usage.completion_tokens ?? usage.completionTokens ?? null;
  const totalTokens = usage.total_tokens ?? usage.totalTokens ?? null;

  return {
    promptTokens,
    completionTokens,
    totalTokens
  };
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

export async function simplifyWithLLM(text, options = {}) {
  const provider = getProvider();
  const { client, model } = getClientConfig();
  const temperature = resolveTemperature(model, 0.2);
  const langfuseModel = getLangfuseModelName(model, provider);
  const trace = options.trace || null;
  const generation = trace
    ? trace.generation({
        name: "simplify_with_llm",
        model: langfuseModel,
        input: { contextLength: text.length },
        modelParameters: { temperature }
      })
    : null;
  let response;
  let generationEnded = false;

  try {
    response = await client.chat.completions.create({
      model,
      temperature,
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
      if (generation) {
        generation.end({
          output: { error: "LLM did not return valid JSON", raw: content },
          statusMessage: "LLM did not return valid JSON",
          usage: mapUsage(response.usage),
          model: langfuseModel,
          modelParameters: { temperature }
        });
        generationEnded = true;
      }
      throw new Error("LLM did not return valid JSON");
    }

    if (generation) {
      generation.end({
        output: parsed,
        usage: mapUsage(response.usage),
        model: langfuseModel,
        modelParameters: { temperature }
      });
      generationEnded = true;
    }

    return normalizeAnalysis(parsed);
  } catch (error) {
    if (generation && !generationEnded) {
      generation.end({
        output: { error: error.message },
        statusMessage: error.message,
        usage: mapUsage(response?.usage),
        model: langfuseModel,
        modelParameters: { temperature }
      });
    }
    throw error;
  }
}

export async function simplifyJobDescription(text, options = {}) {
  const provider = getProvider();
  const { client, model } = getClientConfig();
  const temperature = resolveTemperature(model, 0.2);
  const langfuseModel = getLangfuseModelName(model, provider);
  const trace = options.trace || null;
  const generation = trace
    ? trace.generation({
        name: "simplify_job_description",
        model: langfuseModel,
        input: { contextLength: text.length },
        modelParameters: { temperature }
      })
    : null;
  let response;
  let generationEnded = false;

  try {
    response = await client.chat.completions.create({
      model,
      temperature,
      messages: [
        { role: "system", content: JOB_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Job description:\n${text}\n\nReturn JSON only.`
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices?.[0]?.message?.content?.trim() || "";
    const parsed = safeJsonParse(content);
    if (!parsed) {
      if (generation) {
        generation.end({
          output: { error: "LLM did not return valid JSON", raw: content },
          statusMessage: "LLM did not return valid JSON",
          usage: mapUsage(response.usage),
          model: langfuseModel,
          modelParameters: { temperature }
        });
        generationEnded = true;
      }
      throw new Error("LLM did not return valid JSON");
    }

    if (generation) {
      generation.end({
        output: parsed,
        usage: mapUsage(response.usage),
        model: langfuseModel,
        modelParameters: { temperature }
      });
      generationEnded = true;
    }

    return normalizeJobAnalysis(parsed);
  } catch (error) {
    if (generation && !generationEnded) {
      generation.end({
        output: { error: error.message },
        statusMessage: error.message,
        usage: mapUsage(response?.usage),
        model: langfuseModel,
        modelParameters: { temperature }
      });
    }
    throw error;
  }
}

export async function answerFollowup({ question, context, analysis, userKey }) {
  const provider = getProvider();
  const { client, model } = getClientConfig();
  const temperature = resolveTemperature(model, 0.3);
  const langfuseModel = getLangfuseModelName(model, provider);
  const summary = analysis
    ? `Summary:\nProduct: ${analysis.product}\nBuyer: ${analysis.buyer}\nClaim: ${analysis.claim}\nFluff rating: ${analysis.fluff_rating}`
    : "";
  const prompt = `Context:\n${context}\n\n${summary}\n\nQuestion: ${question}\nAnswer in plain language.`;
  const tokenConfig = getTokenBudgetConfig();
  if (tokenConfig.enabled) {
    consumeTokens({
      key: userKey,
      tokens: estimateTokensFromText(prompt),
      maxTokens: tokenConfig.maxTokens,
      windowMs: tokenConfig.windowMs
    });
  }

  const langfuse = getLangfuse();
  const trace = langfuse
    ? langfuse.trace({
        name: "chat_followup",
        input: { question }
      })
    : null;
  const generation = trace
    ? trace.generation({
        name: "chat_completion",
        model: langfuseModel,
        input: {
          question,
          contextLength: context?.length || 0,
          hasSummary: Boolean(summary)
        },
        modelParameters: { temperature }
      })
    : null;

  try {
    const response = await client.chat.completions.create({
      model,
      temperature,
      messages: [
        { role: "system", content: CHAT_SYSTEM_PROMPT },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const answer =
      response.choices?.[0]?.message?.content?.trim() || "I don't know yet.";

    if (generation) {
      generation.end({
        output: { answer },
        usage: mapUsage(response.usage),
        model: langfuseModel,
        modelParameters: { temperature }
      });
    }

    return answer;
  } catch (error) {
    if (generation) {
      generation.end({
        output: { error: error.message },
        statusMessage: error.message,
        model: langfuseModel,
        modelParameters: { temperature }
      });
    }
    throw error;
  } finally {
    await flushLangfuse(langfuse);
  }
}

export async function answerJobFollowup({ question, context, analysis, userKey }) {
  const provider = getProvider();
  const { client, model } = getClientConfig();
  const temperature = resolveTemperature(model, 0.3);
  const langfuseModel = getLangfuseModelName(model, provider);
  const summary = analysis
    ? `Summary:\nCompany/team: ${analysis.company_team}\nYou will do: ${analysis.you_will_do}\nRequirements: ${analysis.requirements}\nFluff rating: ${analysis.fluff_rating}`
    : "";
  const prompt = `Context:\n${context}\n\n${summary}\n\nQuestion: ${question}\nAnswer in plain language.`;
  const tokenConfig = getTokenBudgetConfig();
  if (tokenConfig.enabled) {
    consumeTokens({
      key: userKey,
      tokens: estimateTokensFromText(prompt),
      maxTokens: tokenConfig.maxTokens,
      windowMs: tokenConfig.windowMs
    });
  }

  const langfuse = getLangfuse();
  const trace = langfuse
    ? langfuse.trace({
        name: "job_followup",
        input: { question }
      })
    : null;
  const generation = trace
    ? trace.generation({
        name: "job_chat_completion",
        model: langfuseModel,
        input: {
          question,
          contextLength: context?.length || 0,
          hasSummary: Boolean(summary)
        },
        modelParameters: { temperature }
      })
    : null;

  try {
    const response = await client.chat.completions.create({
      model,
      temperature,
      messages: [
        { role: "system", content: JOB_CHAT_SYSTEM_PROMPT },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const answer =
      response.choices?.[0]?.message?.content?.trim() || "I don't know yet.";

    if (generation) {
      generation.end({
        output: { answer },
        usage: mapUsage(response.usage),
        model: langfuseModel,
        modelParameters: { temperature }
      });
    }

    return answer;
  } catch (error) {
    if (generation) {
      generation.end({
        output: { error: error.message },
        statusMessage: error.message,
        model: langfuseModel,
        modelParameters: { temperature }
      });
    }
    throw error;
  } finally {
    await flushLangfuse(langfuse);
  }
}
