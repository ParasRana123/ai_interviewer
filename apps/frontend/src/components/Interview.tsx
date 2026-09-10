import { useParams, useNavigate } from "react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { BACKEND_URL } from "@/lib/config";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import axios from "axios";
import {
  Mic,
  MicOff,
  Sparkles,
  Send,
  LogOut,
  Radio,
  Volume2,
  VolumeX,
  RotateCcw,
  Bot,
  User,
  Loader2,
  CheckCircle2,
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
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [candidateInfo, setCandidateInfo] = useState<{
    name: string;
    skills: string[];
    education?: any;
    projects?: any;
    codingProfiles?: any;
  } | null>(null);
  const [manualText, setManualText] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isAiVoiceMuted, setIsAiVoiceMuted] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Speech Synthesis Hook for AI Voice responses
  const {
    isSupported: isTtsSupported,
    isSpeaking: isAiSpeaking,
    speak,
    cancel: cancelSpeech,
  } = useSpeechSynthesis({
    rate: 1.05,
    pitch: 1.0,
  });

  // Function to send user answer to backend and receive Gemini response
  const sendCandidateAnswer = useCallback(
    async (text: string) => {
      const cleanText = text.trim();
      if (!cleanText || !interviewId || isAiThinking) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        sender: "candidate",
        text: cleanText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsAiThinking(true);

      try {
        const response = await axios.post(`${BACKEND_URL}/api/v1/interview/respond/${interviewId}`, {
          message: cleanText,
        });

        const reply = response.data?.reply;
        if (reply) {
          const aiMsg: ChatMessage = {
            id: response.data?.id || `ai-${Date.now()}`,
            sender: "interviewer",
            text: reply,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          };
          setMessages((prev) => [...prev, aiMsg]);

          // Speak AI response out loud if not muted
          if (!isAiVoiceMuted) {
            speak(reply);
          }
        }
      } catch (err: any) {
        console.error("Failed to generate AI interview response:", err);
      } finally {
        setIsAiThinking(false);
      }
    },
    [interviewId, isAiThinking, isAiVoiceMuted, speak]
  );

  // Web Speech API Hook for microphone speech transcription
  const {
    isSupported: isSttSupported,
    isListening,
    interimTranscript,
    error: speechError,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    lang: "en-US",
    onFinalTranscript: sendCandidateAnswer,
  });

  // Turn-taking coordination: Pause STT when AI is speaking to prevent speaker echo feedback
  useEffect(() => {
    if (isAiSpeaking) {
      stopListening();
    } else if (!isMuted && isInitialized && connectionStatus === "connected") {
      // Add a slight delay after speech finishes before unmuting mic to avoid tail audio echo
      const timer = setTimeout(() => {
        if (!isMuted && !isAiSpeaking) {
          startListening();
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isAiSpeaking, isMuted, isInitialized, connectionStatus, startListening, stopListening]);

  // Auto-scroll transcript container
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimTranscript]);

  // Initialize Microphone Media Stream and Start Session
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        setConnectionStatus("connecting");

        // 1. Acquire microphone stream for live AudioVisualizer
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (isMounted) {
            mediaStreamRef.current = stream;
            startListening();
          } else {
            stream.getTracks().forEach((t) => t.stop());
          }
        } catch (micErr) {
          console.warn("Microphone access notice:", micErr);
        }

        // 2. Fetch detailed interview profile
        if (interviewId) {
          try {
            const detailsRes = await axios.get(`${BACKEND_URL}/api/v1/interview/details/${interviewId}`);
            if (isMounted && detailsRes.data?.interview) {
              setCandidateInfo(detailsRes.data.interview);
            }
          } catch (detailsErr) {
            console.warn("Details fetch notice:", detailsErr);
          }

          // 3. Start Gemini interview session on backend
          const startRes = await axios.post(`${BACKEND_URL}/api/v1/interview/start/${interviewId}`);
          if (isMounted && startRes.data?.success) {
            const initialGreeting = startRes.data.message;
            setCandidateInfo((prev) => ({
              name: startRes.data.candidateName || prev?.name || "Candidate",
              skills: startRes.data.skills || prev?.skills || [],
              ...prev,
            }));

            const initialMsg: ChatMessage = {
              id: startRes.data.id || "initial-ai-msg",
              sender: "interviewer",
              text: initialGreeting,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            setMessages([initialMsg]);
            setConnectionStatus("connected");
            setIsInitialized(true);

            // Speak greeting out loud
            speak(initialGreeting);
          }
        }
      } catch (err) {
        console.error("Interview session initialization error:", err);
        if (isMounted) {
          setConnectionStatus("connected"); // Still allow manual chat
        }
      }
    }

    if (interviewId && !isInitialized) {
      initSession();
    }

    return () => {
      isMounted = false;
      stopListening();
      cancelSpeech();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [interviewId, isInitialized, startListening, stopListening, speak, cancelSpeech]);

  const toggleMuteMic = () => {
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

  const toggleAiVoice = () => {
    if (!isAiVoiceMuted) {
      cancelSpeech();
    }
    setIsAiVoiceMuted(!isAiVoiceMuted);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim() || isAiThinking) return;

    const textToSend = manualText.trim();
    setManualText("");
    await sendCandidateAnswer(textToSend);
  };

  const endInterview = () => {
    stopListening();
    cancelSpeech();
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    navigate(`/result/${interviewId}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-3xl bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 flex flex-col gap-5">
        {/* Header with Connection & Status Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <h1 className="text-lg font-bold text-slate-100">AI Technical Interview</h1>
              {candidateInfo?.name && (
                <span className="text-xs text-slate-400 font-normal">
                  • Candidate: {candidateInfo.name}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">Session ID: {interviewId}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* AI Engine Badge */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-950/80 text-blue-300 border border-blue-800">
              <Bot className="w-3 h-3 text-blue-400" />
              <span>Gemini 3.6 Flash (100% Free)</span>
            </span>

            {/* Connection Status */}
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
              {connectionStatus === "connected" ? "Live Voice Session" : "Connecting..."}
            </span>

            {/* AI Voice Toggle */}
            <button
              onClick={toggleAiVoice}
              title={isAiVoiceMuted ? "Unmute AI Voice" : "Mute AI Voice"}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                isAiVoiceMuted
                  ? "bg-slate-800 text-slate-400 border-slate-700"
                  : "bg-blue-950 text-blue-300 border-blue-800"
              }`}
            >
              {isAiVoiceMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Candidate Skills Pills & Profile Insights */}
        {candidateInfo?.skills && candidateInfo.skills.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-1 py-0.5 -mt-2">
            <span className="text-[11px] text-slate-500 font-medium mr-1">Evaluated Skills:</span>
            {candidateInfo.skills.slice(0, 6).map((skill, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60"
              >
                {skill}
              </span>
            ))}
          </div>
        )}

        {/* Live Transcript / Speech Log */}
        <div className="flex-1 min-h-[300px] max-h-[380px] overflow-y-auto bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] rounded-xl px-4 py-3 text-sm transition-all ${
                msg.sender === "candidate"
                  ? "self-end bg-blue-600 text-white shadow-md"
                  : "self-start bg-slate-800/90 border border-slate-700 text-slate-200 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between gap-3 text-[11px] opacity-75 mb-1.5">
                <div className="flex items-center gap-1.5 font-semibold">
                  {msg.sender === "candidate" ? (
                    <>
                      <User className="w-3 h-3" />
                      <span>You (Candidate)</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-3 h-3 text-blue-400" />
                      <span>AI Technical Interviewer</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span>{msg.timestamp}</span>
                  {msg.sender === "interviewer" && isTtsSupported && (
                    <button
                      onClick={() => speak(msg.text)}
                      title="Replay speech audio"
                      className="p-1 hover:bg-slate-700 rounded transition-colors opacity-80 hover:opacity-100"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <p className="leading-relaxed">{msg.text}</p>
            </div>
          ))}

          {/* AI Thinking Indicator */}
          {isAiThinking && (
            <div className="self-start bg-slate-800/80 border border-slate-700 text-slate-300 rounded-xl px-4 py-2.5 text-xs flex items-center gap-2 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
              <span>AI Interviewer is formulating feedback & next question...</span>
            </div>
          )}

          {/* AI Speaking Live Indicator with Interrupt Button */}
          {isAiSpeaking && (
            <div className="self-start bg-blue-950/70 border border-blue-800/80 text-blue-200 rounded-xl px-4 py-2 text-xs flex items-center justify-between gap-3 w-full max-w-md animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5 text-blue-400 animate-bounce" />
                <span className="font-medium">AI Interviewer is speaking...</span>
                <span className="flex items-center gap-0.5">
                  <span className="w-1 h-2 bg-blue-400 animate-pulse" />
                  <span className="w-1 h-3.5 bg-blue-300 animate-pulse delay-75" />
                  <span className="w-1 h-2.5 bg-blue-400 animate-pulse delay-150" />
                  <span className="w-1 h-4 bg-blue-300 animate-pulse delay-100" />
                </span>
              </div>
              <button
                onClick={cancelSpeech}
                className="px-2 py-1 bg-blue-800/60 hover:bg-blue-700 text-[11px] font-medium rounded-lg text-white transition-colors"
              >
                Interrupt AI
              </button>
            </div>
          )}

          {/* Real-time Interim Candidate Speech */}
          {interimTranscript && (
            <div className="self-end bg-blue-600/40 border border-blue-400/30 text-blue-100 italic max-w-[85%] rounded-xl px-4 py-2.5 text-sm animate-pulse">
              <span className="text-[10px] opacity-75 block mb-1">Transcribing your voice...</span>
              <p>{interimTranscript}</p>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Supplementary Text Input Form */}
        <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Speak into mic or type your answer here..."
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            disabled={isAiThinking}
            className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={!manualText.trim() || isAiThinking}
            className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl transition-all shadow-md shadow-blue-950"
            title="Send response"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Action Controls & Audio Visualizer */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleMuteMic}
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