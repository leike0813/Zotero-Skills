import { createWorkflowHostApi } from "../workflows/hostApi";
import {
  ZoteroCollectionNotFoundError,
  ZoteroItemNotFoundError,
  ZoteroNoteNotFoundError,
} from "./zoteroHostCapabilityBroker";
import type { WorkflowHostApi } from "../workflows/types";
import type { AcpHostContext } from "./acpTypes";
import type {
  ZoteroHostAttachmentDto,
  ZoteroHostCollectionRefInput,
  ZoteroHostItemRefInput,
  ZoteroHostLibraryListArgs,
  ZoteroHostMutationPreviewResponse,
  ZoteroHostMutationRequest,
  ZoteroHostNoteDetailArgs,
} from "./zoteroHostCapabilityBroker";

export const ZOTERO_MCP_PROTOCOL_VERSION = "2025-06-18";
export const ZOTERO_MCP_TOOL_GET_CURRENT_VIEW = "get_current_view";
export const ZOTERO_MCP_TOOL_GET_SELECTED_ITEMS = "get_selected_items";
export const ZOTERO_MCP_TOOL_SEARCH_ITEMS = "search_items";
export const ZOTERO_MCP_TOOL_LIST_LIBRARY_ITEMS = "list_library_items";
export const ZOTERO_MCP_TOOL_GET_ITEM_DETAIL = "get_item_detail";
export const ZOTERO_MCP_TOOL_GET_ITEM_NOTES = "get_item_notes";
export const ZOTERO_MCP_TOOL_GET_NOTE_DETAIL = "get_note_detail";
export const ZOTERO_MCP_TOOL_GET_ITEM_ATTACHMENTS =
  "get_item_attachments";
export const ZOTERO_MCP_TOOL_GET_MCP_STATUS = "get_mcp_status";
export const ZOTERO_MCP_TOOL_PREVIEW_MUTATION = "preview_mutation";
export const ZOTERO_MCP_TOOL_UPDATE_ITEM_FIELDS = "update_item_fields";
export const ZOTERO_MCP_TOOL_ADD_ITEM_TAGS = "add_item_tags";
export const ZOTERO_MCP_TOOL_REMOVE_ITEM_TAGS = "remove_item_tags";
export const ZOTERO_MCP_TOOL_CREATE_CHILD_NOTE = "create_child_note";
export const ZOTERO_MCP_TOOL_UPDATE_NOTE = "update_note";
export const ZOTERO_MCP_TOOL_ADD_ITEMS_TO_COLLECTION =
  "add_items_to_collection";
export const ZOTERO_MCP_TOOL_REMOVE_ITEMS_FROM_COLLECTION =
  "remove_items_from_collection";

export type ZoteroMcpJsonRpcId = string | number | null;

export type ZoteroMcpJsonRpcRequest = {
  jsonrpc: "2.0";
  id?: ZoteroMcpJsonRpcId;
  method: string;
  params?: unknown;
};

export type ZoteroMcpJsonRpcResponse =
  | {
      jsonrpc: "2.0";
      id: ZoteroMcpJsonRpcId;
      result: unknown;
    }
  | {
      jsonrpc: "2.0";
      id: ZoteroMcpJsonRpcId;
      error: {
        code: number;
        message: string;
        data?: unknown;
      };
    };
export type ZoteroMcpJsonRpcResult =
  | ZoteroMcpJsonRpcResponse
  | ZoteroMcpJsonRpcResponse[]
  | null;

export type ZoteroMcpToolCallEvent = {
  toolName: string;
  arguments: Record<string, unknown>;
  hostContext?: AcpHostContext;
  result?: unknown;
  error?: {
    name: string;
    message: string;
  };
};

export type ZoteroMcpToolPermissionDecision =
  | boolean
  | {
      outcome: "approved" | "denied" | "unavailable";
      reason?: string;
    };

export type ZoteroMcpToolPermissionRequest = {
  toolName: string;
  mutation: ZoteroHostMutationRequest;
  preview: ZoteroHostMutationPreviewResponse;
  summary: string;
  requestedAt: string;
};

export type ZoteroMcpHandlerOptions = {
  resolveHostContext?: () => AcpHostContext;
  resolveHostApi?: () => WorkflowHostApi;
  resolveMcpStatus?: () => Record<string, unknown>;
  requestToolPermission?: (
    request: ZoteroMcpToolPermissionRequest,
  ) => Promise<ZoteroMcpToolPermissionDecision> | ZoteroMcpToolPermissionDecision;
  onToolCall?: (event: ZoteroMcpToolCallEvent) => void | Promise<void>;
};

type JsonObjectSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: boolean;
};

type ToolContext = {
  options: ZoteroMcpHandlerOptions;
  hostApi: WorkflowHostApi;
};

type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonObjectSchema;
  handler: (
    args: Record<string, unknown>,
    context: ToolContext,
  ) => Promise<ZoteroMcpToolResult> | ZoteroMcpToolResult;
};

type ZoteroMcpToolResult = {
  content: Array<{
    type: "text";
    text: string;
  }>;
  structuredContent: Record<string, unknown>;
};

class ZoteroMcpToolInputError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message);
    this.name = "ZoteroMcpToolInputError";
  }
}

function jsonRpcError(
  id: ZoteroMcpJsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): ZoteroMcpJsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      data,
    },
  };
}

function normalizeRequest(value: unknown): ZoteroMcpJsonRpcRequest | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const request = value as Partial<ZoteroMcpJsonRpcRequest>;
  if (request.jsonrpc !== "2.0" || !String(request.method || "").trim()) {
    return null;
  }
  return {
    jsonrpc: "2.0",
    id: request.id === undefined ? null : request.id,
    method: String(request.method || "").trim(),
    params: request.params,
  };
}

function isNotification(request: ZoteroMcpJsonRpcRequest) {
  return request.id === undefined || request.id === null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseJsonObjectString(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }
  const text = value.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) {
    return value;
  }
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

function normalizeRefInput<T>(value: T): T {
  return parseJsonObjectString(value) as T;
}

function objectSchema(
  properties: Record<string, unknown> = {},
  required: string[] = [],
): JsonObjectSchema {
  const schema: JsonObjectSchema = {
    type: "object",
    properties,
    additionalProperties: false,
  };
  if (required.length > 0) {
    schema.required = required;
  }
  return schema;
}

const itemRefProperties = {
  ref: {
    description:
      'Item reference. Prefer {"key":"ABCD1234","libraryId":1} or {"id":123}.',
  },
  id: {
    type: ["number", "string"],
    description: "Zotero item id. Use either id or key/libraryId.",
  },
  key: {
    type: "string",
    description: "Zotero item key, usually with libraryId.",
  },
  libraryId: {
    type: ["number", "string"],
    description: "Zotero library id for key-based refs.",
  },
};

function resolveHostApi(options: ZoteroMcpHandlerOptions) {
  return options.resolveHostApi?.() || createWorkflowHostApi();
}

function summarizeCurrentView(context: AcpHostContext) {
  const parts = [
    `target=${context.target}`,
    context.libraryId ? `libraryId=${context.libraryId}` : "",
    context.selectionEmpty ? "selection=empty" : "selection=present",
    context.currentItem?.key ? `itemKey=${context.currentItem.key}` : "",
    context.currentItem?.title ? `title=${context.currentItem.title}` : "",
  ].filter(Boolean);
  return parts.join("; ");
}

function buildToolResult(args: {
  tool: string;
  summary: string;
  structuredContent: Record<string, unknown>;
}) {
  return {
    content: [
      {
        type: "text" as const,
        text: args.summary || "No Zotero data is available.",
      },
    ],
    structuredContent: {
      tool: args.tool,
      summary: args.summary,
      ...args.structuredContent,
    },
  };
}

function resolveToolName(params: unknown) {
  if (!params || typeof params !== "object") {
    return "";
  }
  return String((params as { name?: unknown }).name || "").trim();
}

function resolveToolArguments(params: unknown) {
  if (!params || typeof params !== "object") {
    return {};
  }
  const args = (params as { arguments?: unknown }).arguments;
  return isPlainObject(args) ? args : {};
}

function resolveProtocolVersion(params: unknown) {
  if (!params || typeof params !== "object") {
    return ZOTERO_MCP_PROTOCOL_VERSION;
  }
  const requestedVersion = String(
    (params as { protocolVersion?: unknown }).protocolVersion || "",
  ).trim();
  return requestedVersion || ZOTERO_MCP_PROTOCOL_VERSION;
}

function resolveCurrentViewContext(context: ToolContext) {
  return (
    context.options.resolveHostContext?.() ||
    (context.hostApi.context.getCurrentView() as AcpHostContext)
  );
}

