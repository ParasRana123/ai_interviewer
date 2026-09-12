import { GoogleGenerativeAI } from "@google/generative-ai";
import { RESUME_PARSER_PROMPT } from "../prompts/prompt";
import { ResumeSchema } from "../types/resume.schema";

function getGenerativeModel(modelName = "gemini-2.5-flash") {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
        return null;
    }
    const genai = new GoogleGenerativeAI(apiKey);
    return genai.getGenerativeModel({
        model: modelName,
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
    const textLower = text.toLowerCase();
    const detectedSkills = commonSkills.filter((s) => textLower.includes(s.toLowerCase()));

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
        skills: detectedSkills.length > 0 ? detectedSkills : ["Software Engineering", "Problem Solving", "Web Development"],
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
        const apiKey = process.env.GEMINI_API_KEY || "";
        if (!apiKey) {
            console.warn("GEMINI_API_KEY not found, using heuristic resume extraction.");
            return fallbackData;
        }

        const prompt = `
           ${RESUME_PARSER_PROMPT}
           Resume Text:
           ${text}
        `;

        // Timeboxed LLM call (max 10 seconds) with fallback models
        const candidateModels = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
        let content: string | null = null;

        for (const modelName of candidateModels) {
            try {
                const model = getGenerativeModel(modelName);
                if (!model) break;

                const generatePromise = model.generateContent(prompt).then((res) => res.response.text());
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error("LLM parse timeout (10s)")), 10000)
                );

                content = await Promise.race([generatePromise, timeoutPromise]);
                if (content && content.trim()) {
                    break;
                }
            } catch (err: any) {
                console.warn(`Gemini parse with ${modelName} notice:`, err?.message || err);
            }
        }

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