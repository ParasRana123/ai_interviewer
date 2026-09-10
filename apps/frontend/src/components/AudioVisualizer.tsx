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
    if (!canvasRef.current || !stream || !isActive) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animationFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height * 0.85;

          const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
          gradient.addColorStop(0, "#3b82f6");
          gradient.addColorStop(1, "#60a5fa");

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, canvas.height - barHeight, Math.max(barWidth - 2, 2), barHeight, [2, 2, 0, 0]);
          ctx.fill();

          x += barWidth + 1;
        }
      };

      draw();
    } catch (e) {
      console.warn("Audio visualizer initialization notice:", e);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stream, isActive]);

  return (
    <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800">
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
        <span className="text-xs text-slate-400 font-medium">
          {isActive ? "Microphone Active" : "Microphone Idle"}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={160}
        height={28}
        className="w-[160px] h-[28px] opacity-90"
      />
    </div>
  );
}
