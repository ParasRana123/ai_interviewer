import React from "react";
import { Bot, Volume2, VolumeX, Sparkles, Brain, Loader2 } from "lucide-react";

interface AiCallTileProps {
  isSpeaking: boolean;
  isThinking: boolean;
  isVoiceMuted: boolean;
  onToggleVoiceMute: () => void;
  onReplaySpeech?: () => void;
  lastAiMessage?: string;
}

export function AiCallTile({
  isSpeaking,
  isThinking,
  isVoiceMuted,
  onToggleVoiceMute,
  onReplaySpeech,
  lastAiMessage,
}: AiCallTileProps) {
  return (
    <div
      className={`relative flex-1 min-h-[300px] sm:min-h-[360px] md:min-h-[400px] rounded-3xl bg-slate-900/90 border transition-all duration-300 overflow-hidden flex flex-col justify-between p-5 shadow-2xl ${
        isSpeaking
          ? "border-blue-500/60 shadow-blue-500/20 ring-2 ring-blue-500/30"
          : isThinking
          ? "border-purple-500/50 shadow-purple-500/20 ring-1 ring-purple-500/30"
          : "border-slate-800 shadow-slate-950/60"
      }`}
    >
      {/* Background ambient radial glow */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
          isSpeaking
            ? "bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/30 via-slate-900/10 to-transparent opacity-100"
            : isThinking
            ? "bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/25 via-slate-900/10 to-transparent opacity-100"
            : "opacity-0"
        }`}
      />

      {/* Header Info */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-950 border border-blue-800/80 flex items-center justify-center text-blue-400 shadow-inner">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-100">AI Senior Interviewer</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-900/60 text-blue-300 border border-blue-700/50">
                Gemini 3.6 Flash
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Technical Lead • System Design & Architecture</p>
          </div>
        </div>

        {/* AI Audio Mute status button */}
        <button
          onClick={onToggleVoiceMute}
          title={isVoiceMuted ? "Unmute AI Voice" : "Mute AI Voice"}
          className={`p-2 rounded-xl border text-xs transition-all ${
            isVoiceMuted
              ? "bg-rose-950/80 text-rose-400 border-rose-800 hover:bg-rose-900"
              : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700"
          }`}
        >
          {isVoiceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Center Avatar & Sound Wave Visualizer */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto py-6">
        {/* Animated Concentric Waves when Speaking */}
        <div className="relative flex items-center justify-center">
          {isSpeaking && (
            <>
              <div className="absolute w-36 h-36 rounded-full border-2 border-blue-400/30 animate-ping duration-1000" />
              <div className="absolute w-44 h-44 rounded-full border border-cyan-400/20 animate-pulse duration-700" />
              <div className="absolute w-52 h-52 rounded-full border border-blue-500/10 animate-ping duration-1500" />
            </>
          )}

          {isThinking && (
            <div className="absolute w-36 h-36 rounded-full border-2 border-purple-500/40 animate-spin duration-3000 border-dashed" />
          )}

          {/* AI Avatar Core Circle */}
          <div
            className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
              isSpeaking
                ? "bg-gradient-to-tr from-blue-600 via-cyan-500 to-indigo-600 ring-4 ring-cyan-400/50 scale-105"
                : isThinking
                ? "bg-gradient-to-tr from-purple-700 via-indigo-600 to-pink-600 ring-4 ring-purple-400/40"
                : "bg-gradient-to-tr from-slate-800 via-slate-700 to-slate-800 ring-2 ring-slate-700"
            }`}
          >
            {isThinking ? (
              <Brain className="w-12 h-12 text-purple-200 animate-pulse" />
            ) : isSpeaking ? (
              <Sparkles className="w-12 h-12 text-white animate-bounce" />
            ) : (
              <Bot className="w-12 h-12 text-slate-300" />
            )}
          </div>
        </div>

        {/* Dynamic Voice Waves Bars */}
        <div className="flex items-center justify-center gap-1.5 mt-6 h-8">
          {Array.from({ length: 12 }).map((_, i) => {
            const isMiddle = i >= 3 && i <= 8;
            return (
              <span
                key={i}
                className={`w-1 rounded-full transition-all duration-150 ${
                  isSpeaking
                    ? "bg-gradient-to-t from-blue-500 to-cyan-300 animate-pulse"
                    : isThinking
                    ? "bg-purple-400/60"
                    : "bg-slate-700"
                }`}
                style={{
                  height: isSpeaking
                    ? `${Math.max(8, ((i * 17) % 28) + 6)}px`
                    : isThinking
                    ? `${(i % 3) * 6 + 6}px`
                    : "4px",
                  animationDelay: `${i * 70}ms`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Bottom Status Pill */}
      <div className="relative z-10 flex items-center justify-between pt-2">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            isSpeaking
              ? "bg-blue-950/90 text-cyan-300 border-blue-700/80 shadow-sm"
              : isThinking
              ? "bg-purple-950/90 text-purple-300 border-purple-800 shadow-sm"
              : "bg-slate-950/80 text-slate-400 border-slate-800"
          }`}
        >
          {isSpeaking ? (
            <>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>AI Speaking...</span>
            </>
          ) : isThinking ? (
            <>
              <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
              <span>Analyzing response...</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span>Listening to you</span>
            </>
          )}
        </div>

        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>HD Audio</span>
        </span>
      </div>
    </div>
  );
}
