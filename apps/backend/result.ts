import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const outputSchema = z.object({
    feedback: z.string().describe("Detailed feedback for the user regarding their performance."),
    score: z.number().int().min(0).max(10).describe("Score out of 10 for their interview")
});

const RESULT_PROMPT = `
    You are an expert interviewer and evaluator. Your job is to evaluate the user's interview transcript.
    Analyze their responses, provide constructive feedback, and give them a score out of 10.

    {{ USER_TRANSCRIPT }}
`;

export async function calculateResult(
    messages: { type: "ASSISTANT" | "USER"; message: string; createdAt: Date }[]
) {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: RESULT_PROMPT.replace(`{{ USER_TRANSCRIPT }}`, JSON.stringify(messages)),
        config: {
            responseMimeType: "application/json",
            responseSchema: outputSchema,
        },
    });

    if (!response.text) {
        throw new Error("No response received from the AI model.");
    }

    const result = outputSchema.parse(JSON.parse(response.text));
    return result;
}