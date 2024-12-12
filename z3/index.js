#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { init } from "z3-solver";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Schema definition with refined constraints
const SolveFormulaSchema = z.object({
  formula: z.string().describe("SMT-LIB2 format logical formula")
});

// Tool registry configuration
const tools = [{
  name: "solve_formula",
  description: "Z3 theorem prover integration for SMT-LIB2 formulas",
  inputSchema: zodToJsonSchema(SolveFormulaSchema),
}];

/**
 * Extracts model information using Z3's sexpr representation
 * @param {Object} model - Z3 model object
 * @returns {string} Formatted model output
 */
function extractModelInfo(model) {
  // Get the string representation of the model
  const modelStr = model.sexpr();
  
  // Parse the model string to extract variable assignments
  const assignments = modelStr
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => line.trim())
    .join('\n');
    
  return assignments;
}

/**
 * Process SMT-LIB2 formula to extract variable declarations
 * @param {string} formula - Input formula
 * @returns {Object} Processed formula information
 */
function processFormula(formula) {
  // Check if formula contains explicit logic setting
  const hasLogic = formula.includes('set-logic');
  
  // Base configuration with logic declaration if needed
  const baseConfig = hasLogic ? '' : '(set-logic QF_LIA)\n';
  
  return {
    processedFormula: `${baseConfig}${formula}`,
    hasLogic
  };
}

/**
 * Enhanced Z3 solver handler with robust model extraction
 * @param {string} formula - SMT-LIB2 formula
 * @returns {Promise<Object>} Solver result with model or error
 */
async function handleSolveFormula(formula) {
  let Z3;
  try {
    // Initialize Z3 context
    Z3 = await init();
    const { Context } = Z3;
    
    // Create solver instance with configuration
    const ctx = new Context();
    const solver = new ctx.Solver();
    
    // Process formula and add configuration
    const { processedFormula } = processFormula(formula);
    
    // Configure solver and evaluate formula
    solver.fromString(processedFormula);
    const satResult = await solver.check();
    
    if (satResult === 'sat') {
      const model = solver.model();
      const modelOutput = extractModelInfo(model);
      
      return {
        content: [{
          type: "text",
          text: `SAT\nModel:\n${modelOutput}`
        }],
        isError: false
      };
    } else {
      return {
        content: [{
          type: "text",
          text: `Result: ${satResult}`
        }],
        isError: false
      };
    }
  } catch (error) {
    // Enhanced error reporting with context
    const errorDetails = error.message.includes('error "') 
      ? error.message.split('error "')[1].split('"')[0]
      : error.message;
      
    return {
      content: [{
        type: "text",
        text: `Solver error: ${errorDetails}\nDetails: ${error.stack}`
      }],
      isError: true
    };
  }
}

// MCP Server initialization with enhanced configuration
const server = new Server(
  {
    name: "z3-mcp-server",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Tool listing endpoint
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools
}));

// Tool execution endpoint with comprehensive error handling
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name: toolName, arguments: args } = request.params;
    
    if (toolName === "solve_formula") {
      const { formula } = SolveFormulaSchema.parse(args);
      return await handleSolveFormula(formula);
    }
    
    throw new Error(`Unsupported tool: ${toolName}`);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        content: [{
          type: "text",
          text: `Validation error: ${error.errors
            .map(e => `${e.path.join('.')}: ${e.message}`)
            .join(', ')}`
        }],
        isError: true
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `Runtime error: ${error.message}`
      }],
      isError: true
    };
  }
});

// Server bootstrap with enhanced error handling
async function runServer() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Z3 MCP Server: Initialized with enhanced model extraction");
  } catch (error) {
    console.error("Fatal initialization error:", error);
    process.exit(1);
  }
}

runServer();