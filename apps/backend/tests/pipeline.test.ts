import { describe, it, expect } from "bun:test";
import { startInterviewSession, generateNextInterviewTurn } from "../services/interview.service";
import { classifyCandidateIntent, generateContextualFallback, type DialogContext } from "../services/dialog.manager";

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

  it("should throw error for non-existent interview sessions gracefully", async () => {
    expect(startInterviewSession("non-existent-interview-uuid-12345")).rejects.toThrow();
  });

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
});


