import React, { useState, useRef } from "react";
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
} from "lucide-react";
import { Button } from "./ui/button";
import { BACKEND_URL } from "@/lib/config";

export function Form() {
  const [resume, setResume] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

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

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("resume", resume);

      const response = await axios.post(
        `${BACKEND_URL}/api/v1/upload-resume`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const responseData = response.data;
      if (responseData?.interviewId) {
        toast.success("Resume parsed successfully! Starting interview...");
        navigate(`/interview/${responseData.interviewId}`);
      } else {
        toast.error("Unexpected response from server.");
      }
    } catch (error: any) {
      console.error("Resume upload error:", error);
      const serverMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to upload and parse resume.";
      toast.error(serverMessage);
    } finally {
      setLoading(false);
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center p-4 bg-gradient-to-b from-background via-background/95 to-muted/20">
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
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Parsing resume & preparing interview...</span>
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