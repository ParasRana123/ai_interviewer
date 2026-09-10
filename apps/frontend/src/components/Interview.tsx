import { useParams, useNavigate } from "react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { BACKEND_URL } from "@/lib/config";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import axios from "axios";
import {
  Mic,
  MicOff,
  Sparkles,
  Send,
  LogOut,
  Radio,
  BrainCircuit,
  Volume2,
  VolumeX,
} from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "candidate" | "interviewer";
  text: string;
  timestamp: string;
}

export function Interview() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [sessionMode, setSessionMode] = useState<"voice" | "speech-stt">("speech-stt");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [manualText, setManualText] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Send user transcript directly to backend session
  const handleFinalTranscript = useCallback(
    async (text: string) => {
      const cleanText = text.trim();
      if (!cleanText || !interviewId) return;

      const newMsg: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        sender: "candidate",
        text: cleanText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };
      setMessages((prev) => [...prev, newMsg]);

      try {
        await axios.post(`${BACKEND_URL}/api/v1/session1/${interviewId}`, {
          message: cleanText,
        });
      } catch (err) {
        console.error("Failed to post user transcript:", err);
      }
    },
    [interviewId]
  );

  // Free Web Speech API Speech-to-Text hook (Zero API Key required)
  const {
    isSupported,
    isListening,
    interimTranscript,
    error: speechError,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    lang: "en-US",
    onFinalTranscript: handleFinalTranscript,
  });

  // Auto-scroll transcript on new messages or interim text
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimTranscript]);

  // Provide initial welcome prompt if chat is empty
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome-prompt",
          sender: "interviewer",
          text: "Welcome to your AI Technical Interview! Please speak clearly into your microphone to introduce yourself, your experience, and the technical projects you've worked on.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [messages.length]);

  // WebRTC Setup for OpenAI Realtime Voice with resilient fallback to Speech STT
  useEffect(() => {
    let isMounted = true;

    async function initWebRTC() {
      let pc: RTCPeerConnection | null = null;
      let ms: MediaStream | null = null;

      try {
        setConnectionStatus("connecting");
        pc = new RTCPeerConnection();
        pcRef.current = pc;

        if (!audioRef.current) {
          audioRef.current = document.createElement("audio");
          audioRef.current.autoplay = true;
        }

        pc.ontrack = (e) => {
          if (audioRef.current && e.streams[0]) {
            audioRef.current.srcObject = e.streams[0];
          }
        };

        pc.onconnectionstatechange = () => {
          if (!pc) return;
          if (pc.connectionState === "connected") {
            setConnectionStatus("connected");
            setSessionMode("voice");
          } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
            setConnectionStatus(mediaStreamRef.current ? "connected" : "disconnected");
            setSessionMode("speech-stt");
          }
        };

        ms = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        // Guard against component unmount or closed peer connection during getUserMedia
        if (!isMounted || !pc || pc.signalingState === "closed") {
          ms.getTracks().forEach((track) => track.stop());
          return;
        }

        mediaStreamRef.current = ms;
        ms.getTracks().forEach((track) => {
          if (pc && pc.signalingState !== "closed") {
            pc.addTrack(track, ms!);
          }
        });

        // Start Web Speech API transcription once mic is ready
        if (isMounted) {
          startListening();
        }

        if (!isMounted || !pc || pc.signalingState === "closed") return;

        const offer = await pc.createOffer();
        if (!isMounted || !pc || pc.signalingState === "closed") return;
        await pc.setLocalDescription(offer);

        const sdpResponse = await fetch(`${BACKEND_URL}/api/v1/session/${interviewId}`, {
          method: "POST",
          body: offer.sdp,
          headers: {
            "Content-Type": "application/sdp",
          },
        });

        if (!isMounted || !pc || pc.signalingState === "closed") return;

        if (!sdpResponse.ok) {
          console.info(`Realtime Voice endpoint returned status ${sdpResponse.status}. Continuing with free Web Speech STT mode.`);
          if (isMounted) {
            setConnectionStatus("connected");
            setSessionMode("speech-stt");
          }
          return;
        }

        const sdpText = await sdpResponse.text();
        if (!isMounted || !pc || pc.signalingState === "closed") return;

        // Verify that the response is actually valid SDP
        if (sdpText && sdpText.trim().startsWith("v=")) {
          const answer = {
            type: "answer" as const,
            sdp: sdpText,
          };
          await pc.setRemoteDescription(answer);
          if (isMounted) {
            setSessionMode("voice");
            setConnectionStatus("connected");
          }
        } else {
          console.info("WebRTC voice optional stream not active. Client running in high-accuracy Web Speech STT mode.");
          if (isMounted) {
            setConnectionStatus("connected");
            setSessionMode("speech-stt");
          }
        }
      } catch (error: any) {
        console.warn("Interview WebRTC notice:", error?.message || error);
        if (isMounted) {
          setConnectionStatus(mediaStreamRef.current ? "connected" : "disconnected");
          setSessionMode("speech-stt");
        }
      }
    }

    if (interviewId) {
      initWebRTC();
    }

    return () => {
      isMounted = false;
      stopListening();
      if (pcRef.current) {
        try {
          if (pcRef.current.signalingState !== "closed") {
            pcRef.current.close();
          }
        } catch (e) {
          // ignore
        }
        pcRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [interviewId, startListening, stopListening]);

  const toggleMute = () => {
    if (mediaStreamRef.current) {
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
      }
    }
    if (!isMuted) {
      stopListening();
    } else {
      startListening();
    }
    setIsMuted(!isMuted);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim() || isSubmitting) return;

    const textToSend = manualText.trim();
    setManualText("");
    setIsSubmitting(true);
    await handleFinalTranscript(textToSend);
    setIsSubmitting(false);
  };

  const endInterview = () => {
    stopListening();
    if (pcRef.current) {
      try {
        if (pcRef.current.signalingState !== "closed") {
          pcRef.current.close();
        }
      } catch (e) {}
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    navigate(`/result/${interviewId}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 md:p-6">
      <audio autoPlay ref={audioRef} className="hidden" />

      <div className="w-full max-w-3xl bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 flex flex-col gap-5">
        {/* Header with Connection & Mic Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <h1 className="text-lg font-bold text-slate-100">Live Technical Interview</h1>
            </div>
            <p className="text-xs text-slate-400">Session ID: {interviewId}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Connection Status Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                connectionStatus === "connected"
                  ? "bg-emerald-950/80 text-emerald-400 border-emerald-800"
                  : connectionStatus === "connecting"
                  ? "bg-amber-950/80 text-amber-400 border-amber-800 animate-pulse"
                  : "bg-rose-950/80 text-rose-400 border-rose-800"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-emerald-400"
                    : connectionStatus === "connecting"
                    ? "bg-amber-400"
                    : "bg-rose-400"
                }`}
              />
              {connectionStatus === "connected"
                ? sessionMode === "voice"
                  ? "Realtime Voice Active"
                  : "Speech STT Active"
                : connectionStatus === "connecting"
                ? "Connecting..."
                : "Disconnected"}
            </span>

            {/* Listening Indicator */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                isListening && !isMuted
                  ? "bg-blue-950/80 text-blue-400 border-blue-800"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              <Radio className={`w-3 h-3 ${isListening && !isMuted ? "text-blue-400 animate-pulse" : "text-slate-500"}`} />
              {isListening && !isMuted ? "Transcribing Speech" : "Mic Muted"}
            </span>
          </div>
        </div>

        {!isSupported && (
          <div className="p-3 bg-amber-950/80 border border-amber-800 rounded-lg text-amber-200 text-xs">
            Notice: Web Speech recognition is best experienced in Chrome, Edge, or Safari.
          </div>
        )}

        {speechError && (
          <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-lg text-rose-200 text-xs">
            {speechError}
          </div>
        )}

        {/* Live Transcript / Speech Log */}
        <div className="flex-1 min-h-[280px] max-h-[380px] overflow-y-auto bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] rounded-xl px-4 py-2.5 text-sm transition-all ${
                msg.sender === "candidate"
                  ? "self-end bg-blue-600 text-white shadow-md"
                  : "self-start bg-slate-800/90 border border-slate-700 text-slate-200 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between gap-3 text-[10px] opacity-75 mb-1">
                <span className="font-semibold">
                  {msg.sender === "candidate" ? "You (Spoken Response)" : "AI Technical Interviewer"}
                </span>
                <span>{msg.timestamp}</span>
              </div>
              <p className="leading-relaxed">{msg.text}</p>
            </div>
          ))}

          {/* Real-time interim transcript preview */}
          {interimTranscript && (
            <div className="self-end bg-blue-600/40 border border-blue-400/30 text-blue-100 italic max-w-[85%] rounded-xl px-4 py-2.5 text-sm animate-pulse">
              <span className="text-[10px] opacity-75 block mb-1">Transcribing your voice...</span>
              <p>{interimTranscript}</p>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Text Input Option for Supplementary Answers */}
        <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Speak into microphone or type supplementary response..."
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!manualText.trim() || isSubmitting}
            className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl transition-all"
            title="Send response"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Action Controls & Live Audio Visualizer */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleMute}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-xs transition-colors ${
                isMuted
                  ? "bg-amber-600 hover:bg-amber-500 text-white"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isMuted ? "Unmute Mic" : "Mute Mic"}</span>
            </button>

            <AudioVisualizer stream={mediaStreamRef.current} isActive={isListening && !isMuted} />
          </div>

          <button
            onClick={endInterview}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-xs bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg shadow-rose-950/50"
          >
            <LogOut className="w-4 h-4" />
            <span>End Interview & Evaluate</span>
          </button>
        </div>
      </div>
    </div>
  );
}