function resolveItemRef(args: Record<string, unknown>): ZoteroHostItemRefInput {
  if (args.ref !== undefined && args.ref !== null) {
    return normalizeRefInput(args.ref) as ZoteroHostItemRefInput;
  }
  const item = normalizeRefInput(args.item);
  if (isPlainObject(item)) {
    return item as ZoteroHostItemRefInput;
  }
  const target = normalizeRefInput(args.target);
  if (isPlainObject(target)) {
    return target as ZoteroHostItemRefInput;
  }
  const ref: Record<string, unknown> = {};
  for (const key of ["id", "key", "libraryId", "libraryID"]) {
    if (args[key] !== undefined && args[key] !== null && args[key] !== "") {
      ref[key] = args[key];
    }
  }
  if (Object.keys(ref).length > 0) {
    return ref as ZoteroHostItemRefInput;
  }
  throw new ZoteroMcpToolInputError("item reference is required");
}

function resolveItemRefs(args: Record<string, unknown>): ZoteroHostItemRefInput[] {
  const raw = normalizeRefInput(
    args.items || args.targets || args.target || args.item || args.ref,
  );
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (values.length > 0) {
    return values.map((value) => normalizeRefInput(value)) as ZoteroHostItemRefInput[];
  }
  return [resolveItemRef(args)];
}

function resolveCollectionRef(
  args: Record<string, unknown>,
): ZoteroHostCollectionRefInput {
  if (args.collection !== undefined) {
    return normalizeRefInput(args.collection) as ZoteroHostCollectionRefInput;
  }
  const ref: Record<string, unknown> = {};
  if (args.collectionId !== undefined) {
    ref.id = args.collectionId;
  }
  if (args.collectionKey !== undefined) {
    ref.key = args.collectionKey;
  }
  if (args.collectionLibraryId !== undefined) {
    ref.libraryId = args.collectionLibraryId;
  }
  if (Object.keys(ref).length > 0) {
    return ref as ZoteroHostCollectionRefInput;
  }
  throw new ZoteroMcpToolInputError("collection reference is required");
}

function buildLibraryListArgs(args: Record<string, unknown>): ZoteroHostLibraryListArgs {
  return {
    libraryId: args.libraryId as number | string | undefined,
    collection: args.collection as ZoteroHostCollectionRefInput | undefined,
    collectionId: args.collectionId as number | string | undefined,
    collectionKey: args.collectionKey as string | undefined,
    collectionLibraryId: args.collectionLibraryId as number | string | undefined,
    tag: args.tag as string | undefined,
    itemType: args.itemType as string | undefined,
    query: args.query as string | undefined,
    limit: args.limit as number | string | undefined,
    cursor: args.cursor as number | string | undefined,
  };
}

function buildNoteDetailArgs(args: Record<string, unknown>): ZoteroHostNoteDetailArgs {
  return {
    format: args.format as string | undefined,
    offset: args.offset as number | string | undefined,
    maxChars: args.maxChars as number | string | undefined,
  };
}

function buildWriteVerificationHint(toolName: string) {
  return [
    "If the client reports fetch failed after this write, the Zotero server may still have executed it.",
    `Verify with ${ZOTERO_MCP_TOOL_GET_ITEM_DETAIL} for item refs or ${ZOTERO_MCP_TOOL_LIST_LIBRARY_ITEMS} for library/collection summaries before retrying ${toolName}.`,
  ].join(" ");
}

function requirePlainObject(value: unknown, label: string) {
  if (!isPlainObject(value)) {
    throw new ZoteroMcpToolInputError(`${label} must be an object`);
  }
  return value;
}

function requireArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ZoteroMcpToolInputError(`${label} must be a non-empty array`);
  }
  return value;
}

function buildAttachmentAccess(attachment: ZoteroHostAttachmentDto) {
  const path = String(attachment.path || "").trim();
  const filename =
    String(attachment.filename || "").trim() ||
    path.split(/[\\/]/).filter(Boolean).pop() ||
    "";
  return {
    mode: path ? "local-path" : "unavailable",
    path: path || undefined,
    url: undefined,
    filename,
    contentType: attachment.contentType || "",
    size: undefined,
    sha256: undefined,
    locality: path ? "same-host" : "remote",
  };
}

function withAttachmentAccess(attachment: ZoteroHostAttachmentDto) {
  return {
    ...attachment,
    access: buildAttachmentAccess(attachment),
  };
}

