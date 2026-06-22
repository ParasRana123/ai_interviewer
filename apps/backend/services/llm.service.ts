import { GoogleGenerativeAI } from "@google/generative-ai";
import { RESUME_PARSER_PROMPT } from "../prompts/prompt";
import { ResumeSchema } from "../types/resume.schema";

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
console.log(process.env.GEMINI_API_KEY);

const model = genai.getGenerativeModel({
    model: "gemini-2.5-flash",
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

    let parsedData: unknown;
    try {
        parsedData = JSON.parse(content);
    } catch(err) {
        throw new Error("LLM returned invalid JSON");
    }

    const { success , data , error } = ResumeSchema.safeParse(parsedData);
    if(!success) {
        console.log("Resume schema validation failed: " , error.flatten());
        throw new Error("LLM response does not match Resume Schema");
    };
    return data;
}