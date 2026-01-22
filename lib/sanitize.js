const INJECTION_PATTERNS = [
  /ignore (all|any|previous) (instructions|prompts|messages)/i,
  /system prompt/i,
  /developer message/i,
  /you are (chatgpt|an ai|a large language model)/i,
  /act as /i,
  /do not (follow|obey)/i,
  /jailbreak/i,
  /prompt injection/i,
  /###\s*(system|instruction|prompt)/i,
  /\b(system|assistant|developer)\s*:/i
];

const CODE_BLOCK = /```[\s\S]*?```/g;

export function stripPromptInjections(text) {
  if (!text) {
    return "";
  }

  const withoutCode = text.replace(CODE_BLOCK, " ");
  const normalized = withoutCode.replace(/([.!?])\s+/g, "$1\n");
  const parts = normalized.split(/\n+/);
  const filtered = parts.filter(
    (part) => !INJECTION_PATTERNS.some((pattern) => pattern.test(part))
  );

  return filtered.join(" ").replace(/\s+/g, " ").trim();
}