function buildMutationRequest(
  toolName: string,
  args: Record<string, unknown>,
): ZoteroHostMutationRequest {
  if (toolName === ZOTERO_MCP_TOOL_PREVIEW_MUTATION) {
    if (isPlainObject(args.request)) {
      return args.request as ZoteroHostMutationRequest;
    }
    return args as ZoteroHostMutationRequest;
  }
  switch (toolName) {
    case ZOTERO_MCP_TOOL_UPDATE_ITEM_FIELDS:
      return {
        operation: "item.updateFields",
        target: resolveItemRef(args),
        fields: requirePlainObject(args.fields, "fields") as Record<
          string,
          string | number | boolean | null
        >,
      };
    case ZOTERO_MCP_TOOL_ADD_ITEM_TAGS:
      return {
        operation: "item.addTags",
        targets: resolveItemRefs(args),
        tags: requireArray(args.tags, "tags").map((entry) => String(entry)),
      };
    case ZOTERO_MCP_TOOL_REMOVE_ITEM_TAGS:
      return {
        operation: "item.removeTags",
        targets: resolveItemRefs(args),
        tags: requireArray(args.tags, "tags").map((entry) => String(entry)),
      };
    case ZOTERO_MCP_TOOL_CREATE_CHILD_NOTE:
      return {
        operation: "note.createChild",
        parent: args.parent || args.target || resolveItemRef(args),
        content: String(args.content || ""),
      };
    case ZOTERO_MCP_TOOL_UPDATE_NOTE:
      return {
        operation: "note.update",
        note: args.note || args.target || resolveItemRef(args),
        content: String(args.content || ""),
      };
    case ZOTERO_MCP_TOOL_ADD_ITEMS_TO_COLLECTION:
      return {
        operation: "collection.addItems",
        items: resolveItemRefs(args),
        collection: resolveCollectionRef(args),
      };
    case ZOTERO_MCP_TOOL_REMOVE_ITEMS_FROM_COLLECTION:
      return {
        operation: "collection.removeItems",
        items: resolveItemRefs(args),
        collection: resolveCollectionRef(args),
      };
    default:
      throw new ZoteroMcpToolInputError(`Unsupported mutation tool: ${toolName}`);
  }
}

function normalizePermissionDecision(
  value: ZoteroMcpToolPermissionDecision | undefined,
) {
  if (value === true) {
    return {
      outcome: "approved" as const,
      reason: "",
    };
  }
  if (value === false || !value) {
    return {
      outcome: "denied" as const,
      reason: "",
    };
  }
  return {
    outcome: value.outcome,
    reason: String(value.reason || "").trim(),
  };
}

async function previewMutationTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolContext,
) {
  const mutation = buildMutationRequest(toolName, args);
  const preview = await context.hostApi.mutations.preview(mutation);
  return buildToolResult({
    tool: toolName,
    summary: preview.summary || (preview.ok ? "Mutation preview ready." : "Mutation preview failed."),
    structuredContent: {
      mutation,
      preview,
      executed: false,
    },
  });
}

async function executeMutationTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolContext,
) {
  const mutation = buildMutationRequest(toolName, args);
  const preview = await context.hostApi.mutations.preview(mutation);
  if (!preview.ok) {
    return buildToolResult({
      tool: toolName,
      summary: preview.error.message,
      structuredContent: {
        mutation,
        preview,
        executed: false,
        permission: {
          outcome: "not_requested",
          reason: "preview_failed",
        },
      },
    });
  }
  if (!context.options.requestToolPermission) {
    return buildToolResult({
      tool: toolName,
      summary: "Zotero write permission is unavailable; mutation was not executed.",
      structuredContent: {
        mutation,
        preview,
        executed: false,
        permission: {
          outcome: "unavailable",
          reason: "permission_hook_missing",
        },
      },
    });
  }
  const permission = normalizePermissionDecision(
    await context.options.requestToolPermission({
      toolName,
      mutation,
      preview,
      summary: preview.summary,
      requestedAt: new Date().toISOString(),
    }),
  );
  if (permission.outcome !== "approved") {
    return buildToolResult({
      tool: toolName,
      summary: "Zotero write permission was not approved; mutation was not executed.",
      structuredContent: {
        mutation,
        preview,
        executed: false,
        permission,
      },
    });
  }
  const execution = await context.hostApi.mutations.execute(mutation);
  const verificationHint = buildWriteVerificationHint(toolName);
  return buildToolResult({
    tool: toolName,
    summary: execution.summary || "Zotero mutation executed.",
    structuredContent: {
      mutation,
      preview,
      executed: execution.ok,
      permission,
      execution,
      verificationHint,
    },
  });
}

