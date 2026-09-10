import WebSocket from "ws";
import { prisma } from "./prisma/db";

export const initSideband = async (callId: string, interviewId: string) => {
    if (!callId || !interviewId) {
        console.warn("initSideband called with missing callId or interviewId");
        return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.warn("OPENAI_API_KEY is missing, skipping sideband WebSocket initialization.");
        return;
    }

    try {
        const interview = await prisma.interview.findUnique({
            where: {
                id: interviewId,
            }
        });

        const url = "wss://api.openai.com/v1/realtime?call_id=" + encodeURIComponent(callId);
        const ws = new WebSocket(url, {
            headers: {
                Authorization: "Bearer " + apiKey,
            },
        });

        ws.on("open", function open() {
            console.log("Connected to OpenAI Realtime Sideband WebSocket.");
            try {
                ws.send(
                    JSON.stringify({
                        type: "session.update",
                        session: {
                            type: "realtime",
                            instructions: `You are an expert Senior Software Engineer conducting a technical interview.
                            Candidate Information:
                            --------------------------------------
                            Name: ${interview?.name || "Candidate"}
                            Email: ${interview?.email || "N/A"}
                            Phone: ${interview?.phone || "N/A"}

                            Resume Information:
                            ---------------------------------------
                            Education: ${JSON.stringify(interview?.education || [], null, 2)}
                            Experience: ${JSON.stringify(interview?.experience || [], null, 2)}
                            Projects: ${JSON.stringify(interview?.projects || [], null, 2)}
                            Skills: ${JSON.stringify(interview?.skills || [], null, 2)}
                            Achievements: ${JSON.stringify(interview?.achievements || [], null, 2)}
                            Coding Profiles: ${JSON.stringify(interview?.codingProfiles || {}, null, 2)}

                            Interview Rules:
                            ---------------------------------------------------
                            - This is a Computer Science interview.
                            - First greet the candidate warmly.
                            - Briefly introduce yourself as the AI technical interviewer.
                            - Ask the candidate to briefly introduce themselves.
                            - Then ask 2-3 questions based directly on their resume and projects.
                            - Ask practical questions rather than trivial definitions.
                            - Keep the interview conversational.
                            - At the end, thank the candidate and conclude the interview naturally.
                            `,
                        }
                    })
                );
            } catch (sendErr) {
                console.warn("Failed to send session update to sideband WS:", sendErr);
            }
        });

        ws.on("message", async function incoming(message) {
            try {
                const parsedMessage = JSON.parse(message.toString());
                if (parsedMessage.type === "response.done" && parsedMessage.response?.output) {
                    let contents: { type: string; transcript?: string }[] = [];
                    parsedMessage.response.output.forEach((x: any) => {
                        if (Array.isArray(x?.content)) {
                            contents = [...contents, ...x.content];
                        }
                    });
                    
                    const assistantMessage = contents
                        .filter(x => x?.type === "output_audio" && x?.transcript)
                        .map(x => x.transcript)
                        .join(" ")
                        .trim();

                    if (assistantMessage) {
                        await prisma.message.create({
                            data: {
                                interviewId: interviewId,
                                type: "ASSISTANT",
                                message: assistantMessage,
                            }
                        });
                    }
                }
            } catch (err) {
                console.warn("Error processing sideband message:", err);
            }
        });

        ws.on("error", function error(err) {
            console.warn("Sideband WebSocket warning:", err?.message || err);
        });

        ws.on("close", function close(code, reason) {
            console.log("Sideband WebSocket closed:", code, reason ? reason.toString() : "");
        });
    } catch (outerErr) {
        console.warn("Could not establish sideband connection:", outerErr);
    }
};