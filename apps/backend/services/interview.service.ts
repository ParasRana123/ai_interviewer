import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "../prisma/db";

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

  try {
    const model = getGenerativeModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text()?.trim();
    if (text) {
      openingGreeting = text.replace(/[*#_`]/g, "").trim();
    }
  } catch (err: any) {
    console.warn("Gemini start session notice, using fallback opening:", err?.message || err);
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
  const skillsList = Array.isArray(interview.skills) ? (interview.skills as string[]).join(", ") : "Software Engineering";
  const projectsSummary = Array.isArray(interview.projects)
    ? JSON.stringify(interview.projects, null, 2)
    : "General projects";

  // Build dialog history representation
  const dialogHistory = interview.conversations
    .map((c) => `${c.type === "USER" ? "Candidate" : "Interviewer"}: ${c.message}`)
    .join("\n");

  const prompt = `
You are an expert Senior Technical Interviewer conducting a real-time, interactive technical interview.

Candidate Name: ${candidateName}
Candidate Skills: ${skillsList}
Candidate Projects: ${projectsSummary}

CONVERSATION TRANSCRIPT SO FAR:
${dialogHistory}

INTERVIEWER GUIDELINES:
1. Act naturally like a friendly, rigorous senior engineer evaluating a peer.
2. Acknowledge what the candidate just explained briefly (1 sentence).
3. Follow up on specific technical details, architecture decisions, trade-offs, edge cases, or problem-solving approaches.
4. Keep your response CONCISE (2 to 4 sentences maximum) so that it sounds natural when spoken out loud by text-to-speech.
5. End with ONE clear, focused question.
6. Do NOT repeat questions already asked.
7. If the candidate asks for clarification or indicates they are done, guide them forward smoothly.
8. Output ONLY the interviewer's direct spoken response in clean plain text with no markdown symbols.
`;

  let nextResponse = "Thank you for explaining that. Could you dive deeper into the key technical challenges you faced during that implementation and how you resolved them?";

  try {
    const model = getGenerativeModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text()?.trim();
    if (text) {
      nextResponse = text.replace(/[*#_`]/g, "").trim();
    }
  } catch (err: any) {
    console.warn("Gemini conversation turn notice, using fallback response:", err?.message || err);
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
  };
}