const TOOL_REGISTRY: ToolDefinition[] = [
  {
    name: ZOTERO_MCP_TOOL_GET_CURRENT_VIEW,
    title: "Get current Zotero view",
    description:
      "Return the active Zotero target, library id, selection state, and current item metadata.",
    inputSchema: objectSchema(),
    handler: (_args, context) => {
      const hostContext = resolveCurrentViewContext(context);
      const summary = summarizeCurrentView(hostContext);
      return buildToolResult({
        tool: ZOTERO_MCP_TOOL_GET_CURRENT_VIEW,
        summary,
        structuredContent: {
          hostContext,
        },
      });
    },
  },
  {
    name: ZOTERO_MCP_TOOL_GET_SELECTED_ITEMS,
    title: "Get selected Zotero items",
    description: "Return JSON-safe summaries for the currently selected Zotero items.",
    inputSchema: objectSchema(),
    handler: (_args, context) => {
      const items = context.hostApi.context.getSelectedItems();
      return buildToolResult({
        tool: ZOTERO_MCP_TOOL_GET_SELECTED_ITEMS,
        summary: `Selected Zotero items: ${items.length}.`,
        structuredContent: {
          items,
        },
      });
    },
  },
  {
    name: ZOTERO_MCP_TOOL_SEARCH_ITEMS,
    title: "Search Zotero items",
    description:
      "Search regular Zotero library items by bounded text query. Required: query. Optional: limit <= 50, libraryId.",
    inputSchema: objectSchema(
      {
        query: {
          type: "string",
        },
        limit: {
          type: "number",
        },
        libraryId: {
          type: ["number", "string"],
        },
      },
      ["query"],
    ),
    handler: async (args, context) => {
      const query = String(args.query || "").trim();
      if (!query) {
        throw new ZoteroMcpToolInputError("query is required");
      }
      const items = await context.hostApi.library.searchItems({
        query,
        limit: args.limit === undefined ? undefined : Number(args.limit),
        libraryId: args.libraryId as string | number | undefined,
      });
      return buildToolResult({
        tool: ZOTERO_MCP_TOOL_SEARCH_ITEMS,
        summary: `Found ${items.length} Zotero item(s).`,
        structuredContent: {
          query,
          items,
        },
      });
    },
  },
  {
    name: ZOTERO_MCP_TOOL_LIST_LIBRARY_ITEMS,
    title: "List Zotero library items",
    description:
      "Preferred bounded index tool for collecting parent item keys from a library or collection. Returns paged summaries only; do not scan the library with concurrent search/detail calls. Optional filters: libraryId, collection/ref, collectionId, collectionKey, tag, itemType, query, limit <= 200, cursor.",
    inputSchema: objectSchema({
      libraryId: {
        type: ["number", "string"],
      },
      collection: {
        description: "Collection reference object/string/id.",
      },
      collectionId: {
        type: ["number", "string"],
      },
      collectionKey: {
        type: "string",
      },
      collectionLibraryId: {
        type: ["number", "string"],
      },
      tag: {
        type: "string",
      },
      itemType: {
        type: "string",
      },
      query: {
        type: "string",
      },
      limit: {
        type: ["number", "string"],
      },
      cursor: {
        type: ["number", "string"],
      },
    }),
    handler: async (args, context) => {
      const result = await context.hostApi.library.listItems(
        buildLibraryListArgs(args),
      );
      return buildToolResult({
        tool: ZOTERO_MCP_TOOL_LIST_LIBRARY_ITEMS,
        summary: `Listed ${result.returned} Zotero parent item(s).`,
        structuredContent: result,
      });
    },
  },
  {
    name: ZOTERO_MCP_TOOL_GET_ITEM_DETAIL,
    title: "Get Zotero item detail",
    description:
      'Return detailed JSON-safe metadata for one Zotero item. Prefer arguments {"key":"ITEMKEY","libraryId":1} or {"id":123}.',
    inputSchema: objectSchema(itemRefProperties),
    handler: async (args, context) => {
      const ref = resolveItemRef(args);
      const item = await context.hostApi.library.getItemDetail(ref);
      return buildToolResult({
        tool: ZOTERO_MCP_TOOL_GET_ITEM_DETAIL,
        summary: item ? `Item detail: ${item.title || item.key}.` : "Item not found.",
        structuredContent: {
          ref,
          item,
        },
      });
    },
  },
  {
    name: ZOTERO_MCP_TOOL_GET_ITEM_NOTES,
    title: "Get Zotero item notes",
    description:
      'Return bounded child note summaries/excerpts for one Zotero item. This does not return full note HTML; use get_note_detail on the zotero MCP service serially for a specific note body. Prefer {"key":"ITEMKEY","libraryId":1}. Optional: limit, cursor, maxExcerptChars.',
    inputSchema: objectSchema({
      ...itemRefProperties,
      limit: {
        type: ["number", "string"],
      },
      cursor: {
        type: ["number", "string"],
      },
      maxExcerptChars: {
        type: ["number", "string"],
      },
    }),
    handler: async (args, context) => {
      const ref = resolveItemRef(args);
      const notes = await context.hostApi.library.getItemNotes(ref, {
        limit: args.limit as number | string | undefined,
        cursor: args.cursor as number | string | undefined,
        maxExcerptChars: args.maxExcerptChars as number | string | undefined,
      });
      return buildToolResult({
        tool: ZOTERO_MCP_TOOL_GET_ITEM_NOTES,
        summary: `Found ${notes.length} Zotero note summary item(s).`,
        structuredContent: {
          ref,
          notes,
        },
      });
    },
  },
  {
    name: ZOTERO_MCP_TOOL_GET_NOTE_DETAIL,
    title: "Get Zotero note detail chunk",
    description:
      'Read one Zotero note body in bounded chunks. Prefer note ref {"key":"NOTEKEY","libraryId":1}. Defaults to text format; use offset/nextOffset and maxChars <= 16000 serially for large notes. Do not request chunks concurrently.',
    inputSchema: objectSchema({
      ...itemRefProperties,
      format: {
        type: "string",
        enum: ["text", "html"],
      },
      offset: {
        type: ["number", "string"],
      },
      maxChars: {
        type: ["number", "string"],
      },
    }),
    handler: async (args, context) => {
      const ref = resolveItemRef(args);
      const note = await context.hostApi.library.getNoteDetail(
        ref,
        buildNoteDetailArgs(args),
      );
      return buildToolResult({
        tool: ZOTERO_MCP_TOOL_GET_NOTE_DETAIL,
        summary: `Read Zotero note chunk ${note.offset}-${note.nextOffset} of ${note.totalChars}.`,
        structuredContent: {
          ref,
          note,
        },
      });
    },
  },
  {
    name: ZOTERO_MCP_TOOL_GET_ITEM_ATTACHMENTS,
    title: "Get Zotero item attachments",
    description:
      "Return child attachments and remote-compatible access metadata without file contents. Local files are returned as access manifests, not file bytes.",
    inputSchema: objectSchema(itemRefProperties),
    handler: async (args, context) => {
      const ref = resolveItemRef(args);
      const attachments = (
        await context.hostApi.library.getItemAttachments(ref)
      ).map(withAttachmentAccess);
      return buildToolResult({
        tool: ZOTERO_MCP_TOOL_GET_ITEM_ATTACHMENTS,
        summary: `Found ${attachments.length} Zotero attachment(s).`,
        structuredContent: {
          ref,
          attachments,
        },
      });
    },
  },
  {
    name: ZOTERO_MCP_TOOL_GET_MCP_STATUS,
    title: "Get Zotero MCP server status",
    description:
      "Return safe diagnostics for the embedded Zotero MCP server, including queue state, guard state, circuit breakers, and recent request summaries. This diagnostic tool does not enter the Zotero host call queue.",
    inputSchema: objectSchema(),
    handler: (_args, context) => {
      const status = context.options.resolveMcpStatus?.() || {};
      return buildToolResult({
        tool: ZOTERO_MCP_TOOL_GET_MCP_STATUS,
        summary: "Zotero MCP status snapshot.",
        structuredContent: {
          status,
        },
      });
    },
  },
  {
    name: ZOTERO_MCP_TOOL_PREVIEW_MUTATION,
    title: "Preview Zotero mutation",
    description:
      'Validate and summarize a supported Zotero write request without writing. Use request.operation such as "item.addTags", not a free-form type field.',
    inputSchema: objectSchema({
      request: {
        type: "object",
      },
    }),
    handler: (args, context) =>
      previewMutationTool(ZOTERO_MCP_TOOL_PREVIEW_MUTATION, args, context),
  },
  {
    name: ZOTERO_MCP_TOOL_UPDATE_ITEM_FIELDS,
    title: "Update Zotero item fields",
    description:
      'Permission-gated update of allowed fields on one Zotero item. Required: item ref plus fields object, e.g. {"key":"ITEMKEY","libraryId":1,"fields":{"title":"New title"}}.',
    inputSchema: objectSchema({
      ...itemRefProperties,
      fields: {
        type: "object",
      },
    }, ["fields"]),
    handler: (args, context) =>
      executeMutationTool(ZOTERO_MCP_TOOL_UPDATE_ITEM_FIELDS, args, context),
  },
  {
    name: ZOTERO_MCP_TOOL_ADD_ITEM_TAGS,
    title: "Add Zotero item tags",
    description:
      'Permission-gated tag addition for one or more Zotero items. Required: tags plus either items array or a single item ref.',
    inputSchema: objectSchema({
      ...itemRefProperties,
      items: {
        type: "array",
      },
      tags: {
        type: "array",
        items: {
          type: "string",
        },
      },
    }, ["tags"]),
    handler: (args, context) =>
      executeMutationTool(ZOTERO_MCP_TOOL_ADD_ITEM_TAGS, args, context),
  },
  {
    name: ZOTERO_MCP_TOOL_REMOVE_ITEM_TAGS,
    title: "Remove Zotero item tags",
    description:
      'Permission-gated tag removal for one or more Zotero items. Required: tags plus either items array or a single item ref.',
    inputSchema: objectSchema({
      ...itemRefProperties,
      items: {
        type: "array",
      },
      tags: {
        type: "array",
        items: {
          type: "string",
        },
      },
    }, ["tags"]),
    handler: (args, context) =>
      executeMutationTool(ZOTERO_MCP_TOOL_REMOVE_ITEM_TAGS, args, context),
  },
  {
    name: ZOTERO_MCP_TOOL_CREATE_CHILD_NOTE,
    title: "Create Zotero child note",
    description:
      'Permission-gated creation of a child note under one Zotero item. Required: parent item ref and non-empty content.',
    inputSchema: objectSchema({
      ...itemRefProperties,
      parent: {
        description: "Parent item reference.",
      },
      content: {
        type: "string",
      },
    }, ["content"]),
    handler: (args, context) =>
      executeMutationTool(ZOTERO_MCP_TOOL_CREATE_CHILD_NOTE, args, context),
  },
  {
    name: ZOTERO_MCP_TOOL_UPDATE_NOTE,
    title: "Update Zotero note",
    description:
      'Permission-gated update of a Zotero note body. Required: note ref or item ref identifying a note, plus non-empty content.',
    inputSchema: objectSchema({
      ...itemRefProperties,
      note: {
        description: "Note item reference.",
      },
      content: {
        type: "string",
      },
    }, ["content"]),
    handler: (args, context) =>
      executeMutationTool(ZOTERO_MCP_TOOL_UPDATE_NOTE, args, context),
  },
  {
    name: ZOTERO_MCP_TOOL_ADD_ITEMS_TO_COLLECTION,
    title: "Add Zotero items to collection",
    description:
      'Permission-gated collection membership addition. Required: items array and collection ref, e.g. {"items":[{"key":"ITEMKEY","libraryId":1}],"collection":{"key":"COLLKEY","libraryId":1}}.',
    inputSchema: objectSchema({
      items: {
        type: "array",
      },
      collection: {
        description: "Collection reference.",
      },
      collectionId: {
        type: ["number", "string"],
      },
      collectionKey: {
        type: "string",
      },
    }, ["items"]),
    handler: (args, context) =>
      executeMutationTool(ZOTERO_MCP_TOOL_ADD_ITEMS_TO_COLLECTION, args, context),
  },
  {
    name: ZOTERO_MCP_TOOL_REMOVE_ITEMS_FROM_COLLECTION,
    title: "Remove Zotero items from collection",
    description:
      'Permission-gated collection membership removal. Required: items array and collection ref.',
    inputSchema: objectSchema({
      items: {
        type: "array",
      },
      collection: {
        description: "Collection reference.",
      },
      collectionId: {
        type: ["number", "string"],
      },
      collectionKey: {
        type: "string",
      },
    }, ["items"]),
    handler: (args, context) =>
      executeMutationTool(
        ZOTERO_MCP_TOOL_REMOVE_ITEMS_FROM_COLLECTION,
        args,
        context,
      ),
  },
];

