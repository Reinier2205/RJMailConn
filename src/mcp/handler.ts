/**
 * MCP Handler - Model Context Protocol JSON-RPC 2.0 Server
 * 
 * Provides MCP tools over HTTP using JSON-RPC 2.0 transport.
 * Integrates with existing Worker authentication and functionality.
 */

import { Environment } from "../index";
import { BriefHandler } from "../api/brief";
import { AuthMiddleware } from "../api/auth-middleware";

/**
 * JSON-RPC 2.0 Request
 */
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: any;
}

/**
 * JSON-RPC 2.0 Success Response
 */
interface JsonRpcSuccessResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result: any;
}

/**
 * JSON-RPC 2.0 Error Response
 */
interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: any;
  };
}

type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

/**
 * MCP Tool Definition
 */
interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * JSON-RPC Error Codes
 */
const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

/**
 * MCP Handler Class
 */
export class McpHandler {
  private readonly env: Environment;
  private readonly authMiddleware: AuthMiddleware;
  private readonly serverInfo = {
    name: "morning-brief-connector",
    version: "1.0.0",
  };

  constructor(env: Environment) {
    this.env = env;
    this.authMiddleware = new AuthMiddleware(env);
  }

  /**
   * Handle MCP requests via JSON-RPC 2.0
   */
  async handleRequest(request: Request): Promise<Response> {
    // Only accept POST
    if (request.method !== "POST") {
      return this.createJsonRpcError(
        null,
        JSON_RPC_ERRORS.INVALID_REQUEST,
        "Only POST method is supported for MCP endpoint"
      );
    }

    // Validate authentication using existing middleware
    const authResult = await this.authMiddleware.validateBearerToken(request);
    if (!authResult.authenticated) {
      return this.createJsonRpcError(
        null,
        JSON_RPC_ERRORS.INVALID_REQUEST,
        "Authentication required",
        { error: authResult.error }
      );
    }

    // Parse JSON-RPC request
    let jsonRpcRequest: JsonRpcRequest;
    try {
      jsonRpcRequest = await request.json();
    } catch (error) {
      return this.createJsonRpcError(
        null,
        JSON_RPC_ERRORS.PARSE_ERROR,
        "Invalid JSON in request body"
      );
    }

    // Validate JSON-RPC 2.0 structure
    if (jsonRpcRequest.jsonrpc !== "2.0") {
      return this.createJsonRpcError(
        jsonRpcRequest.id ?? null,
        JSON_RPC_ERRORS.INVALID_REQUEST,
        "Invalid JSON-RPC version. Expected 2.0"
      );
    }

    if (typeof jsonRpcRequest.method !== "string") {
      return this.createJsonRpcError(
        jsonRpcRequest.id ?? null,
        JSON_RPC_ERRORS.INVALID_REQUEST,
        "Method must be a string"
      );
    }

    // Route to handler based on method
    try {
      const result = await this.handleMethod(
        jsonRpcRequest.method,
        jsonRpcRequest.params,
        jsonRpcRequest.id ?? null
      );
      
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      console.error("MCP handler error:", error);
      return this.createJsonRpcError(
        jsonRpcRequest.id ?? null,
        JSON_RPC_ERRORS.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Internal error"
      );
    }
  }

  /**
   * Route method to appropriate handler
   */
  private async handleMethod(
    method: string,
    params: any,
    id: string | number | null
  ): Promise<JsonRpcResponse> {
    switch (method) {
      case "initialize":
        return this.handleInitialize(id);

      case "tools/list":
        return this.handleToolsList(id);

      case "tools/call":
        return await this.handleToolsCall(params, id);

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: JSON_RPC_ERRORS.METHOD_NOT_FOUND,
            message: `Method not found: ${method}`,
          },
        };
    }
  }

  /**
   * Handle initialize method
   */
  private handleInitialize(id: string | number | null): JsonRpcSuccessResponse {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: this.serverInfo,
        capabilities: {
          tools: {},
        },
      },
    };
  }

  /**
   * Handle tools/list method
   */
  private handleToolsList(id: string | number | null): JsonRpcSuccessResponse {
    const tools: McpTool[] = [
      {
        name: "get_morning_brief",
        description: "Retrieve Reinier's current Morning Intelligence Brief, including email and calendar information.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];

    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools,
      },
    };
  }

  /**
   * Handle tools/call method
   */
  private async handleToolsCall(
    params: any,
    id: string | number | null
  ): Promise<JsonRpcResponse> {
    // Validate params
    if (!params || typeof params !== "object") {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: JSON_RPC_ERRORS.INVALID_PARAMS,
          message: "Invalid params: must be an object",
        },
      };
    }

    const { name } = params;

    if (typeof name !== "string") {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: JSON_RPC_ERRORS.INVALID_PARAMS,
          message: "Invalid params: name must be a string",
        },
      };
    }

    // Route to tool implementation
    switch (name) {
      case "get_morning_brief":
        return await this.callGetMorningBrief(id);

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: JSON_RPC_ERRORS.METHOD_NOT_FOUND,
            message: `Unknown tool: ${name}`,
          },
        };
    }
  }

  /**
   * Call get_morning_brief tool
   * 
   * Directly uses the existing BriefHandler to retrieve data.
   */
  private async callGetMorningBrief(
    id: string | number | null
  ): Promise<JsonRpcResponse> {
    try {
      const briefHandler = new BriefHandler(this.env);
      const briefResponse = await briefHandler.generateBrief();

      // Return in MCP tool response format
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(briefResponse, null, 2),
            },
          ],
        },
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: JSON_RPC_ERRORS.INTERNAL_ERROR,
          message: "Failed to generate morning brief",
          data: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
        },
      };
    }
  }

  /**
   * Create JSON-RPC error response
   */
  private createJsonRpcError(
    id: string | number | null,
    code: number,
    message: string,
    data?: any
  ): Response {
    const errorResponse: JsonRpcErrorResponse = {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        ...(data && { data }),
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 200, // JSON-RPC errors return 200 with error object
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
