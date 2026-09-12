declare const process: any;

export const DEFAULT_PRODUCTION_BACKEND_URL = "https://ai-interviewer-backend.onrender.com";
export const DEFAULT_LOCAL_BACKEND_URL = "http://localhost:3001";

/**
 * Resolves the backend API URL dynamically across development,
 * preview deployments, and production environments on Vercel / Render.
 */
export function resolveBackendUrl(): string {
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

  // 3. Browser environment check: If running in browser on non-localhost, use production backend
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

export const BACKEND_URL = resolveBackendUrl().replace(/\/+$/, "");