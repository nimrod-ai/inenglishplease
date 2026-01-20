# No Fluff Business

Translate a company website into kid-simple language. Scrapes the homepage, About page, and Product/Features page, then runs the text through an LLM to strip the fluff. Includes a chat box for follow-up questions and an MCP server for tool use.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` and paste a company URL.

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
Aliases also work: `OPENAI_API_BASE`, `OPENAI_API_VERSION`, `OPENAI_DEPLOYMENT_NAME`.

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
