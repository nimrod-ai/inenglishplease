import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { analyzeCompany } from "../lib/analyze.js";

const server = new McpServer({
  name: "they-dont-sell-gorillas",
  version: "0.1.0"
});

const inputSchema = {
  url: z.string().describe("The URL of the company website")
};

async function handleAnalyze({ url }) {
  const result = await analyzeCompany(url);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result.analysis)
      }
    ]
  };
}

server.tool(
  "get_company_truth",
  inputSchema,
  handleAnalyze
);

server.tool(
  "analyze_company",
  inputSchema,
  handleAnalyze
);

const transport = new StdioServerTransport();
await server.connect(transport);
