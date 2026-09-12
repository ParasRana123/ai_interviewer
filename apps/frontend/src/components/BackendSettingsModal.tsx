import React, { useState } from "react";
import axios from "axios";
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  X,
  Loader2,
  Radio,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  getBackendUrl,
  setCustomBackendUrl,
  DEFAULT_PRODUCTION_BACKEND_URL,
  DEFAULT_LOCAL_BACKEND_URL,
} from "@/lib/config";
import { toast } from "sonner";

interface BackendSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function BackendSettingsModal({
  isOpen,
  onClose,
  onSaved,
}: BackendSettingsModalProps) {
  const currentActiveUrl = getBackendUrl();
  const [inputUrl, setInputUrl] = useState(currentActiveUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    const cleanUrl = inputUrl.trim().replace(/\/+$/, "");
    if (!cleanUrl) {
      toast.error("Please enter a valid backend URL to test.");
      return;
    }

    setTesting(true);
    setTestResult(null);
    const start = performance.now();

    try {
      // Test /health endpoint
      const res = await axios.get(`${cleanUrl}/health`, { timeout: 12000 });
      const elapsed = Math.round(performance.now() - start);

      if (res.data?.status === "healthy" || res.status === 200) {
        setTestResult({
          success: true,
          message: `Backend reachable! (Response in ${elapsed}ms)`,
          latencyMs: elapsed,
        });
        toast.success("Connected to backend successfully!");
      } else {
        setTestResult({
          success: true,
          message: `Server responded with HTTP ${res.status}`,
          latencyMs: elapsed,
        });
      }
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      let errMsg = "Connection failed";
      if (err.code === "ECONNABORTED") {
        errMsg = "Request timed out (server may be sleeping on Render free tier)";
      } else if (err.response?.status === 404) {
        errMsg = "404 Not Found — check if your Render service URL is correct";
      } else if (err.message) {
        errMsg = err.message;
      }
      setTestResult({
        success: false,
        message: errMsg,
        latencyMs: elapsed,
      });
      toast.error(`Test failed: ${errMsg}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const clean = inputUrl.trim().replace(/\/+$/, "");
    setCustomBackendUrl(clean);
    toast.success(`Backend URL updated to: ${clean}`);
    if (onSaved) onSaved();
    onClose();
    // Reload page to re-initialize Axios instances and config
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  const handleResetDefault = () => {
    const isLocal =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    const target = isLocal ? DEFAULT_LOCAL_BACKEND_URL : DEFAULT_PRODUCTION_BACKEND_URL;
    setInputUrl(target);
    setCustomBackendUrl(null);
    setTestResult(null);
    toast.info(`Reset to default: ${target}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Backend API Settings</h2>
              <p className="text-xs text-slate-400">Configure or test your Render backend URL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 block">
            Backend Target URL
          </label>
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => {
              setInputUrl(e.target.value);
              setTestResult(null);
            }}
            placeholder="https://ai-interviewer-backend.onrender.com"
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <p className="text-[11px] text-slate-400">
            Render assigns free URLs like <span className="text-slate-300 font-mono">https://ai-interviewer-backend.onrender.com</span>. If your instance has a custom name or slug, paste it above.
          </p>
        </div>

        {/* Connection Test Box */}
        {testResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              testResult.success
                ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                : "bg-rose-950/40 border-rose-500/30 text-rose-300"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            )}
            <div className="space-y-0.5">
              <p className="font-semibold">{testResult.success ? "Connection Successful" : "Connection Failed"}</p>
              <p className="text-[11px] opacity-80">{testResult.message}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing || !inputUrl.trim()}
              className="text-xs border-slate-700 hover:bg-slate-800 gap-1.5 h-9"
            >
              {testing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Pinging...</span>
                </>
              ) : (
                <>
                  <Radio className="w-3.5 h-3.5 text-blue-400" />
                  <span>Test Health</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetDefault}
              className="text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 gap-1.5 h-9"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </Button>
          </div>

          <Button
            type="button"
            onClick={handleSave}
            className="w-full h-10 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20"
          >
            Save & Apply URL
          </Button>
        </div>
      </div>
    </div>
  );
}
