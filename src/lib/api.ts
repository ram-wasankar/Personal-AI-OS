export interface ApiUser {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
  lastLoginAt?: string | null;
  lastLogoutAt?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  user: ApiUser;
}

export interface SignupPayload {
  fullName: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
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

const runtimeImportMeta = import.meta as ImportMeta & {
  env?: {
    VITE_API_URL?: string;
    VITE_RENDER_API_URL?: string;
  };
};

const DEFAULT_RENDER_API_URL = "https://personal-ai-os-eo1j.onrender.com";

function resolveApiBaseUrl(): string {
  const explicitApiUrl = (runtimeImportMeta.env?.VITE_API_URL ?? "").trim();
  if (explicitApiUrl) {
    return explicitApiUrl;
  }

  if (typeof window !== "undefined" && window.location.hostname.endsWith(".vercel.app")) {
    return (runtimeImportMeta.env?.VITE_RENDER_API_URL ?? DEFAULT_RENDER_API_URL).trim();
  }

  return "";
}

const API_BASE_URL = resolveApiBaseUrl();
const TOKEN_KEY = "synapse_keeper_token";
const USER_KEY = "synapse_keeper_user";

function buildUrl(path: string) {
  if (!API_BASE_URL) {
    return path;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (API_BASE_URL.endsWith("/") && path.startsWith("/")) {
    return `${API_BASE_URL.slice(0, -1)}${path}`;
  }

  if (!API_BASE_URL.endsWith("/") && !path.startsWith("/")) {
    return `${API_BASE_URL}/${path}`;
  }

  return `${API_BASE_URL}${path}`;
}

export function getStoredAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function hasStoredAuthToken(): boolean {
  return Boolean(localStorage.getItem(TOKEN_KEY));
}

export function getStoredAuthUser(): ApiUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ApiUser;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function setAuthSession(payload: AuthResponse): void {
  localStorage.setItem(TOKEN_KEY, payload.accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
}

export function clearAuthSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function parseErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  const vercelRequestId = response.headers.get("x-vercel-id");

  if (response.status === 401 && vercelRequestId && contentType.includes("text/html")) {
    return "Deployment is protected by Vercel authentication. Disable deployment protection or use a shareable bypass link.";
  }

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

export async function signup(payload: SignupPayload): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>(
    "/api/auth/signup",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    false,
  );
  setAuthSession(response);
  return response;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    false,
  );
  setAuthSession(response);
  return response;
}

export async function getCurrentUser(): Promise<ApiUser> {
  const user = await apiRequest<ApiUser>("/api/auth/me");
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export async function logout(): Promise<void> {
  await apiRequest<{ message: string }>(
    "/api/auth/logout",
    {
      method: "POST",
    },
    true,
  );
  clearAuthSession();
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  requiresAuth = true,
): Promise<T> {
  const headers = new Headers(options.headers ?? {});

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (requiresAuth) {
    const token = getStoredAuthToken();
    if (!token) {
      throw new ApiRequestError(401, "Not authenticated");
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  if (response.status === 401 && requiresAuth) {
    clearAuthSession();
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
) {
  const token = getStoredAuthToken();
  if (!token) {
    throw new ApiRequestError(401, "Not authenticated");
  }

  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    clearAuthSession();
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
