import { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isActive: boolean;
}

export function AudioVisualizer({ stream, isActive }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw idle state if stream is not available or inactive
    if (!stream || !isActive || stream.getAudioTracks().length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#334155";
      const totalBars = 18;
      const barWidth = canvas.width / totalBars - 2;
      for (let i = 0; i < totalBars; i++) {
        const x = i * (barWidth + 2);
        ctx.fillRect(x, canvas.height / 2 - 2, barWidth, 4);
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

      // Chrome AudioContext policy: ensure context is resumed
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!isSubscribed) return;
        animationFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const totalBars = 18;
        const barWidth = canvas.width / totalBars - 2;

        for (let i = 0; i < totalBars; i++) {
          const dataIdx = Math.floor((i / totalBars) * bufferLength);
          const rawVal = dataArray[dataIdx] || 0;
          // Calculate dynamic bar height
          const barHeight = Math.max((rawVal / 255) * (canvas.height - 4), 4);
          const x = i * (barWidth + 2);

          const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
          gradient.addColorStop(0, "#2563eb");
          gradient.addColorStop(1, "#38bdf8");

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, (canvas.height - barHeight) / 2, barWidth, barHeight, [2, 2, 2, 2]);
          ctx.fill();
        }
      };

      draw();
    } catch (e) {
      console.warn("Audio visualizer initialization notice:", e);
    }

    return () => {
      isSubscribed = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [stream, isActive]);

  return (
    <div className="flex items-center gap-3 bg-slate-950/80 px-3.5 py-1.5 rounded-xl border border-slate-800">
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
        <span className="text-xs text-slate-300 font-medium">
          {isActive ? "Microphone Live" : "Microphone Idle"}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={160}
        height={26}
        className="w-[160px] h-[26px] opacity-90"
      />
    </div>
  );
}

