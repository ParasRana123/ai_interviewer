import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import {
  UploadCloud,
  FileText,
  Sparkles,
  Loader2,
  CheckCircle2,
  X,
  Code2,
  Mic,
  BrainCircuit,
  Settings,
  Server,
} from "lucide-react";
import { Button } from "./ui/button";
import { BACKEND_URL, getBackendUrl } from "@/lib/config";
import { BackendSettingsModal } from "./BackendSettingsModal";
import { AlertCircle } from "lucide-react";

export function Form() {
  const [resume, setResume] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "not-found" | "offline">("checking");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const currentBackendUrl = getBackendUrl();

  // Proactive background ping on mount to wake up Render free-tier backend and test reachability
  useEffect(() => {
    let isMounted = true;
    axios
      .get(`${currentBackendUrl}/health`, { timeout: 15000 })
      .then((res) => {
        if (isMounted) {
          if (res.data?.status === "healthy" || res.status === 200) {
            setBackendStatus("online");
            console.log("AI Interviewer Backend is online and responsive.");
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          if (err.response?.status === 404) {
            setBackendStatus("not-found");
            console.warn("Backend returned 404 Not Found. Service URL may differ.");
          } else {
            setBackendStatus("offline");
            console.info("Proactive health check dispatched (free-tier instance may be spinning up).");
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentBackendUrl]);

  function handleFileSelection(file: File | undefined) {
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please select a valid PDF file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB limit. Please upload a smaller PDF.");
      return;
    }

    setResume(file);
    toast.success(`Selected "${file.name}"`);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  }

  async function onSubmit() {
    if (!resume) {
      toast.error("Please upload your resume PDF to begin.");
      return;
    }

    setLoading(true);
    setLoadingStatus("Connecting to AI Interviewer server...");

    const maxRetries = 2; // Up to 3 attempts total
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          setLoadingStatus(`Server is waking up (attempt ${attempt + 1}/${maxRetries + 1})...`);
          toast.info(`Retrying connection to backend (attempt ${attempt + 1}/${maxRetries + 1})...`);
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        } else {
          setLoadingStatus("Parsing resume & analyzing skills with Gemini AI...");
        }

        const formData = new FormData();
        formData.append("resume", resume);

        let response: any = null;

        // Try primary /api/v1/upload-resume route first
        try {
          response = await axios.post(
            `${currentBackendUrl}/api/v1/upload-resume`,
            formData,
            {
              headers: { "Content-Type": "multipart/form-data" },
              timeout: 60000,
            }
          );
        } catch (v1Err: any) {
          // If /api/v1 returned 404, fallback to /upload-resume directly
          if (v1Err.response?.status === 404) {
            console.warn("/api/v1/upload-resume returned 404, trying /upload-resume fallback...");
            response = await axios.post(
              `${currentBackendUrl}/upload-resume`,
              formData,
              {
                headers: { "Content-Type": "multipart/form-data" },
                timeout: 60000,
              }
            );
          } else {
            throw v1Err;
          }
        }

        const responseData = response?.data;
        if (responseData?.interviewId) {
          toast.success("Resume parsed successfully! Starting interview session...");
          navigate(`/interview/${responseData.interviewId}`);
          return;
        } else {
          throw new Error("Unexpected response structure from server.");
        }
      } catch (error: any) {
        lastError = error;
        console.error(`Resume upload attempt ${attempt + 1} failed:`, error);

        const isNetworkOrTimeout =
          !error.response ||
          error.code === "ECONNABORTED" ||
          error.code === "ERR_NETWORK" ||
          error.message?.includes("Network Error");

        // Only retry if it's a network/cold start error, not a 400 client error
        if (!isNetworkOrTimeout || attempt === maxRetries) {
          break;
        }
      }
    }

    // Final error handling if all retries exhausted
    let serverMessage = "Failed to connect to backend server. Please try again.";
    if (lastError?.response?.status === 404) {
      setBackendStatus("not-found");
      serverMessage = `Backend service not found (404) at ${currentBackendUrl}. Please enter your exact Render Web Service URL in settings.`;
      // Open settings modal automatically to assist the user
      setTimeout(() => setIsSettingsOpen(true), 400);
    } else if (lastError?.response?.data?.message) {
      serverMessage = lastError.response.data.message;
    } else if (lastError?.response?.data?.error) {
      serverMessage = lastError.response.data.error;
    } else if (lastError?.code === "ECONNABORTED") {
      serverMessage = "Server took too long to respond. The free tier backend may be waking up. Please try again.";
    } else if (lastError?.message?.includes("Network Error") || !lastError?.response) {
      serverMessage = "Could not reach backend service. The server may be waking up from sleep. Please try again in a few seconds.";
    } else if (lastError?.message) {
      serverMessage = lastError.message;
    }

    toast.error(serverMessage);
    setLoading(false);
    setLoadingStatus("");
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center p-4 bg-gradient-to-b from-background via-background/95 to-muted/20 relative">
      {/* Top Navigation / Backend Status Pill */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border shadow-sm transition-all ${
            backendStatus === "not-found"
              ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
              : "bg-card/80 hover:bg-card border-border text-muted-foreground hover:text-foreground"
          }`}
          title="Configure backend target URL"
        >
          <Server className={`w-3.5 h-3.5 ${backendStatus === "not-found" ? "text-amber-400 animate-pulse" : "text-blue-500"}`} />
          <span className="hidden sm:inline">
            {backendStatus === "not-found" ? "Configure Render URL" : "Backend API"}
          </span>
          <Settings className="w-3 h-3 ml-0.5 opacity-70" />
        </button>
      </div>

      <BackendSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <div className="w-full max-w-lg space-y-6">
        {/* Header Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Interview Platform</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Interview Kickstart
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Upload your resume to start an intelligent, conversational voice interview tailored to your skills.
          </p>
        </div>

        {/* 404 Notice Banner */}
        {backendStatus === "not-found" && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="leading-snug">
                Backend 404 at <span className="font-mono text-amber-300 font-semibold">{currentBackendUrl}</span>
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsSettingsOpen(true)}
              className="h-7 text-[11px] border-amber-500/40 text-amber-300 hover:bg-amber-500/20 shrink-0 font-medium"
            >
              Set Render URL
            </Button>
          </div>
        )}

        {/* Upload Card */}
        <div className="bg-card border rounded-2xl p-6 sm:p-8 shadow-xl space-y-6 transition-all">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !resume && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
              isDragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : resume
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-border hover:border-primary/50 hover:bg-muted/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileSelection(e.target.files[0]);
                }
              }}
            />

            {resume ? (
              <div className="flex flex-col items-center gap-3 w-full animate-in fade-in zoom-in duration-200">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1 text-center max-w-full">
                  <p className="text-sm font-semibold text-foreground truncate px-2">
                    {resume.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(resume.size)} • PDF Ready
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setResume(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive gap-1 h-7 px-2"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Choose different file</span>
                </Button>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Click to upload or drag & drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF format (up to 10MB)
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Action Button */}
          <Button
            onClick={onSubmit}
            disabled={loading || !resume}
            className="w-full h-11 text-sm font-medium shadow-md transition-all gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span className="truncate">{loadingStatus || "Parsing resume & preparing interview..."}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Start Interview</span>
              </>
            )}
          </Button>

          {/* Feature Badges */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t text-center text-xs text-muted-foreground">
            <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/30">
              <BrainCircuit className="w-4 h-4 text-primary" />
              <span>Smart Resume Parse</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/30">
              <Code2 className="w-4 h-4 text-primary" />
              <span>Profile Enrichment</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/30">
              <Mic className="w-4 h-4 text-primary" />
              <span>Voice Interview</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}