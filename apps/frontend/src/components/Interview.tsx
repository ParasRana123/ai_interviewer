import { useParams, useNavigate } from "react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { BACKEND_URL } from "@/lib/config";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";
import { AiCallTile } from "@/components/AiCallTile";
import { UserCallTile } from "@/components/UserCallTile";
import { LiveCaptionsStrip } from "@/components/LiveCaptionsStrip";
import { CallControlsBar } from "@/components/CallControlsBar";
import { InCallChatDrawer } from "@/components/InCallChatDrawer";
import axios from "axios";
import { Sparkles, Bot, User, Radio, ShieldCheck } from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "candidate" | "interviewer";
  text: string;
  timestamp: string;
  intent?: string;
}

export function Interview() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

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
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);

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
        const response = await axios.post(
          `${BACKEND_URL}/api/v1/interview/respond/${interviewId}`,
          { message: cleanText },
          { timeout: 45000 }
        );

        const reply = response.data?.reply;
        if (reply) {
          const aiMsg: ChatMessage = {
            id: response.data?.id || `ai-${Date.now()}`,
            sender: "interviewer",
            text: reply,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            intent: response.data?.intent,
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
    liveTranscript,
    error: speechError,
    startListening,
    stopListening,
    commitTranscript,
    resetTranscript,
  } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    lang: "en-US",
    silenceTimeoutMs: 1800,
    onFinalTranscript: sendCandidateAnswer,
  });

  // Turn-taking coordination: Pause STT when AI is speaking to prevent speaker echo feedback
  useEffect(() => {
    if (isAiSpeaking) {
      stopListening();
    } else if (!isMuted && isInitialized && connectionStatus === "connected") {
      const timer = setTimeout(() => {
        if (!isMuted && !isAiSpeaking) {
          startListening();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isAiSpeaking, isMuted, isInitialized, connectionStatus, startListening, stopListening]);

  // Initialize Microphone Media Stream and Start Session
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        setConnectionStatus("connecting");

        // 1. Acquire microphone stream for live User audio wave visualizer
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (isMounted) {
            mediaStreamRef.current = stream;
            setAudioStream(stream);
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
          setConnectionStatus("connected");
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

  // Toggle candidate microphone
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

  // Toggle AI speaker voice
  const toggleAiVoice = () => {
    if (!isAiVoiceMuted) {
      cancelSpeech();
    }
    setIsAiVoiceMuted(!isAiVoiceMuted);
  };

  // Replay last AI statement
  const handleReplayQuestion = () => {
    const lastAiMsg = [...messages].reverse().find((m) => m.sender === "interviewer");
    if (lastAiMsg && lastAiMsg.text) {
      speak(lastAiMsg.text);
    }
  };

  // Manual text submission fallback in drawer
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim() || isAiThinking) return;

    const textToSend = manualText.trim();
    setManualText("");
    resetTranscript();
    await sendCandidateAnswer(textToSend);
  };

  // End the live call and navigate to detailed report / evaluation dashboard
  const endInterview = () => {
    stopListening();
    cancelSpeech();
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    navigate(`/result/${interviewId}`);
  };

  const lastAiMessage = [...messages].reverse().find((m) => m.sender === "interviewer")?.text || "";
  const candidateTurnsCount = messages.filter((m) => m.sender === "candidate").length;

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-3 sm:p-5 md:p-6 select-none overflow-x-hidden">
      {/* Top Header Bar */}
      <header className="w-full max-w-6xl flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl px-4 py-3 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-950">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-100">Live AI Technical Interview</h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-950 text-blue-300 border border-blue-800">
                Gemini 3.6 Flash
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {candidateInfo?.name ? `Candidate: ${candidateInfo.name}` : "Real-Time AI Voice Assessment"}
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2 sm:gap-3">
          {candidateInfo?.skills && candidateInfo.skills.length > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
              <span className="text-[11px] text-slate-400 font-medium">Domain:</span>
              <span className="text-[11px] text-blue-300 font-semibold">{candidateInfo.skills.slice(0, 3).join(", ")}</span>
            </div>
          )}

          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border ${
              connectionStatus === "connected"
                ? "bg-emerald-950/80 text-emerald-400 border-emerald-800/80 shadow-sm shadow-emerald-950"
                : "bg-amber-950/80 text-amber-400 border-amber-800/80 animate-pulse"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus === "connected" ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            <span>{connectionStatus === "connected" ? "HD Voice Connected" : "Connecting Call..."}</span>
          </div>
        </div>
      </header>

      {/* Main Calling Stage: 2-Tile Video/Voice Call Grid */}
      <main className="w-full max-w-6xl flex-1 flex flex-col justify-center my-4 gap-4">
        {/* Avatars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Tile 1: AI Senior Technical Interviewer */}
          <AiCallTile
            isSpeaking={isAiSpeaking}
            isThinking={isAiThinking}
            isVoiceMuted={isAiVoiceMuted}
            onToggleVoiceMute={toggleAiVoice}
            onReplaySpeech={handleReplayQuestion}
            lastAiMessage={lastAiMessage}
          />

          {/* Tile 2: Candidate (User) */}
          <UserCallTile
            candidateName={candidateInfo?.name || "Candidate"}
            isMuted={isMuted}
            isListening={isListening}
            audioStream={audioStream}
            onToggleMute={toggleMuteMic}
            turnsCount={candidateTurnsCount}
            liveTranscript={liveTranscript}
          />
        </div>

        {/* Real-time Subtitles / Live Captions Strip */}
        <LiveCaptionsStrip
          isAiSpeaking={isAiSpeaking}
          isAiThinking={isAiThinking}
          isCandidateSpeaking={Boolean(liveTranscript && liveTranscript.trim().length > 0)}
          currentAiText={lastAiMessage}
          liveCandidateTranscript={liveTranscript}
          candidateName={candidateInfo?.name || "You"}
        />
      </main>

      {/* Bottom Floating Call Controls Toolbar */}
      <footer className="w-full max-w-6xl">
        <CallControlsBar
          isMuted={isMuted}
          isAiVoiceMuted={isAiVoiceMuted}
          onToggleMute={toggleMuteMic}
          onToggleAiVoice={toggleAiVoice}
          onReplayQuestion={handleReplayQuestion}
          onEndCall={endInterview}
          onToggleChatDrawer={() => setIsChatDrawerOpen(!isChatDrawerOpen)}
          isChatDrawerOpen={isChatDrawerOpen}
          liveTranscript={liveTranscript}
          onManualCommitTranscript={commitTranscript}
          isAiThinking={isAiThinking}
        />
      </footer>

      {/* Fallback In-Call Text Chat Drawer */}
      <InCallChatDrawer
        isOpen={isChatDrawerOpen}
        onClose={() => setIsChatDrawerOpen(false)}
        messages={messages}
        manualText={manualText}
        setManualText={setManualText}
        onSendMessage={handleManualSubmit}
        isAiThinking={isAiThinking}
      />
    </div>
  );
}