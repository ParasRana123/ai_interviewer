import React, { useState } from "react";
import { Bot, User, Captions, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

interface LiveCaptionsStripProps {
  isAiSpeaking: boolean;
  isAiThinking: boolean;
  isCandidateSpeaking: boolean;
  currentAiText: string;
  liveCandidateTranscript: string;
  candidateName: string;
}

export function LiveCaptionsStrip({
  isAiSpeaking,
  isAiThinking,
  isCandidateSpeaking,
  currentAiText,
  liveCandidateTranscript,
  candidateName,
}: LiveCaptionsStripProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Determine active speaker and active text
  let speakerBadge = null;
  let activeText = "";
  let isPlaceholder = false;

  if (isCandidateSpeaking && liveCandidateTranscript.trim()) {
    speakerBadge = (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
        <User className="w-3 h-3 text-emerald-400" />
        <span>{candidateName || "You"}</span>
      </span>
    );
    activeText = liveCandidateTranscript;
  } else if (isAiSpeaking && currentAiText.trim()) {
    speakerBadge = (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-950 text-cyan-300 border border-blue-800">
        <Bot className="w-3 h-3 text-blue-400" />
        <span>AI Senior Interviewer</span>
      </span>
    );
    activeText = currentAiText;
  } else if (isAiThinking) {
    speakerBadge = (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-950 text-purple-300 border border-purple-800 animate-pulse">
        <Sparkles className="w-3 h-3 text-purple-400" />
        <span>AI Evaluator</span>
      </span>
    );
    activeText = "Analyzing your technical points and preparing follow-up question...";
  } else if (currentAiText.trim()) {
    speakerBadge = (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
        <Bot className="w-3 h-3 text-slate-400" />
        <span>Last AI Question</span>
      </span>
    );
    activeText = currentAiText;
  } else {
    isPlaceholder = true;
    activeText = "Waiting for conversation to begin. Speak into your microphone anytime.";
  }

  return (
    <div className="w-full bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-3.5 shadow-xl transition-all">
      {/* Header bar with toggle */}
      <div className="flex items-center justify-between gap-2 mb-1.5 pb-1.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Captions className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
            Live Call Subtitles & Real-Time Dialogue
          </span>
          {speakerBadge}
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
          title={isExpanded ? "Collapse subtitles" : "Expand subtitles"}
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Subtitles text content */}
      {isExpanded && (
        <div className="min-h-[44px] max-h-[72px] overflow-y-auto px-1 flex items-center">
          <p
            className={`text-xs sm:text-sm leading-relaxed transition-all ${
              isPlaceholder
                ? "text-slate-400 italic"
                : isCandidateSpeaking
                ? "text-emerald-200 font-medium"
                : isAiSpeaking
                ? "text-cyan-100 font-normal"
                : isAiThinking
                ? "text-purple-200 italic"
                : "text-slate-300"
            }`}
          >
            "{activeText}"
          </p>
        </div>
      )}
    </div>
  );
}
