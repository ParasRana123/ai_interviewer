import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";

const outputSchema = z.object({
    feedback: z.string().describe("Detailed feedback for the user regarding their performance."),
    score: z.number().min(0).max(10).describe("Score out of 10 for their interview")
});

const RESULT_PROMPT = `
You are an expert interviewer and evaluator. Your job is to evaluate the candidate's interview transcript.
Analyze their responses, provide constructive feedback, and give them a score out of 10.

Candidate Transcript:
{{ USER_TRANSCRIPT }}

Return ONLY valid JSON matching this schema:
{
  "feedback": "Detailed constructive feedback regarding the candidate's performance, strengths, and areas for improvement.",
  "score": 8
}
`;

function getGenerativeModel() {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not configured");
    }
    const genai = new GoogleGenerativeAI(apiKey);
    return genai.getGenerativeModel({
        model: "gemini-3.6-flash",
        generationConfig: {
            responseMimeType: "application/json"
        }
    });
}

export async function calculateResult(
    messages: { type: "ASSISTANT" | "USER"; message: string; createdAt: Date }[]
) {
    const model = getGenerativeModel();
    const prompt = RESULT_PROMPT.replace(`{{ USER_TRANSCRIPT }}`, JSON.stringify(messages));

    const response = await model.generateContent(prompt);
    const content = response.response.text();

    if (!content) {
        throw new Error("No response received from the AI model.");
    }

    let cleanContent = content.trim();
    if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }

    let parsed: any;
    try {
        parsed = JSON.parse(cleanContent);
    } catch (e) {
        console.error("Result calculation JSON Parse Error. Raw content:", content);
        throw new Error("Invalid JSON returned by evaluation model");
    }

    const validated = outputSchema.safeParse(parsed);
    if (!validated.success) {
        console.warn("Schema parse fallback for evaluation result:", validated.error);
        return {
            feedback: parsed.feedback || "Interview completed. Good effort on your responses.",
            score: typeof parsed.score === "number" ? Math.min(10, Math.max(0, Math.round(parsed.score))) : 7
        };
    }

    return {
        feedback: validated.data.feedback,
        score: Math.round(validated.data.score)
    };
}