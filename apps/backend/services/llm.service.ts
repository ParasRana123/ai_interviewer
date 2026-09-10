import { GoogleGenerativeAI } from "@google/generative-ai";
import { RESUME_PARSER_PROMPT } from "../prompts/prompt";
import { ResumeSchema } from "../types/resume.schema";

function getGenerativeModel() {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not configured");
    }
    const genai = new GoogleGenerativeAI(apiKey);
    return genai.getGenerativeModel({
        model: "gemini-3.6-flash",
        generationConfig: { responseMimeType: "application/json" }
    });
}

export async function parseResume(text: string) {
    const prompt = `
       ${RESUME_PARSER_PROMPT}
       Resume Text:
       ${text}
    `;

    const model = getGenerativeModel();
    const result = await model.generateContent(prompt);
    const response = result.response;
    const content = response.text();

    if (!content) {
        throw new Error("Empty response received from Gemini model");
    }

    let cleanContent = content.trim();
    if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }

    let parsedData: unknown;
    try {
        parsedData = JSON.parse(cleanContent);
    } catch (err) {
        console.error("LLM JSON Parse Error. Raw content:", content);
        throw new Error("LLM returned invalid JSON");
    }

    const { success, data, error } = ResumeSchema.safeParse(parsedData);
    if (!success) {
        console.error("Resume schema validation failed:", error.flatten());
        throw new Error("LLM response does not match Resume Schema");
    }
    return data;
}