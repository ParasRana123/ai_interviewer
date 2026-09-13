import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "../prisma/db";
import {
  classifyCandidateIntent,
  generateContextualFallback,
  formatCandidateName,
  type DialogContext,
} from "./dialog.manager";

const GEMINI_MODELS = [
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-pro",
];

function getGenerativeModel(modelName: string) {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured");
  }
  const genai = new GoogleGenerativeAI(apiKey);
  return genai.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 250,
    },
  });
}

/**
 * Attempts text generation using fallback models if primary model is rate-limited.
 */
async function generateWithRetry(prompt: string, retries = 2): Promise<string | null> {
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = getGenerativeModel(modelName);
      const response = await model.generateContent(prompt);
      const text = response.response.text();
      if (text && text.trim()) {
        return text
          .replace(/[*#_`~>]/g, "")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/https?:\/\/\S+/g, "")
          .trim();
      }
    } catch (err: any) {
      console.warn(`[Gemini Model ${modelName} notice]:`, err?.message || err);
      // Try next fallback model
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

  const candidateFirstName = formatCandidateName(interview.name);
  const skillsArray = Array.isArray(interview.skills) ? (interview.skills as string[]) : [];
  const topSkills = skillsArray.slice(0, 3).join(", ") || "Software Development";

  // If session already has an opening assistant message, return it
  if (interview.conversations.length > 0) {
    const firstAssistantMsg = interview.conversations.find((c) => c.type === "ASSISTANT");
    if (firstAssistantMsg) {
      return {
        success: true,
        message: firstAssistantMsg.message,
        candidateName: candidateFirstName,
        skills: skillsArray,
        alreadyStarted: true,
      };
    }
  }

  const projectsSummary = Array.isArray(interview.projects)
    ? JSON.stringify(interview.projects, null, 2)
    : "General software development projects";

  const prompt = `
You are an expert Senior Technical Interviewer conducting a live interactive technical interview.
Candidate First Name: ${candidateFirstName}
Candidate Key Skills: ${topSkills}
Candidate Projects: ${projectsSummary}

TASK:
1. Warmly greet the candidate by their first name (${candidateFirstName}).
2. Briefly introduce yourself as their AI Technical Interviewer for this session.
3. Ask your first engaging question based directly on their background, key skills (${topSkills}), or one of their notable projects.
4. Keep the entire response conversational, professional, concise (2-3 sentences max), and end with 1 clear question for them to answer out loud.
5. Do NOT list out long skill lists or repetitive boilerplate.

Respond in clean plain text with no markdown formatting.
`;

  let openingGreeting = `Hello ${candidateFirstName}, welcome to your technical interview! I have reviewed your background with ${topSkills}. To get started, could you briefly introduce yourself and tell me about a recent project you built?`;

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
    candidateName: candidateFirstName,
    skills: skillsArray,
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

  // 1. Fetch current interview profile and conversation history first
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

  // 2. Server-side Deduplication Guard:
  // Check if the latest message recorded was identical user speech submitted within the last 6 seconds
  const lastMsg = interview.conversations[interview.conversations.length - 1];

  if (
    lastMsg &&
    lastMsg.type === "USER" &&
    lastMsg.message.trim().toLowerCase() === cleanUserMessage.toLowerCase() &&
    Date.now() - new Date(lastMsg.createdAt).getTime() < 6000
  ) {
    console.warn(`[Backend Deduplication] Detected duplicate candidate turn for interview ${interviewId}. Reusing last state.`);
    return {
      success: true,
      reply: "I heard you clearly. Let's proceed.",
      id: lastMsg.id,
      deduplicated: true,
    };
  }

  // 3. Record the candidate's turn in database
  const savedUserMessage = await prisma.message.create({
    data: {
      interviewId,
      type: "USER",
      message: cleanUserMessage,
    },
  });

  const candidateFirstName = formatCandidateName(interview.name);
  const skillsList = Array.isArray(interview.skills) ? (interview.skills as string[]) : [];
  const projectsList = Array.isArray(interview.projects) ? (interview.projects as any[]) : [];
  const experienceList = Array.isArray(interview.experience) ? (interview.experience as any[]) : [];

  const updatedHistory = [
    ...interview.conversations.map((c) => ({
      type: c.type as "ASSISTANT" | "USER",
      message: c.message,
    })),
    { type: "USER" as const, message: cleanUserMessage },
  ];

  const dialogContext: DialogContext = {
    candidateName: candidateFirstName,
    skills: skillsList,
    projects: projectsList,
    experience: experienceList,
    history: updatedHistory,
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
  const dialogHistory = updatedHistory
    .map((c) => `${c.type === "USER" ? "Candidate" : "Interviewer"}: ${c.message}`)
    .join("\n");

  const prompt = `
You are an expert Senior Technical Interviewer conducting a live, interactive technical interview.

Candidate First Name: ${candidateFirstName}
Candidate Skills: ${skillsList.slice(0, 4).join(", ") || "Software Development"}
Candidate Latest Input Intent: ${intent}

CONVERSATION TRANSCRIPT SO FAR:
${dialogHistory}

CRITICAL INTERVIEWER INSTRUCTIONS:
1. Act naturally like a friendly, rigorous senior technical lead conducting a live technical assessment.
2. Directly reference a specific technical detail or decision from what the candidate just explained ("${cleanUserMessage}").
3. NEVER repeat repetitive acknowledgement boilerplate (e.g. DO NOT start consecutive responses with "Got it", "Thanks for breaking that down", or "I see").
4. DO NOT repeat the candidate's name on every single response.
5. NEVER repeat a question, topic, or phrasing that has already been asked earlier in the conversation transcript.
6. Keep your response CONCISE (2 to 3 sentences max) so it sounds natural when spoken aloud via text-to-speech.
7. End with ONE clear, focused follow-up technical question.
8. Output ONLY your spoken words in clean plain text with no markdown formatting.
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