const TOOL_MAP = new Map(TOOL_REGISTRY.map((tool) => [tool.name, tool]));
const ZOTERO_MCP_QUEUE_NOTICE =
  " Zotero host calls are serialized by the embedded server; do not call zotero MCP tools concurrently. For library scans use list_library_items, and for large notes use get_note_detail chunks. After write tools, verify state with get_item_detail or list_library_items before retrying. If you receive zotero_mcp_queue_full, zotero_mcp_queue_timeout, zotero_mcp_tool_timeout, or zotero_mcp_tool_circuit_open, wait and retry later or call get_mcp_status.";

export function listZoteroMcpTools() {
  return TOOL_REGISTRY.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: `${tool.description}${ZOTERO_MCP_QUEUE_NOTICE}`,
    inputSchema: tool.inputSchema,
  }));
}

export async function handleZoteroMcpJsonRpc(
  payload: unknown,
  options: ZoteroMcpHandlerOptions = {},
): Promise<ZoteroMcpJsonRpcResult> {
  if (Array.isArray(payload)) {
    const responses: ZoteroMcpJsonRpcResponse[] = [];
    for (const entry of payload) {
      const response = await handleZoteroMcpJsonRpc(entry, options);
      if (Array.isArray(response)) {
        responses.push(...response);
      } else if (response) {
        responses.push(response);
      }
    }
    return responses.length > 0 ? responses : null;
  }
  const request = normalizeRequest(payload);
  if (!request) {
    return jsonRpcError(null, -32600, "Invalid JSON-RPC request");
  }
  switch (request.method) {
    case "notifications/initialized":
      return null;
    case "initialize":
      if (isNotification(request)) {
        return null;
      }
      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: {
          protocolVersion: resolveProtocolVersion(request.params),
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "zotero-skills",
            title: "Zotero Skills Context Broker",
            version: "0.4.0",
          },
        },
      };
    case "tools/list":
      if (isNotification(request)) {
        return null;
      }
      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: {
          tools: listZoteroMcpTools(),
        },
      };
    case "tools/call": {
      if (isNotification(request)) {
        return null;
      }
      const toolName = resolveToolName(request.params);
      const tool = TOOL_MAP.get(toolName);
      if (!tool) {
        return jsonRpcError(request.id ?? null, -32602, "Unknown Zotero MCP tool", {
          toolName,
        });
      }
      const toolArguments = resolveToolArguments(request.params);
      try {
        const hostApi = resolveHostApi(options);
        const result = await tool.handler(toolArguments, {
          options,
          hostApi,
        });
        await options.onToolCall?.({
          toolName,
          arguments: toolArguments,
          hostContext:
            toolName === ZOTERO_MCP_TOOL_GET_CURRENT_VIEW
              ? (result.structuredContent.hostContext as AcpHostContext)
              : undefined,
          result: result.structuredContent,
        });
        return {
          jsonrpc: "2.0",
          id: request.id ?? null,
          result,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error || "Tool failed");
        const isItemNotFound = error instanceof ZoteroItemNotFoundError;
        const isNoteNotFound = error instanceof ZoteroNoteNotFoundError;
        const isCollectionNotFound = error instanceof ZoteroCollectionNotFoundError;
        const structuredCode = isItemNotFound
          ? "zotero_item_not_found"
          : isNoteNotFound
            ? "zotero_note_not_found"
            : isCollectionNotFound
              ? "zotero_collection_not_found"
              : undefined;
        await options.onToolCall?.({
          toolName,
          arguments: toolArguments,
          error: {
            name: error instanceof Error ? error.name : "Error",
            message,
          },
        });
        return jsonRpcError(request.id ?? null, -32602, message, {
          code: structuredCode,
          toolName,
          errorName: structuredCode
            ? error instanceof Error
              ? error.name
              : "Error"
            : error instanceof Error
              ? error.name
              : "Error",
          details:
            error instanceof ZoteroMcpToolInputError
              ? error.details
              : structuredCode && error instanceof Error && "ref" in error
                ? (error as { ref?: unknown }).ref
                : undefined,
        });
      }
    }
    default:
      return jsonRpcError(request.id ?? null, -32601, "Method not found", {
        method: request.method,
      });
  }
}
