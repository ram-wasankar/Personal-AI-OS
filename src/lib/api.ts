export interface ApiUser {
  id: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  user: ApiUser;
}

export interface ApiNote {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface ApiDocument {
  id: string;
  userId: string;
  fileUrl: string;
  fileName: string;
  extractedText: string;
  status: "uploading" | "processing" | "ready" | "failed" | "indexed" | "pending";
  chunks: number;
  createdAt: string;
  sizeBytes: number;
}

export interface ApiSource {
  sourceId: string;
  sourceType: "note" | "document" | "memory";
  label: string;
  score: number;
  confidence?: number;
  semanticScore?: number;
  keywordScore?: number;
  excerpt: string;
}

export interface ApiChatResponse {
  answer: string;
  sources: ApiSource[];
  conversationId: string;
  memoryHits: number;
}

export interface ApiStreamTokenEvent {
  type: "token";
  content: string;
}

export interface ApiStreamDoneEvent {
  type: "done";
  conversation_id?: string;
  conversationId?: string;
  sources: ApiSource[];
  memory_hits?: number;
  memoryHits?: number;
}

export interface ApiMemory {
  id: string;
  userId: string;
  content: string;
  importanceScore: number;
  lastAccessed: string;
  memoryType: "interest" | "habit" | "preference" | "knowledge";
}

export interface ApiDashboardActivity {
  type: string;
  detail: string;
  time: string;
  accent: "primary" | "accent" | "warning" | "success";
}

export interface ApiTopicDistribution {
  name: string;
  count: number;
  pct: number;
}

export interface ApiDashboard {
  summary: Record<string, number>;
  insights: string[];
  recentActivity: ApiDashboardActivity[];
  topicDistribution: ApiTopicDistribution[];
  memoryConfidence: number;
}

class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const runtimeImportMeta = import.meta as ImportMeta & { env?: { VITE_API_URL?: string } };
const API_BASE_URL = runtimeImportMeta.env?.VITE_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "synapse_keeper_token";
const DEVICE_KEY = "synapse_keeper_device_id";

function buildUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

function getDeviceIdentity() {
  let deviceId = localStorage.getItem(DEVICE_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, deviceId);
  }

  const slug = deviceId.replace(/-/g, "").slice(0, 16);
  return {
    email: `device_${slug}@synapse.local`,
    password: `SynapseKeeper-${slug}`,
  };
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    if (typeof payload?.detail === "string") {
      return payload.detail;
    }
  } catch {
    // noop
  }
  return `Request failed with status ${response.status}`;
}

async function bootstrapAuthToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const existing = localStorage.getItem(TOKEN_KEY);
    if (existing) {
      return existing;
    }
  }

  const { email, password } = getDeviceIdentity();

  await fetch(buildUrl("/api/auth/signup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const loginResponse = await fetch(buildUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!loginResponse.ok) {
    throw new ApiRequestError(loginResponse.status, await parseErrorMessage(loginResponse));
  }

  const authPayload: AuthResponse = await loginResponse.json();
  localStorage.setItem(TOKEN_KEY, authPayload.accessToken);
  return authPayload.accessToken;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  requiresAuth = true,
  retryOnUnauthorized = true,
): Promise<T> {
  const headers = new Headers(options.headers ?? {});

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (requiresAuth) {
    const token = await bootstrapAuthToken();
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  if (response.status === 401 && requiresAuth && retryOnUnauthorized) {
    localStorage.removeItem(TOKEN_KEY);
    await bootstrapAuthToken(true);
    return apiRequest<T>(path, options, requiresAuth, false);
  }

  if (!response.ok) {
    throw new ApiRequestError(response.status, await parseErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getNotes() {
  return apiRequest<ApiNote[]>("/api/notes");
}

export async function createNote(title: string, content: string) {
  return apiRequest<ApiNote>("/api/notes", {
    method: "POST",
    body: JSON.stringify({ title, content }),
  });
}

export async function updateNote(noteId: string, payload: { title?: string; content?: string }) {
  return apiRequest<ApiNote>(`/api/notes/${noteId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteNote(noteId: string) {
  return apiRequest<void>(`/api/notes/${noteId}`, { method: "DELETE" });
}

export async function getDocuments() {
  return apiRequest<ApiDocument[]>("/api/documents");
}

export async function uploadDocument(file: File) {
  const form = new FormData();
  form.append("file", file);

  return apiRequest<ApiDocument>("/api/upload", {
    method: "POST",
    body: form,
  });
}

export async function sendChatMessage(query: string, conversationId?: string) {
  return apiRequest<ApiChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ query, conversationId: conversationId ?? null }),
  });
}

async function streamRequest(
  path: string,
  payload: object,
  retryOnUnauthorized = true,
) {
  const token = await bootstrapAuthToken();
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401 && retryOnUnauthorized) {
    localStorage.removeItem(TOKEN_KEY);
    return streamRequest(path, payload, false);
  }

  if (!response.ok) {
    throw new ApiRequestError(response.status, await parseErrorMessage(response));
  }

  if (!response.body) {
    throw new ApiRequestError(500, "Streaming response body is missing");
  }

  return response.body.getReader();
}

export async function streamChatMessage(
  query: string,
  conversationId: string | undefined,
  handlers: {
    onToken: (token: string) => void;
    onDone: (payload: { conversationId: string; sources: ApiSource[]; memoryHits: number }) => void;
  },
) {
  const reader = await streamRequest("/api/chat/stream", { query, conversationId: conversationId ?? null });
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const eventBlock of events) {
      const line = eventBlock
        .split("\n")
        .find((chunk) => chunk.startsWith("data: "));

      if (!line) {
        continue;
      }

      const raw = line.slice(6);
      const parsed = JSON.parse(raw) as ApiStreamTokenEvent | ApiStreamDoneEvent;

      if (parsed.type === "token") {
        handlers.onToken(parsed.content);
      }

      if (parsed.type === "done") {
        handlers.onDone({
          conversationId: parsed.conversationId ?? parsed.conversation_id ?? "",
          sources: parsed.sources ?? [],
          memoryHits: parsed.memoryHits ?? parsed.memory_hits ?? 0,
        });
      }
    }
  }
}

export async function getMemory() {
  return apiRequest<ApiMemory[]>("/api/memory");
}

export async function getDashboard() {
  return apiRequest<ApiDashboard>("/api/dashboard");
}
