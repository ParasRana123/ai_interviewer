import React, { useEffect, useRef } from "react";
import { User, Mic, MicOff, Radio, Activity } from "lucide-react";

interface UserCallTileProps {
  candidateName: string;
  isMuted: boolean;
  isListening: boolean;
  audioStream: MediaStream | null;
  onToggleMute: () => void;
  turnsCount: number;
  liveTranscript?: string;
}

export function UserCallTile({
  candidateName,
  isMuted,
  isListening,
  audioStream,
  onToggleMute,
  turnsCount,
  liveTranscript,
}: UserCallTileProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const isUserSpeaking = Boolean(isListening && !isMuted && liveTranscript && liveTranscript.trim().length > 0);

  // Real-time canvas frequency visualizer using Web Audio API
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!audioStream || isMuted || audioStream.getAudioTracks().length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#334155";
      const bars = 16;
      const barW = canvas.width / bars - 2;
      for (let i = 0; i < bars; i++) {
        const x = i * (barW + 2);
        ctx.fillRect(x, canvas.height / 2 - 1, barW, 2);
      }
      return;
    }

    let isSubscribed = true;

    try {
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }

      const source = audioCtx.createMediaStreamSource(audioStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!isSubscribed) return;
        animFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const bars = 16;
        const barW = canvas.width / bars - 2;

        for (let i = 0; i < bars; i++) {
          const idx = Math.floor((i / bars) * bufferLength);
          const val = dataArray[idx] || 0;
          const barH = Math.max((val / 255) * (canvas.height - 4), 3);
          const x = i * (barW + 2);

          const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
          grad.addColorStop(0, "#10b981");
          grad.addColorStop(1, "#34d399");

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, (canvas.height - barH) / 2, barW, barH, [2, 2, 2, 2]);
          ctx.fill();
        }
      };

      draw();
    } catch (e) {
      console.warn("User audio visualizer notice:", e);
    }

    return () => {
      isSubscribed = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [audioStream, isMuted]);

  // Initials for avatar
  const initials = candidateName
    ? candidateName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "ME";

  return (
    <div
      className={`relative flex-1 min-h-[300px] sm:min-h-[360px] md:min-h-[400px] rounded-3xl bg-slate-900/90 border transition-all duration-300 overflow-hidden flex flex-col justify-between p-5 shadow-2xl ${
        isUserSpeaking
          ? "border-emerald-500/60 shadow-emerald-500/20 ring-2 ring-emerald-500/30"
          : isMuted
          ? "border-amber-900/40 shadow-slate-950/60"
          : "border-slate-800 shadow-slate-950/60"
      }`}
    >
      {/* Ambient background glow when speaking */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
          isUserSpeaking
            ? "bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/30 via-slate-900/10 to-transparent opacity-100"
            : "opacity-0"
        }`}
      />

      {/* Header Info */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-800/80 flex items-center justify-center text-emerald-400 shadow-inner">
            <User className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-100">{candidateName || "Candidate"}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
                You
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Audio Input • Web Speech Voice Stream</p>
          </div>
        </div>

        {/* Turns count & quick mute button */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-slate-800/90 text-slate-300 border border-slate-700">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span>{turnsCount} Turns Spoken</span>
          </span>

          <button
            onClick={onToggleMute}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            className={`p-2 rounded-xl border text-xs transition-all ${
              isMuted
                ? "bg-amber-950/80 text-amber-400 border-amber-800 hover:bg-amber-900"
                : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
          >
            {isMuted ? <MicOff className="w-4 h-4 text-amber-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Center Avatar with dynamic pulse */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto py-6">
        <div className="relative flex items-center justify-center">
          {/* Concentric rings when candidate is actively talking */}
          {isUserSpeaking && (
            <>
              <div className="absolute w-36 h-36 rounded-full border-2 border-emerald-400/30 animate-ping duration-1000" />
              <div className="absolute w-44 h-44 rounded-full border border-teal-400/20 animate-pulse duration-700" />
              <div className="absolute w-52 h-52 rounded-full border border-emerald-500/10 animate-ping duration-1500" />
            </>
          )}

          {/* User Avatar Circle */}
          <div
            className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center font-bold text-2xl tracking-wider transition-all duration-300 shadow-2xl ${
              isUserSpeaking
                ? "bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-600 text-white ring-4 ring-emerald-400/50 scale-105"
                : isMuted
                ? "bg-gradient-to-tr from-slate-800 via-slate-700 to-amber-950/60 text-slate-400 ring-2 ring-amber-900/60"
                : "bg-gradient-to-tr from-indigo-800 via-blue-700 to-teal-800 text-white ring-2 ring-indigo-500/40"
            }`}
          >
            {initials}
          </div>
        </div>

        {/* Real-time Frequency Canvas Visualizer */}
        <div className="flex items-center justify-center mt-6 h-8">
          <canvas
            ref={canvasRef}
            width={140}
            height={28}
            className="w-[140px] h-[28px] opacity-90"
          />
        </div>
      </div>

      {/* Bottom Status Pill */}
      <div className="relative z-10 flex items-center justify-between pt-2">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            isMuted
              ? "bg-amber-950/90 text-amber-400 border-amber-800 shadow-sm"
              : isUserSpeaking
              ? "bg-emerald-950/90 text-emerald-300 border-emerald-700/80 shadow-sm"
              : "bg-slate-950/80 text-slate-400 border-slate-800"
          }`}
        >
          {isMuted ? (
            <>
              <MicOff className="w-3 h-3 text-amber-400" />
              <span>Microphone Muted</span>
            </>
          ) : isUserSpeaking ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Transcribing Speech...</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Microphone Ready</span>
            </>
          )}
        </div>

        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          <Radio className="w-3 h-3 text-emerald-400" />
          <span>Live Audio Stream</span>
        </span>
      </div>
    </div>
  );
}
