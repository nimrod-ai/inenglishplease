import { Langfuse } from "langfuse";

let cachedClient = null;
let cachedConfigKey = null;

function getConfig() {
  const publicKey =
    process.env.LANGFUSE_PUBLIC_KEY || process.env.LANGFUSE_PUBLIC_KEY_ID;
  const secretKey =
    process.env.LANGFUSE_SECRET_KEY || process.env.LANGFUSE_SECRET_KEY_ID;
  const baseUrl =
    process.env.LANGFUSE_BASE_URL ||
    process.env.LANGFUSE_BASEURL ||
    process.env.LANGFUSE_HOST;

  if (!publicKey || !secretKey) {
    return null;
  }

  return {
    publicKey,
    secretKey,
    baseUrl
  };
}

export function getLangfuse() {
  const config = getConfig();
  if (!config) {
    return null;
  }

  const configKey = `${config.publicKey}:${config.baseUrl || ""}`;
  if (cachedClient && cachedConfigKey === configKey) {
    return cachedClient;
  }

  cachedConfigKey = configKey;
  cachedClient = new Langfuse({
    publicKey: config.publicKey,
    secretKey: config.secretKey,
    baseUrl: config.baseUrl
  });

  return cachedClient;
}

export async function flushLangfuse(client) {
  if (!client) {
    return;
  }

  try {
    if (typeof client.flushAsync === "function") {
      await client.flushAsync();
      return;
    }

    if (typeof client.shutdownAsync === "function") {
      await client.shutdownAsync();
    }
  } catch (error) {
    // Avoid breaking responses if tracing fails.
  }
}
