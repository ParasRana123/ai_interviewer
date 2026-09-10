import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "../prisma/db";
import {
  classifyCandidateIntent,
  generateContextualFallback,
  type DialogContext,
} from "./dialog.manager";

function getGenerativeModel() {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const genai = new GoogleGenerativeAI(apiKey);
  return genai.getGenerativeModel({
    model: "gemini-3.6-flash",
  });
}

/**
 * Executes a Gemini model call with exponential backoff retry for transient rate limits
 */
async function generateWithRetry(prompt: string, maxRetries = 1): Promise<string | null> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const model = getGenerativeModel();
      const result = await model.generateContent(prompt);
      const text = result.response.text()?.trim();
      if (text) {
        return text.replace(/[*#_`]/g, "").trim();
      }
      return null;
    } catch (err: any) {
      attempt++;
      const isDailyQuota = err?.message?.includes("Quota exceeded") || err?.message?.includes("free_tier_requests");
      const isRateLimit = err?.message?.includes("429") || err?.status === 429;

      if (isDailyQuota) {
        // Daily limit reached (e.g. 20 req/day on free tier) - immediately use adaptive NLU engine
        console.log("ℹ️ [Gemini API Note]: Daily Free Tier quota limit reached. Using Dynamic Adaptive NLU Engine.");
        return null;
      }

      if (isRateLimit && attempt <= maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 400;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      console.warn("ℹ️ [Gemini Generation Notice]:", err?.message?.substring(0, 90) || err);
      break;
    }
  }
  return null;
}

/**
 * Initializes an interview session by generating a personalized opening greeting
 * and the first technical question based on the candidate's resume.
 */
export async function startInterviewSession(interviewId: string) {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      conversations: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!interview) {
    throw new Error("Interview session not found");
  }

  // If session already has an opening assistant message, return it
  if (interview.conversations.length > 0) {
    const firstAssistantMsg = interview.conversations.find((c) => c.type === "ASSISTANT");
    if (firstAssistantMsg) {
      return {
        success: true,
        message: firstAssistantMsg.message,
        candidateName: interview.name || "Candidate",
        skills: (interview.skills as string[]) || [],
        alreadyStarted: true,
      };
    }
  }

  const candidateName = interview.name || "Candidate";
  const skillsList = Array.isArray(interview.skills) ? (interview.skills as string[]).join(", ") : "Software Engineering";
  const projectsSummary = Array.isArray(interview.projects)
    ? JSON.stringify(interview.projects, null, 2)
    : "General software development projects";

  const prompt = `
You are an expert Senior Technical Interviewer conducting a live interactive technical interview.
Candidate Name: ${candidateName}
Candidate Skills: ${skillsList}
Candidate Projects: ${projectsSummary}

TASK:
1. Warmly greet the candidate by their name (${candidateName}).
2. Briefly introduce yourself as their AI Technical Interviewer for this session.
3. Ask your first engaging question based directly on their background, key skills, or one of their notable projects.
4. Keep the entire response conversational, professional, concise (3-4 sentences max), and end with 1 clear question for them to answer out loud.

Respond in clean plain text with no markdown formatting.
`;

  let openingGreeting = `Hello ${candidateName}, welcome to your technical interview! I have reviewed your background with ${skillsList}. To get started, could you briefly introduce yourself and tell me about a recent project you built?`;

  const generatedText = await generateWithRetry(prompt, 1);
  if (generatedText) {
    openingGreeting = generatedText;
  }

  const savedMessage = await prisma.message.create({
    data: {
      interviewId,
      type: "ASSISTANT",
      message: openingGreeting,
    },
  });

  await prisma.interview.update({
    where: { id: interviewId },
    data: { status: "INPROGRESS" },
  });

  return {
    success: true,
    message: savedMessage.message,
    id: savedMessage.id,
    candidateName,
    skills: (interview.skills as string[]) || [],
    alreadyStarted: false,
  };
}

