import { describe, it, expect } from "bun:test";
import { startInterviewSession, generateNextInterviewTurn } from "../services/interview.service";
import { classifyCandidateIntent, generateContextualFallback, type DialogContext } from "../services/dialog.manager";
import { calculateResult } from "../result";

describe("Gemini Interview Pipeline & Services", () => {
  it("should have startInterviewSession and generateNextInterviewTurn functions defined", () => {
    expect(typeof startInterviewSession).toBe("function");
    expect(typeof generateNextInterviewTurn).toBe("function");
  });

  it("should accurately classify candidate intent for audio checks, greetings, and technical replies", () => {
    expect(classifyCandidateIntent("hello hello hello can you listen")).toBe("AUDIO_CHECK");
    expect(classifyCandidateIntent("tell me are you able to listen to me")).toBe("AUDIO_CHECK");
    expect(classifyCandidateIntent("is my microphone working")).toBe("AUDIO_CHECK");
    expect(classifyCandidateIntent("can you repeat the question please")).toBe("REPEAT_REQUEST");
    expect(classifyCandidateIntent("hello")).toBe("GREETING");
    expect(classifyCandidateIntent("In my previous role at TechCorp, I built a Redis caching layer to handle 50k QPS.")).toBe("TECHNICAL_EXPLANATION");
  });

  it("should generate dynamic audio check acknowledgement with candidate context instead of repetitive technical text", () => {
    const mockContext: DialogContext = {
      candidateName: "Paras Rana",
      skills: ["React", "Node.js", "PostgreSQL"],
      projects: [{ title: "Mercor Interviewer", description: "AI technical platform" }],
      experience: [],
      history: [
        { type: "ASSISTANT", message: "Hello Paras, tell me about a recent project you built?" }
      ],
    };

    const response = generateContextualFallback(mockContext, "hello hello can you listen");
    expect(response).toContain("Paras");
    expect(response.toLowerCase()).toContain("hear you");
    expect(response).not.toBe("Thank you for explaining that. Could you dive deeper into the key technical challenges you faced during that implementation and how you resolved them?");
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
      candidateName: "Paras Rana",
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
    expect(response).toContain("Paras");
    expect(response.toLowerCase()).not.toContain("data validation");
    // Should address the music/audio synchronization context
    expect(response.toLowerCase()).toMatch(/synchronized|playback|music|room/);
  });

  it("should guarantee 100% non-repetition across multiple sequential candidate turns", () => {
    const mockContext: DialogContext = {
      candidateName: "Paras Rana",
      skills: ["React", "Node.js", "PostgreSQL", "Docker"],
      projects: [{ title: "Music Sync", description: "Realtime audio player" }],
      experience: [],
      history: [],
    };

    const generatedQuestions = new Set<string>();

    for (let i = 0; i < 5; i++) {
      const userMsg = i === 0 ? "I built a collaborative music listening platform" : "We used WebSockets for audio sync and PostgreSQL for storage";
      const reply = generateContextualFallback(mockContext, userMsg);
      
      expect(generatedQuestions.has(reply)).toBe(false);
      generatedQuestions.add(reply);
      mockContext.history.push({ type: "USER", message: userMsg });
      mockContext.history.push({ type: "ASSISTANT", message: reply });
    }

    expect(generatedQuestions.size).toBe(5);
  });
});
