import { GoogleGenerativeAI } from "@google/generative-ai";
import { RESUME_PARSER_PROMPT } from "../prompts/prompt";
import { ResumeSchema } from "../types/resume.schema";

function getGenerativeModel() {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
        return null;
    }
    const genai = new GoogleGenerativeAI(apiKey);
    return genai.getGenerativeModel({
        model: "gemini-3.6-flash",
        generationConfig: { responseMimeType: "application/json" }
    });
}

function extractHeuristics(text: string) {
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const name = lines.length > 0 && lines[0].length < 50 ? lines[0] : "Candidate";

    // Extract common tech skills
    const commonSkills = [
        "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Python",
        "Java", "C++", "Go", "Rust", "SQL", "PostgreSQL", "MongoDB", "Docker",
        "Kubernetes", "AWS", "Git", "HTML", "CSS", "TailwindCSS", "Express"
    ];
    const detectedSkills = commonSkills.filter((s) => new RegExp(`\\b${s}\\b`, "i").test(text));

    return {
        name: name || "Candidate",
        email: emailMatch ? emailMatch[0] : null,
        phone: phoneMatch ? phoneMatch[0] : null,
        linkedin: null,
        github: null,
        portfolio: null,
        education: [],
        experience: [],
        projects: [],
        achievements: [],
        skills: detectedSkills,
        codingProfiles: {
            leetcode: null,
            codeforces: null,
            codechef: null,
            hackerrank: null,
        },
    };
}

export async function parseResume(text: string) {
    const fallbackData = extractHeuristics(text);

    try {
        const model = getGenerativeModel();
        if (!model) {
            console.warn("GEMINI_API_KEY not found, using heuristic resume extraction.");
            return fallbackData;
        }

        const prompt = `
           ${RESUME_PARSER_PROMPT}
           Resume Text:
           ${text}
        `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const content = response.text();

        if (!content) {
            return fallbackData;
        }

        let cleanContent = content.trim();
        if (cleanContent.startsWith("```")) {
            cleanContent = cleanContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
        }

        let parsedData: any;
        try {
            parsedData = JSON.parse(cleanContent);
        } catch (err) {
            console.warn("LLM JSON Parse Notice, falling back to heuristics. Raw content:", content);
            return fallbackData;
        }

        const { success, data } = ResumeSchema.safeParse(parsedData);
        if (success && data) {
            return {
                ...fallbackData,
                ...data,
                name: data.name || fallbackData.name,
                email: data.email || fallbackData.email,
                phone: data.phone || fallbackData.phone,
                skills: (data.skills && data.skills.length > 0) ? data.skills : fallbackData.skills,
            };
        }

        // Normalization fallback if Zod parse had issues
        return {
            name: typeof parsedData?.name === "string" ? parsedData.name : fallbackData.name,
            email: typeof parsedData?.email === "string" ? parsedData.email : fallbackData.email,
            phone: typeof parsedData?.phone === "string" ? parsedData.phone : fallbackData.phone,
            linkedin: parsedData?.linkedin || null,
            github: parsedData?.github || null,
            portfolio: parsedData?.portfolio || null,
            education: Array.isArray(parsedData?.education) ? parsedData.education : [],
            experience: Array.isArray(parsedData?.experience) ? parsedData.experience : [],
            projects: Array.isArray(parsedData?.projects) ? parsedData.projects : [],
            achievements: Array.isArray(parsedData?.achievements) ? parsedData.achievements : [],
            skills: Array.isArray(parsedData?.skills) ? parsedData.skills : fallbackData.skills,
            codingProfiles: typeof parsedData?.codingProfiles === "object" ? parsedData.codingProfiles : fallbackData.codingProfiles,
        };
    } catch (llmErr: any) {
        console.warn("Gemini resume parsing notice:", llmErr?.message || llmErr);
        return fallbackData;
    }
}