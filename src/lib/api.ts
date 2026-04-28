import {
  isFileOverMaxUpload,
  MaxUploadError,
} from "./uploadLimits";
import { publicApiUrl } from "./publicEnv";

const API_URL = publicApiUrl;

const MAX_RETRIES = 2;

function messageFromLaravelError(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as { message?: unknown; errors?: Record<string, string[] | string> };
  if (typeof d.message === "string" && d.message) return d.message;
  if (d.errors) {
    for (const v of Object.values(d.errors)) {
      const first = Array.isArray(v) ? v[0] : v;
      if (typeof first === "string" && first) return first;
    }
  }
  return "";
}
const RETRY_DELAY_MS = 300;

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("auth_token");
    }
  }

  /** Always prefer live localStorage so requests stay authorized after refresh / hydration. */
  private getBearerToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("auth_token");
    }
    return this.token;
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== "undefined") {
      if (token) localStorage.setItem("auth_token", token);
      else localStorage.removeItem("auth_token");
    }
  }

  getToken() {
    return this.getBearerToken() ?? this.token;
  }

  /** JSON POST headers including Bearer when logged in (for Next.js API routes that proxy to Laravel). */
  authJsonHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const bearer = this.getBearerToken();
    if (bearer) {
      headers["Authorization"] = `Bearer ${bearer}`;
    }
    return headers;
  }

  private async request<T = unknown>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers as Record<string, string>),
    };
    const bearer = this.getBearerToken();
    if (bearer) {
      headers["Authorization"] = `Bearer ${bearer}`;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(`${API_URL}${path}`, { ...options, headers });

        if (res.status === 204) return undefined as T;

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            messageFromLaravelError(data) || `Request failed: ${res.status}`
          );
        }
        return data;
      } catch (err) {
        lastError = err;
        const isNetworkError = err instanceof TypeError && /failed to fetch|network/i.test(err.message);
        if (!isNetworkError || attempt === MAX_RETRIES) throw err;
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
    throw lastError;
  }

  // Auth
  async login(email: string, password: string) {
    const res = await this.request<{ user: unknown; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    return res;
  }

  async register(data: { email: string; password: string; name: string; company_name: string }) {
    const res = await this.request<{
      user?: unknown;
      token?: string;
      message?: string;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  async forgotPassword(email: string) {
    return this.request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(payload: {
    email: string;
    token: string;
    password: string;
    password_confirmation: string;
  }) {
    return this.request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async logout() {
    await this.request("/auth/logout", { method: "POST" });
    this.setToken(null);
  }

  async getProfile() {
    return this.request<{ user: unknown }>("/auth/me");
  }

  async updateProfile(data: Record<string, unknown>) {
    return this.request<{ user: unknown }>("/auth/me", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // Modes
  async getModes() {
    return this.request<{ data: unknown[] }>("/modes");
  }

  // Uploads
  async uploadImage(file: File): Promise<{ url: string }> {
    if (isFileOverMaxUpload(file)) {
      throw new MaxUploadError();
    }
    const formData = new FormData();
    formData.append("image", file);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    const bearer = this.getBearerToken();
    if (bearer) {
      headers["Authorization"] = `Bearer ${bearer}`;
    }

    const res = await fetch(`${API_URL}/upload-image`, {
      method: "POST",
      headers,
      body: formData,
    });

    const data = (await res.json()) as {
      url?: string;
      message?: string;
      errors?: Record<string, string[] | string>;
    };

    if (!res.ok) {
      const fromErrors = data.errors
        ? (Object.values(data.errors)
            .flat()
            .map((e) => (Array.isArray(e) ? e.join(" ") : e))
            .filter(Boolean)
            .join(" ") || undefined)
        : undefined;
      throw new Error(
        fromErrors || data.message || `Upload failed: ${res.status}`,
      );
    }
    if (!data.url) {
      throw new Error("Upload did not return a URL");
    }
    return { url: data.url };
  }

  async uploadMaterialImage(file: File): Promise<{ url: string }> {
    if (isFileOverMaxUpload(file)) {
      throw new MaxUploadError();
    }
    const formData = new FormData();
    formData.append("image", file);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    const bearer = this.getBearerToken();
    if (bearer) {
      headers["Authorization"] = `Bearer ${bearer}`;
    }

    const res = await fetch(`${API_URL}/upload-material-image`, {
      method: "POST",
      headers,
      body: formData,
    });

    const data = (await res.json()) as {
      url?: string;
      message?: string;
      errors?: Record<string, string[] | string>;
    };

    if (!res.ok) {
      const fromErrors = data.errors
        ? (Object.values(data.errors)
            .flat()
            .map((e) => (Array.isArray(e) ? e.join(" ") : e))
            .filter(Boolean)
            .join(" ") || undefined)
        : undefined;
      throw new Error(
        fromErrors || data.message || `Upload failed: ${res.status}`,
      );
    }
    if (!data.url) {
      throw new Error("Upload did not return a URL");
    }
    return { url: data.url };
  }

  async uploadModel(file: File | Blob, filename: string): Promise<{ url: string }> {
    if (isFileOverMaxUpload(file)) {
      throw new MaxUploadError();
    }
    const formData = new FormData();
    formData.append("model", file, filename);
    formData.append("filename", filename);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    const bearer = this.getBearerToken();
    if (bearer) {
      headers["Authorization"] = `Bearer ${bearer}`;
    }

    const res = await fetch(`${API_URL}/upload-model`, {
      method: "POST",
      headers,
      body: formData,
    });

    const data = (await res.json()) as {
      url?: string;
      message?: string;
      errors?: Record<string, string[] | string>;
    };

    if (!res.ok) {
      const fromErrors = data.errors
        ? (Object.values(data.errors)
            .flat()
            .map((e) => (Array.isArray(e) ? e.join(" ") : e))
            .filter(Boolean)
            .join(" ") || undefined)
        : undefined;
      throw new Error(
        fromErrors || data.message || `Upload failed: ${res.status}`,
      );
    }
    if (!data.url) {
      throw new Error("Upload did not return a URL");
    }
    return { url: data.url };
  }

  // Catalog Items
  async getCatalogItems() {
    return this.request<{ data: unknown[] }>("/catalog-items");
  }

  async createCatalogItem(data: Record<string, unknown>) {
    return this.request<{ data: unknown }>("/catalog-items", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCatalogItem(id: string, data: Record<string, unknown>) {
    return this.request<{ data: unknown }>(`/catalog-items/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteCatalogItem(id: string) {
    return this.request(`/catalog-items/${id}`, { method: "DELETE" });
  }

  // Materials
  async getMaterials() {
    return this.request<{ data: unknown[] }>("/materials");
  }

  async createMaterial(data: Record<string, unknown>) {
    return this.request<{ data: unknown }>("/materials", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateMaterial(id: string, data: Record<string, unknown>) {
    return this.request<{ data: unknown }>(`/materials/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteMaterial(id: string) {
    return this.request(`/materials/${id}`, { method: "DELETE" });
  }

  async getMaterialTemplates(params?: {
    manufacturer?: string;
    search?: string;
    type?: string;
  }) {
    const q = new URLSearchParams();
    if (params?.type) q.set("type", params.type);
    if (params?.manufacturer) q.set("manufacturer", params.manufacturer);
    if (params?.search?.trim()) q.set("search", params.search.trim());
    const suffix = q.toString() ? `?${q}` : "";
    return this.request<{ data: unknown[] }>(`/material-templates${suffix}`);
  }

  async importMaterialTemplates(body: Record<string, unknown>) {
    return this.request<{ data: unknown[] }>("/materials/import-templates", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async bulkUpdateMaterials(body: Record<string, unknown>) {
    return this.request<{ data: unknown[] }>("/materials/bulk", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  // Modules
  async getModules() {
    return this.request<{ data: unknown[] }>("/modules");
  }

  async createModule(data: Record<string, unknown>) {
    return this.request<{ data: unknown }>("/modules", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateModule(id: string, data: Record<string, unknown>) {
    return this.request<{ data: unknown }>(`/modules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteModule(id: string) {
    return this.request(`/modules/${id}`, { method: "DELETE" });
  }

  // Orders
  async getOrders() {
    return this.request<{ data: unknown[] }>("/orders");
  }

  async createOrder(data: Record<string, unknown>) {
    return this.request<{ data: unknown }>("/orders", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateOrder(id: string, data: Record<string, unknown>) {
    return this.request<{ data: unknown }>(`/orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // Public
  async getPublicAdmin(slug: string) {
    return this.request<{ data: unknown }>(`/public/${slug}`);
  }

  async getPublicCatalog(slug: string) {
    return this.request<{ data: unknown[] }>(`/public/${slug}/catalog`);
  }

  async getPublicMaterials(slug: string) {
    return this.request<{ data: unknown[] }>(`/public/${slug}/materials`);
  }

  async getPublicModules(slug: string) {
    return this.request<{ data: unknown[] }>(`/public/${slug}/modules`);
  }

  async submitPublicOrder(slug: string, data: Record<string, unknown>) {
    return this.request<{ data: unknown }>(`/public/${slug}/orders`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
