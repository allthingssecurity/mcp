//!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();


const API_KEY = process.env.EXA_API_KEY;
if (!API_KEY) {
  throw new Error("EXA_API_KEY environment variable is required");
}

const API_CONFIG = {
  BASE_URL: 'https://api.exa.ai',
  ENDPOINTS: {
    SEARCH: '/search'
  },
  DEFAULT_NUM_RESULTS: 10,
  MAX_CACHED_SEARCHES: 5
};

class ExaServer {
  constructor() {
    this.server = new Server({
      name: "exa-search-server",
      version: "0.1.0"
    }, {
      capabilities: {
        resources: {},
        tools: {}
      }
    });

    this.axiosInstance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': API_KEY
      }
    });

    this.recentSearches = [];
    this.setupHandlers();
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupHandlers() {
    this.setupResourceHandlers();
    this.setupToolHandlers();
  }

  setupResourceHandlers() {
    this.server.setRequestHandler(
      ListResourcesRequestSchema,
      async () => ({
        resources: this.recentSearches.map((search, index) => ({
          uri: `exa://searches/${index}`,
          name: `Recent search: ${search.query}`,
          mimeType: "application/json",
          description: `Search results for: ${search.query} (${search.timestamp})`
        }))
      })
    );

    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const match = request.params.uri.match(/^exa:\/\/searches\/(\d+)$/);
        if (!match) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Unknown resource: ${request.params.uri}`
          );
        }

        const index = parseInt(match[1]);
        const search = this.recentSearches[index];

        if (!search) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Search result not found: ${index}`
          );
        }

        return {
          contents: [{
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify(search.response, null, 2)
          }]
        };
      }
    );
  }

  setupToolHandlers() {
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async () => ({
        tools: [{
          name: "search",
          description: "Search the web using Exa AI",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query"
              },
              numResults: {
                type: "number",
                description: "Number of results to return (default: 10)",
                minimum: 1,
                maximum: 50
              }
            },
            required: ["query"]
          }
        }]
      })
    );

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        if (request.params.name !== "search") {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
        }

        const args = request.params.arguments;
        if (!args || typeof args.query !== "string" || (args.numResults && typeof args.numResults !== "number")) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Invalid search arguments"
          );
        }

        try {
          const searchRequest = {
            query: args.query,
            type: "auto",
            numResults: args.numResults || API_CONFIG.DEFAULT_NUM_RESULTS,
            contents: {
              text: true
            }
          };

          const response = await this.axiosInstance.post(
            API_CONFIG.ENDPOINTS.SEARCH,
            searchRequest
          );

          this.recentSearches.unshift({
            query: searchRequest.query,
            response: response.data,
            timestamp: new Date().toISOString()
          });

          if (this.recentSearches.length > API_CONFIG.MAX_CACHED_SEARCHES) {
            this.recentSearches.pop();
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(response.data, null, 2)
            }]
          };
        } catch (error) {
          if (axios.isAxiosError(error)) {
            return {
              content: [{
                type: "text",
                text: `Exa API error: ${error.response?.data?.message ?? error.message}`
              }],
              isError: true,
            };
          }
          throw error;
        }
      }
    );
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Exa Search MCP server running on stdio");
  }
}

const server = new ExaServer();
server.run().catch(console.error);
