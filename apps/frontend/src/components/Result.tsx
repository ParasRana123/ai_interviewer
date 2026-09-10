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
  const [copied, setCopied] = useState(false);

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

  const candidateTurns = sortedTranscript.filter(t => t.type.toUpperCase() === "USER").length;
  const aiTurns = sortedTranscript.filter(t => t.type.toUpperCase() === "ASSISTANT").length;

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-emerald-400 border-emerald-500/30 bg-emerald-950/40";
    if (score >= 5) return "text-amber-400 border-amber-500/30 bg-amber-950/40";
    return "text-rose-400 border-rose-500/30 bg-rose-950/40";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return "Strong Hire / Exceptional";
    if (score >= 6) return "Meets Bar / Recommended";
    if (score >= 4) return "Borderline / Needs Follow-up";
    return "Needs Improvement";
  };

  const handleCopyTranscript = () => {
    const text = sortedTranscript
      .map((item) => {
        const role = item.type.toUpperCase() === "USER" ? "Candidate" : "Interviewer";
        return `[${new Date(item.createdAt).toLocaleTimeString()}] ${role}:\n${item.content}\n`;
      })
      .join("\n");

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `interview-${interviewId}-report.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportMarkdown = () => {
    let md = `# Technical Interview Evaluation Report\n\n`;
    md += `- **Interview ID:** \`${interviewId}\`\n`;
    md += `- **Overall Score:** ${result.score} / 10 (${getScoreLabel(result.score)})\n`;
    md += `- **Status:** ${result.status}\n\n`;
    md += `## Evaluator Feedback\n\n${result.feedback}\n\n`;
    md += `## Conversation Transcript\n\n`;
    sortedTranscript.forEach((t) => {
      const speaker = t.type.toUpperCase() === "USER" ? "Candidate (Speech)" : "AI Interviewer (Gemini)";
      md += `### ${speaker} - *${new Date(t.createdAt).toLocaleTimeString()}*\n`;
      md += `${t.content}\n\n`;
    });

    const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(md);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `interview-${interviewId}-transcript.md`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <h1 className="text-2xl font-bold text-slate-100">Interview Evaluation & Report</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">Session ID: <span className="font-mono text-slate-300">{interviewId}</span></p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg shadow-blue-500/20"
            >
              + Start New Interview
            </Link>
          </div>
        </div>

        {/* Loading State while Gemini evaluates */}
        {loading && result.status !== "DONE" && !result.feedback ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-200 font-semibold text-base">Generating Comprehensive Evaluation...</p>
            <p className="text-xs text-slate-400 max-w-md text-center">
              Google Gemini is analyzing the dialogue turns, candidate answers, clarity, and technical competence.
            </p>
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
                <span className="text-xs font-medium mt-2 px-2.5 py-0.5 rounded-full bg-slate-900/60 border border-slate-700/50">
                  {getScoreLabel(result.score)}
                </span>
              </div>

              <div className="md:col-span-2 bg-slate-950/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">AI Evaluator Feedback</span>
                    <span className="text-[11px] text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-900/50">Gemini 3.6 Flash</span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {result.feedback || "Detailed feedback is being computed."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Spoken Turns</span>
                    <span className="text-slate-200 font-medium">{candidateTurns} Candidate / {aiTurns} AI</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Transcript Count</span>
                    <span className="text-slate-200 font-medium">{sortedTranscript.length} Dialogue Logs</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Conversation Transcript Section */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Conversation Transcript ({sortedTranscript.length} entries)
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyTranscript}
                    className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
                  >
                    {copied ? "Copied!" : "Copy Text"}
                  </button>
                  <button
                    onClick={handleExportMarkdown}
                    className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
                  >
                    Export .MD
                  </button>
                  <button
                    onClick={handleExportJSON}
                    className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
                  >
                    Export .JSON
                  </button>
                </div>
              </div>

              <div className="max-h-[380px] overflow-y-auto bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
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
                            ? "self-end bg-blue-600 text-white shadow-md shadow-blue-950/50"
                            : "self-start bg-slate-800 border border-slate-700 text-slate-200 shadow-md shadow-slate-950/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-1 text-[11px] opacity-75">
                          <span className="font-semibold">{isCandidate ? "Candidate (Voice Input)" : "AI Technical Interviewer"}</span>
                          <span>{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="leading-snug whitespace-pre-wrap">{item.content}</p>
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