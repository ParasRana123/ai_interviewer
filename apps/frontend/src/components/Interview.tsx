import { useParams, useNavigate } from "react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { BACKEND_URL } from "@/lib/config";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import axios from "axios";

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

  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);

  // Send user transcript directly to backend session
  const handleFinalTranscript = useCallback(
    async (text: string) => {
      if (!text.trim() || !interviewId) return;

      const newMsg: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        sender: "candidate",
        text: text.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };
      setMessages((prev) => [...prev, newMsg]);

      try {
        await axios.post(`${BACKEND_URL}/api/v1/session1/${interviewId}`, {
          message: text.trim(),
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

  // WebRTC Setup for OpenAI Realtime Voice
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
          } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
            setConnectionStatus("disconnected");
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
          console.warn(`Realtime session endpoint responded with ${sdpResponse.status}: ${sdpResponse.statusText}`);
          if (isMounted) {
            setConnectionStatus("connected"); // STT speech mode active
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
        } else {
          console.warn("Server returned non-SDP payload for WebRTC session, using speech transcription mode:", sdpText);
          if (isMounted) {
            setConnectionStatus("connected");
          }
        }
      } catch (error: any) {
        console.warn("Interview WebRTC notice:", error?.message || error);
        if (isMounted) {
          // If microphone is active and Speech STT is working, consider session connected for interview
          setConnectionStatus(mediaStreamRef.current ? "connected" : "disconnected");
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

  const endInterview = () => {
    stopListening();
    if (pcRef.current) {
      pcRef.current.close();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    navigate(`/result/${interviewId}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <audio autoPlay ref={audioRef} className="hidden" />

      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-6">
        {/* Header with Connection & Mic Status */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100">Live AI Interview Session</h1>
            <p className="text-xs text-slate-400 mt-1">Session ID: {interviewId}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                connectionStatus === "connected"
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                  : connectionStatus === "connecting"
                  ? "bg-amber-950 text-amber-400 border border-amber-800 animate-pulse"
                  : "bg-rose-950 text-rose-400 border border-rose-800"
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
              {connectionStatus === "connected" ? "Connected" : connectionStatus === "connecting" ? "Connecting..." : "Disconnected"}
            </span>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                isListening
                  ? "bg-blue-950 text-blue-400 border border-blue-800"
                  : "bg-slate-800 text-slate-400 border border-slate-700"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isListening ? "bg-blue-400 animate-ping" : "bg-slate-500"}`} />
              {isListening ? "Speech STT Active (Free)" : "Mic Inactive"}
            </span>
          </div>
        </div>

        {!isSupported && (
          <div className="p-3 bg-amber-950/80 border border-amber-800 rounded-lg text-amber-200 text-sm">
            Note: Speech recognition is best experienced in Chrome, Edge, or Safari.
          </div>
        )}

        {speechError && (
          <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-lg text-rose-200 text-sm">
            {speechError}
          </div>
        )}

        {/* Live Transcript / Speech Log */}
        <div className="flex-1 min-h-[300px] max-h-[400px] overflow-y-auto bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3">
          {messages.length === 0 && !interimTranscript && (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm py-12">
              <p>The AI Interviewer will speak first to introduce the session.</p>
              <p className="mt-1 text-xs text-slate-600">Your spoken answers will be transcribed and evaluated in real-time.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                msg.sender === "candidate"
                  ? "self-end bg-blue-600 text-white"
                  : "self-start bg-slate-800 text-slate-200"
              }`}
            >
              <span className="text-[10px] opacity-75 mb-1">
                {msg.sender === "candidate" ? "You (Spoken)" : "Interviewer"} • {msg.timestamp}
              </span>
              <p>{msg.text}</p>
            </div>
          ))}

          {/* Real-time interim transcript preview */}
          {interimTranscript && (
            <div className="self-end bg-blue-600/50 border border-blue-400/30 text-blue-100 italic max-w-[80%] rounded-xl px-4 py-2.5 text-sm animate-pulse">
              <span className="text-[10px] opacity-75 block mb-1">Listening...</span>
              <p>{interimTranscript}</p>
            </div>
          )}
        </div>

        {/* Action Controls & Live Audio Visualizer */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleMute}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                isMuted
                  ? "bg-amber-600 hover:bg-amber-500 text-white"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200"
              }`}
            >
              {isMuted ? "Unmute Microphone" : "Mute Microphone"}
            </button>

            <AudioVisualizer stream={mediaStreamRef.current} isActive={isListening && !isMuted} />
          </div>

          <button
            onClick={endInterview}
            className="px-5 py-2 rounded-lg font-medium text-sm bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-lg shadow-rose-950"
          >
            End Interview & View Results
          </button>
        </div>
      </div>
    </div>
  );
}