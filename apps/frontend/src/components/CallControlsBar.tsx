import React, { useEffect, useState } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  PhoneOff,
  MessageSquare,
  Sparkles,
  Send,
} from "lucide-react";

interface CallControlsBarProps {
  isMuted: boolean;
  isAiVoiceMuted: boolean;
  onToggleMute: () => void;
  onToggleAiVoice: () => void;
  onReplayQuestion: () => void;
  onEndCall: () => void;
  onToggleChatDrawer: () => void;
  isChatDrawerOpen: boolean;
  liveTranscript?: string;
  onManualCommitTranscript?: () => void;
  isAiThinking: boolean;
}

export function CallControlsBar({
  isMuted,
  isAiVoiceMuted,
  onToggleMute,
  onToggleAiVoice,
  onReplayQuestion,
  onEndCall,
  onToggleChatDrawer,
  isChatDrawerOpen,
  liveTranscript,
  onManualCommitTranscript,
  isAiThinking,
}: CallControlsBarProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Live Call Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  const hasLiveTranscript = Boolean(liveTranscript && liveTranscript.trim().length > 0);

  return (
    <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-3 sm:p-4 shadow-2xl">
      {/* Left: Call Timer & Live Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[10px]">Live Call</span>
          <span className="text-slate-500">•</span>
          <span className="font-mono text-slate-200 font-medium">{formatTime(elapsedSeconds)}</span>
        </div>

        {hasLiveTranscript && onManualCommitTranscript && (
          <button
            onClick={onManualCommitTranscript}
            disabled={isAiThinking}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950 transition-colors animate-in fade-in"
          >
            <Send className="w-3 h-3" />
            <span>Submit Speech</span>
          </button>
        )}
      </div>

      {/* Center: In-Call Action Control Buttons */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Microphone Mute / Unmute Button */}
        <button
          onClick={onToggleMute}
          title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-all shadow-lg ${
            isMuted
              ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/60 ring-2 ring-rose-500/40"
              : "bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 shadow-slate-950/60 hover:ring-2 hover:ring-emerald-500/30"
          }`}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* AI Speaker Voice Output Toggle */}
        <button
          onClick={onToggleAiVoice}
          title={isAiVoiceMuted ? "Unmute AI Speaker Voice" : "Mute AI Speaker Voice"}
          className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-all shadow-lg ${
            isAiVoiceMuted
              ? "bg-slate-800 text-slate-500 border border-slate-700"
              : "bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 hover:ring-2 hover:ring-cyan-500/30"
          }`}
        >
          {isAiVoiceMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        {/* Replay Last Question Button */}
        <button
          onClick={onReplayQuestion}
          title="Replay Last AI Question"
          className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all hover:ring-2 hover:ring-blue-500/30 shadow-lg"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        {/* Optional Chat Drawer Toggle */}
        <button
          onClick={onToggleChatDrawer}
          title={isChatDrawerOpen ? "Hide Text Chat" : "Open Fallback Text Chat"}
          className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-all shadow-lg ${
            isChatDrawerOpen
              ? "bg-blue-600 text-white shadow-blue-950 ring-2 ring-blue-400/40"
              : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:ring-2 hover:ring-slate-600"
          }`}
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>

      {/* Right: End Call Hangup Button */}
      <div className="flex items-center">
        <button
          onClick={onEndCall}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold text-xs sm:text-sm shadow-xl shadow-rose-950/70 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <PhoneOff className="w-4 h-4" />
          <span>End Call & View Report</span>
        </button>
      </div>
    </div>
  );
}
