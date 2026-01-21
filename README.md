# In English, Please

Translate a company website into kid-simple language. Scrapes the homepage, About page, and Product/Features page, then runs the text through an LLM to strip the fluff. Includes a chat box for follow-up questions and an MCP server for tool use.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` and paste a company URL.

If a site blocks scraping, the server will fall back to Playwright. Install browsers if needed:

```bash
npx playwright install
```

## Environment

- `OPENAI_PROVIDER` (optional, `openai` or `azure`; defaults to auto-detect)
- `OPENAI_API_KEY` (required for OpenAI)
- `OPENAI_MODEL` (optional, defaults to `gpt-4o-mini`)
- `NEXT_PUBLIC_REPO_URL` (optional, shows a repo link in the UI)

Azure OpenAI:
- `AZURE_OPENAI_ENDPOINT` (required, e.g. `https://your-resource.openai.azure.com`)
- `AZURE_OPENAI_API_KEY` (required)
- `AZURE_OPENAI_DEPLOYMENT` (required, your deployment name)
- `AZURE_OPENAI_API_VERSION` (optional, defaults to `2024-02-15-preview`)
- `AZURE_OPENAI_MODEL_NAME` (optional, base model name for cost tracking)
Aliases also work: `OPENAI_API_BASE`, `OPENAI_API_VERSION`, `OPENAI_DEPLOYMENT_NAME`.

Langfuse (optional):
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL` (optional, defaults to Langfuse cloud)
- `LANGFUSE_MODEL_NAME` (optional, use the base model name for cost tracking)

Token budget (per IP, optional):
- `TOKEN_BUDGET_MAX_TOKENS` (per window; set to 0 to disable)
- `TOKEN_BUDGET_WINDOW_MS` (defaults to 3600000)

Cache/share (Render Postgres):
- `DATABASE_URL` (Render internal or external URL)
- `CACHE_TTL_DAYS` (defaults to 7)

## MCP Server

Run the MCP server for tool access:

```bash
npm run mcp
```

Tool definition (matches the server):

```json
{
  "name": "get_company_truth",
  "description": "Scrapes a company website and returns the simple truth about what they do without marketing fluff.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "url": {
        "type": "string",
        "description": "The URL of the company website"
      }
    },
    "required": ["url"]
  }
}
```

An alias tool called `analyze_company` is also registered for compatibility with the prompt.