/**
 * Ingests a candidate's spoken or typed answer, updates conversation history,
 * and generates the AI Interviewer's next follow-up question or response.
 */
export async function generateNextInterviewTurn(interviewId: string, userMessage: string) {
  const cleanUserMessage = userMessage.trim();
  if (!cleanUserMessage) {
    throw new Error("Candidate message cannot be empty");
  }

  // 1. Record the candidate's turn in database
  await prisma.message.create({
    data: {
      interviewId,
      type: "USER",
      message: cleanUserMessage,
    },
  });

  // 2. Fetch full candidate profile and history
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      conversations: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!interview) {
    throw new Error("Interview not found");
  }

  const candidateName = interview.name || "Candidate";
  const skillsList = Array.isArray(interview.skills) ? (interview.skills as string[]) : [];
  const projectsList = Array.isArray(interview.projects) ? (interview.projects as any[]) : [];
  const experienceList = Array.isArray(interview.experience) ? (interview.experience as any[]) : [];

  const dialogContext: DialogContext = {
    candidateName,
    skills: skillsList,
    projects: projectsList,
    experience: experienceList,
    history: interview.conversations.map((c) => ({
      type: c.type as "ASSISTANT" | "USER",
      message: c.message,
    })),
  };

  const intent = classifyCandidateIntent(cleanUserMessage);

  // If the candidate is performing an audio/connection check or asking to repeat, respond immediately with context
  if (intent === "AUDIO_CHECK" || intent === "REPEAT_REQUEST") {
    const directResponse = generateContextualFallback(dialogContext, cleanUserMessage);
    const savedAssistantMessage = await prisma.message.create({
      data: {
        interviewId,
        type: "ASSISTANT",
        message: directResponse,
      },
    });

    return {
      success: true,
      reply: savedAssistantMessage.message,
      id: savedAssistantMessage.id,
      intent,
    };
  }

  // Build dialog history representation
  const dialogHistory = interview.conversations
    .map((c) => `${c.type === "USER" ? "Candidate" : "Interviewer"}: ${c.message}`)
    .join("\n");

  const prompt = `
You are an expert Senior Technical Interviewer conducting a live, interactive technical interview.

Candidate Name: ${candidateName}
Candidate Skills: ${skillsList.join(", ") || "Software Development"}
Candidate Projects: ${JSON.stringify(projectsList, null, 2)}
Candidate Latest Input Intent: ${intent}

CONVERSATION TRANSCRIPT SO FAR:
${dialogHistory}

CRITICAL INTERVIEWER INSTRUCTIONS:
1. Act naturally like a friendly, rigorous senior technical lead evaluating a peer.
2. Directly acknowledge what the candidate just said in their last message ("${cleanUserMessage}").
3. DO NOT use canned or repetitive phrases (like "Thank you for explaining that").
4. Never repeat a question or topic that has already been asked earlier in the transcript.
5. If the candidate answered a technical question, probe deeper into their specific implementation, edge cases, trade-offs, concurrency, or database choices.
6. If the candidate gave a short or conversational answer, guide them smoothly toward explaining a specific project or technical system.
7. Keep your response CONCISE (2 to 4 sentences maximum) so that it is engaging and natural when spoken aloud via text-to-speech.
8. End with ONE clear, focused question.
9. Output ONLY your direct spoken words in clean plain text with no markdown formatting.
`;

  let nextResponse: string | null = await generateWithRetry(prompt, 2);

  if (!nextResponse) {
    // Dynamic non-repeating contextual fallback
    nextResponse = generateContextualFallback(dialogContext, cleanUserMessage);
  }

  const savedAssistantMessage = await prisma.message.create({
    data: {
      interviewId,
      type: "ASSISTANT",
      message: nextResponse,
    },
  });

  return {
    success: true,
    reply: savedAssistantMessage.message,
    id: savedAssistantMessage.id,
    intent,
  };
}

