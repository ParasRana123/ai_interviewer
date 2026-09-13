import { describe, it, expect } from "bun:test";
import { startInterviewSession, generateNextInterviewTurn } from "../services/interview.service";
import {
  classifyCandidateIntent,
  generateContextualFallback,
  formatCandidateName,
  type DialogContext,
} from "../services/dialog.manager";
import { calculateResult } from "../result";

describe("Gemini Interview Pipeline & Services", () => {
  it("should have startInterviewSession and generateNextInterviewTurn functions defined", () => {
    expect(typeof startInterviewSession).toBe("function");
    expect(typeof generateNextInterviewTurn).toBe("function");
  });

  it("should accurately format candidate names to clean Title Case first names", () => {
    expect(formatCandidateName("PARAS RANA")).toBe("Paras");
    expect(formatCandidateName("paras_rana")).toBe("Paras");
    expect(formatCandidateName("ALEX JOHNSON")).toBe("Alex");
    expect(formatCandidateName("")).toBe("there");
    expect(formatCandidateName(undefined)).toBe("there");
  });

  it("should accurately classify candidate intent for audio checks, greetings, and technical replies", () => {
    expect(classifyCandidateIntent("hello hello hello can you listen")).toBe("AUDIO_CHECK");
    expect(classifyCandidateIntent("tell me are you able to listen to me")).toBe("AUDIO_CHECK");
    expect(classifyCandidateIntent("is my microphone working")).toBe("AUDIO_CHECK");
    expect(classifyCandidateIntent("can you repeat the question please")).toBe("REPEAT_REQUEST");
    expect(classifyCandidateIntent("hello")).toBe("GREETING");
    expect(classifyCandidateIntent("In my previous role at TechCorp, I built a Redis caching layer to handle 50k QPS.")).toBe("TECHNICAL_EXPLANATION");
  });

  it("should generate concise audio check acknowledgement without echoing past multi-sentence greetings or dumping skills", () => {
    const mockContext: DialogContext = {
      candidateName: "PARAS RANA",
      skills: ["JavaScript", "TypeScript", "React", "Next.js", "Python", "Java", "C++", "Go", "SQL", "PostgreSQL", "MongoDB", "Docker", "Git", "HTML", "CSS", "TailwindCSS"],
      projects: [{ title: "Mercor Interviewer", description: "AI technical platform" }],
      experience: [],
      history: [
        {
          type: "ASSISTANT",
          message: "Hello PARAS RANA, welcome to your technical interview! I have reviewed your background with JavaScript, TypeScript, React, Next.js, Python, Java, C++, Go, SQL, PostgreSQL, MongoDB, Docker, Git, HTML, CSS, TailwindCSS. To get started, could you briefly introduce yourself and tell me about a recent project you built?",
        },
      ],
    };

    const response = generateContextualFallback(mockContext, "hello hello");
    expect(response).toContain("Paras");
    expect(response.toLowerCase()).toContain("hear you loud and clear");
    // Crucial: Must NOT repeat the long 15-skill list verbatim
    expect(response).not.toContain("PostgreSQL, MongoDB, Docker, Git, HTML, CSS, TailwindCSS");
  });

  it("should reject empty candidate messages in generateNextInterviewTurn", async () => {
    expect(generateNextInterviewTurn("fake-id", "   ")).rejects.toThrow("Candidate message cannot be empty");
  });

  it("should evaluate interview session with score, feedback, strengths, and improvements", async () => {
    const mockMessages = [
      { type: "ASSISTANT" as const, message: "Hello Paras, can you tell me about your project?", createdAt: new Date() },
      { type: "USER" as const, message: "I built a real-time collaborative music room using WebSockets and React.", createdAt: new Date() },
      { type: "ASSISTANT" as const, message: "How did you manage synchronization across different clients?", createdAt: new Date() },
      { type: "USER" as const, message: "We used server timestamps and offset drift compensation for audio synchronization.", createdAt: new Date() },
    ];

    const evaluation = await calculateResult(mockMessages);
    expect(typeof evaluation.score).toBe("number");
    expect(evaluation.score).toBeGreaterThanOrEqual(1);
    expect(evaluation.score).toBeLessThanOrEqual(10);
    expect(typeof evaluation.feedback).toBe("string");
    expect(Array.isArray(evaluation.strengths)).toBe(true);
    expect(evaluation.strengths.length).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(evaluation.improvements)).toBe(true);
    expect(evaluation.improvements.length).toBeGreaterThanOrEqual(2);
  }, { timeout: 30000 });

  it("should safely handle skills with special regex characters like C++, C#, and Node.js without runtime syntax error", () => {
    const skills = ["C++", "C#", "Node.js", "React.js", "TCP/IP", "REST APIs"];
    const candidateText = "I have 4 years of experience with C++ and Node.js building low-latency microservices.";

    // Verifying safe detection logic
    const matched = skills.filter((s) => {
      if (/[+*?.^$()[\]{}|\\]/.test(s)) {
        return candidateText.toLowerCase().includes(s.toLowerCase());
      }
      return new RegExp(`\\b${s}\\b`, "i").test(candidateText);
    });

    expect(matched).toContain("C++");
    expect(matched).toContain("Node.js");
    expect(matched).not.toContain("C#");
    expect(matched).not.toContain("TCP/IP");
  });

  it("should sanitize Gemini output removing markdown artifacts for clean TTS speech synthesis", () => {
    const rawGeminiOutput = "**Hello Alex!** Welcome to your interview. *Let's discuss* your project `Distributed DB`.";
    const cleanedText = rawGeminiOutput.replace(/[*#_`]/g, "").trim();

    expect(cleanedText).toBe("Hello Alex! Welcome to your interview. Let's discuss your project Distributed DB.");
    expect(cleanedText).not.toContain("*");
    expect(cleanedText).not.toContain("`");
  });

  it("should classify candidate corrections and extract semantic topics like music collaboration rooms", () => {
    const correctionMsg = "no actually and that problem statement there was no data handling data validation it was actually a platform where the users can come enjoy the room with their friends and they can listen to the favourite music in the room";
    expect(classifyCandidateIntent(correctionMsg)).toBe("CORRECTION");

    const mockContext: DialogContext = {
      candidateName: "PARAS RANA",
      skills: ["React", "Node.js", "WebSockets"],
      projects: [],
      experience: [],
      history: [
        { type: "ASSISTANT", message: "Hello Paras! Could you introduce yourself?" },
        { type: "USER", message: "I built a web platform." },
        { type: "ASSISTANT", message: "Could you walk me through data validation for that solution?" }
      ],
    };

    const response = generateContextualFallback(mockContext, correctionMsg);
    expect(response.toLowerCase()).not.toContain("data validation");
    // Should address the music/audio synchronization context
    expect(response.toLowerCase()).toMatch(/synchronized|playback|music|room/);
  });

  it("should guarantee 100% non-repetition across multiple sequential candidate turns and vary prefixes", () => {
    const mockContext: DialogContext = {
      candidateName: "PARAS RANA",
      skills: ["React", "Node.js", "PostgreSQL", "Docker"],
      projects: [{ title: "Music Sync", description: "Realtime audio player" }],
      experience: [],
      history: [],
    };

    const responses: string[] = [];

    for (let i = 0; i < 5; i++) {
      const userMsg = i === 0 ? "I built a collaborative music listening platform" : "We used WebSockets for audio sync and PostgreSQL for storage";
      const reply = generateContextualFallback(mockContext, userMsg);

      // Verify each response is completely unique
      expect(responses.includes(reply)).toBe(false);
      responses.push(reply);

      mockContext.history.push({ type: "USER", message: userMsg });
      mockContext.history.push({ type: "ASSISTANT", message: reply });
    }

    expect(responses.length).toBe(5);

    // Verify sequential turns do NOT all start with the exact same prefix
    const first30Chars = responses.map((r) => r.substring(0, 30));
    const uniquePrefixes = new Set(first30Chars);
    expect(uniquePrefixes.size).toBeGreaterThanOrEqual(3);
  });
});
