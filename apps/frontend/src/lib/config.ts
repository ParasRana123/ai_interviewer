declare const process: any;

/**
 * Resolves the backend API URL dynamically across development,
 * preview deployments, and production environments on Vercel / Render.
 */
function resolveBackendUrl(): string {
  // 1. Build-time defined environment variables (inlined by Bun build)
  if (typeof process !== "undefined" && process.env) {
    if (process.env.VITE_BACKEND_URL && process.env.VITE_BACKEND_URL.trim() !== "") {
      return process.env.VITE_BACKEND_URL.trim();
    }
    if (process.env.REACT_APP_BACKEND_URL && process.env.REACT_APP_BACKEND_URL.trim() !== "") {
      return process.env.REACT_APP_BACKEND_URL.trim();
    }
    if (process.env.BACKEND_URL && process.env.BACKEND_URL.trim() !== "") {
      return process.env.BACKEND_URL.trim();
    }
  }

  // 2. Client-side runtime window injection (if provided)
  if (typeof window !== "undefined" && (window as any).__BACKEND_URL__) {
    return String((window as any).__BACKEND_URL__).trim();
  }

  // 3. Fallback default for local development
  return "http://localhost:3001";
}

export const BACKEND_URL = resolveBackendUrl().replace(/\/+$/, "");