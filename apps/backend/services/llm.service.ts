import { GoogleGenerativeAI } from "@google/generative-ai";
import { RESUME_PARSER_PROMPT } from "../prompts/prompt";

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
console.log(process.env.GEMINI_API_KEY);

const model = genai.getGenerativeModel({
    model: "gemini-3-flash-preview",
    generationConfig: { responseMimeType: "application/json" }
})

export async function parseResume(text: string) {
    
    const prompt = `
       ${RESUME_PARSER_PROMPT}
       Resume Text:
       ${text}
    `;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const content = response.text();
    return JSON.parse(content || "{}");
}