import { GoogleGenerativeAI } from "@google/generative-ai";

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
console.log(process.env.GEMINI_API_KEY);

const model = genai.getGenerativeModel({
    model: "gemini-3-flash-preview",
    generationConfig: { responseMimeType: "application/json" }
})

export async function parseResume(text: string) {
    const prompt = `
        Extract information from this resume.
        Return ONLY JSON using this schema:
        {
           "name": "",
           "email": "",
           "phone": "",
           "linkedin": "",
           "github": "",
           "portfolio": "",
           "education": [],
           "experience": [],
           "projects" : [],
           "acheivements": [],
           "skills": [],
           "codingProfiles": {
               "leetcode": "",
               "codeforces": "",
               "codechef": "",
           }
        }

        Resume: ${text}
    `;
    const result = await model.generateContent(prompt);
    const response = result.response;
    const content = response.text();
    return JSON.parse(content || "{}");
}