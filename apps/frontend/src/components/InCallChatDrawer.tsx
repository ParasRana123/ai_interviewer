import React, { useEffect, useRef } from "react";
import { X, Send, Bot, User, Sparkles } from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "candidate" | "interviewer";
  text: string;
  timestamp: string;
  intent?: string;
}

interface InCallChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  manualText: string;
  setManualText: (text: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
  isAiThinking: boolean;
}

export function InCallChatDrawer({
  isOpen,
  onClose,
  messages,
  manualText,
  setManualText,
  onSendMessage,
  isAiThinking,
}: InCallChatDrawerProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, messages]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-slate-900/98 backdrop-blur-xl border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-bold text-slate-100">In-Call Dialogue & Notes</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-xs text-slate-500 gap-2">
            <Bot className="w-8 h-8 text-slate-600" />
            <p>No messages yet. Speak or type to begin your interview.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[90%] rounded-2xl p-3 text-xs leading-relaxed ${
                msg.sender === "candidate"
                  ? "self-end bg-blue-600 text-white shadow-md shadow-blue-950/40"
                  : "self-start bg-slate-800/90 text-slate-200 border border-slate-700/80 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1 opacity-75 text-[10px]">
                <div className="flex items-center gap-1 font-semibold">
                  {msg.sender === "candidate" ? (
                    <>
                      <User className="w-2.5 h-2.5" />
                      <span>You</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-2.5 h-2.5 text-blue-400" />
                      <span>AI Interviewer</span>
                    </>
                  )}
                </div>
                <span>{msg.timestamp}</span>
              </div>
              <p>{msg.text}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={onSendMessage} className="p-4 border-t border-slate-800 flex items-center gap-2 bg-slate-950/60">
        <input
          type="text"
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder="Type message if mic is unavailable..."
          disabled={isAiThinking}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!manualText.trim() || isAiThinking}
          className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl transition-colors shadow-md shadow-blue-950"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
