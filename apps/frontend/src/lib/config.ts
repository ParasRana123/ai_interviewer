declare const process: any;

export const DEFAULT_PRODUCTION_BACKEND_URL = "https://ai-interviewer-backend-xezj.onrender.com";
export const DEFAULT_LOCAL_BACKEND_URL = "http://localhost:3001";
export const STORAGE_KEY_BACKEND_URL = "AI_INTERVIEWER_BACKEND_URL";

/**
 * Resolves the backend API URL dynamically across development,
 * preview deployments, and production environments on Vercel / Render.
 */
export function resolveBackendUrl(): string {
  // 0. Runtime user-configured override from localStorage (e.g. custom Render service URL)
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const customUrl = window.localStorage.getItem(STORAGE_KEY_BACKEND_URL);
      if (customUrl && customUrl.trim() !== "") {
        return customUrl.trim();
      }
    } catch (e) {
      // Ignore localStorage access issues
    }
  }

  // 1. Build-time defined environment variables (inlined by Bun build)
  if (typeof process !== "undefined" && process.env) {
    if (process.env.VITE_BACKEND_URL && typeof process.env.VITE_BACKEND_URL === "string" && process.env.VITE_BACKEND_URL.trim() !== "") {
      return process.env.VITE_BACKEND_URL.trim();
    }
    if (process.env.REACT_APP_BACKEND_URL && typeof process.env.REACT_APP_BACKEND_URL === "string" && process.env.REACT_APP_BACKEND_URL.trim() !== "") {
      return process.env.REACT_APP_BACKEND_URL.trim();
    }
    if (process.env.BACKEND_URL && typeof process.env.BACKEND_URL === "string" && process.env.BACKEND_URL.trim() !== "") {
      return process.env.BACKEND_URL.trim();
    }
  }

  // 2. Client-side runtime window injection (if provided)
  if (typeof window !== "undefined" && (window as any).__BACKEND_URL__) {
    return String((window as any).__BACKEND_URL__).trim();
  }

  // 3. Browser environment check: If running in browser on non-localhost, default to production Render URL
  if (typeof window !== "undefined" && window.location) {
    const hostname = window.location.hostname;
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.endsWith(".local");

    if (!isLocal) {
      return DEFAULT_PRODUCTION_BACKEND_URL;
    }
  }

  // 4. Default for local development
  return DEFAULT_LOCAL_BACKEND_URL;
}

export function getBackendUrl(): string {
  return resolveBackendUrl().replace(/\/+$/, "");
}

export function setCustomBackendUrl(url: string | null): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      if (!url || !url.trim()) {
        window.localStorage.removeItem(STORAGE_KEY_BACKEND_URL);
      } else {
        window.localStorage.setItem(STORAGE_KEY_BACKEND_URL, url.trim().replace(/\/+$/, ""));
      }
    } catch (e) {
      console.warn("Failed to save custom backend URL to localStorage:", e);
    }
  }
}

export const BACKEND_URL = getBackendUrl();