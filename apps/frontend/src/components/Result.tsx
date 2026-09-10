import { BACKEND_URL } from "@/lib/config";
import axios from "axios";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";

interface TranscriptItem {
  type: "ASSISTANT" | "USER" | "Assistant" | "User";
  content: string;
  createdAt: string | Date;
}

interface ResultData {
  transcript: TranscriptItem[];
  score: number;
  feedback: string;
  status: "DONE" | "INPROGRESS" | "PRE";
}

export function Result() {
  const { interviewId } = useParams<{ interviewId: string }>();

  const [result, setResult] = useState<ResultData>({
    score: 0,
    feedback: "",
    transcript: [],
    status: "PRE",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let intervalId: any = null;

    const fetchResult = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/v1/result/${interviewId}`);
        const data = response.data;
        setResult(data);

        if (data.status === "DONE" || (data.score > 0 && data.feedback)) {
          setLoading(false);
          if (intervalId) clearInterval(intervalId);
        }
      } catch (err) {
        console.error("Failed to fetch interview result:", err);
      }
    };

    fetchResult();
    intervalId = setInterval(fetchResult, 3000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [interviewId]);

  // Safe date comparison function
  const sortedTranscript = [...(result.transcript || [])].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime() || 0;
    const timeB = new Date(b.createdAt).getTime() || 0;
    return timeA - timeB;
  });

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-emerald-400 border-emerald-500/30 bg-emerald-950/40";
    if (score >= 5) return "text-amber-400 border-amber-500/30 bg-amber-950/40";
    return "text-rose-400 border-rose-500/30 bg-rose-950/40";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Interview Evaluation & Report</h1>
            <p className="text-xs text-slate-400 mt-1">Session: {interviewId}</p>
          </div>
          <Link
            to="/"
            className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
          >
            Start New Interview
          </Link>
        </div>

        {/* Loading State while Gemini evaluates */}
        {loading && result.status !== "DONE" && !result.feedback ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-300 font-medium">Generating AI evaluation & scoring...</p>
            <p className="text-xs text-slate-500">Analyzing speech transcript and candidate responses.</p>
          </div>
        ) : (
          <>
            {/* Score & Summary Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`flex flex-col items-center justify-center p-6 rounded-xl border ${getScoreColor(result.score)}`}>
                <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Overall Score</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-5xl font-extrabold">{result.score}</span>
                  <span className="text-sm font-medium opacity-60">/ 10</span>
                </div>
              </div>

              <div className="md:col-span-2 bg-slate-950/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">AI Evaluator Feedback</span>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {result.feedback || "Detailed feedback is being computed."}
                </p>
              </div>
            </div>

            {/* Conversation Transcript Breakdown */}
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Interview Conversation Transcript ({sortedTranscript.length} entries)
              </h2>

              <div className="max-h-[350px] overflow-y-auto bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                {sortedTranscript.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No transcript entries recorded.</p>
                ) : (
                  sortedTranscript.map((item, idx) => {
                    const isCandidate = item.type.toUpperCase() === "USER";
                    return (
                      <div
                        key={idx}
                        className={`flex flex-col rounded-xl px-4 py-3 text-sm max-w-[85%] ${
                          isCandidate
                            ? "self-end bg-blue-600/90 text-white"
                            : "self-start bg-slate-800 border border-slate-700 text-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-1 text-[11px] opacity-75">
                          <span className="font-semibold">{isCandidate ? "Candidate (Spoken Speech)" : "AI Technical Interviewer"}</span>
                          <span>{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="leading-snug">{item.content}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}