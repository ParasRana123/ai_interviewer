import WebSocket from "ws";
import { prisma } from "./prisma/db";

export const initSideband = async (callId: string, interviewId: string) => {

    const interview = await prisma.interview.findUnique({
        where: {
            id: interviewId,
        }
    })

    const url = "wss://api.openai.com/v1/realtime?call_id=" + callId;
    const ws = new WebSocket(url , {
        headers: {
            Authorization: "Bearer " + process.env.OPENAI_API_KEY,
        },
    });

    ws.on("open" , function open() {
        console.log("Connected to server.");
        ws.send(
            JSON.stringify({
                type: "session.update",
                session: {
                    type: "realtime",
                    instructions: `You are an expert Senior Software Engineer conducting a technical interview.
                    Candidate Information:
                    --------------------------------------
                    Name: ${interview?.name}
                    Email: ${interview?.email}
                    Phone: ${interview?.phone}

                    Resume Information:
                    ---------------------------------------
                    Education: ${JSON.stringify(interview?.education , null , 2)}
                    Experience: ${JSON.stringify(interview?.experience , null , 2)}
                    Projects: ${JSON.stringify(interview?.projects , null , 2)}
                    Skills: ${JSON.stringify(interview?.skills , null , 2)}
                    Achievements: ${JSON.stringify(interview?.achievements , null , 2)}
                    Coding Profiles: ${JSON.stringify(interview?.codingProfiles , null , 2)}

                    Interview Rules:
                    ---------------------------------------------------
                    - This is a Computer Science interview.
                    - First greet the candidate.
                    - Briefly introduce yourself.
                    - Ask the candidate to introduce themselves.
                    - Then ask 2-3 questions based directly on their resume.
                    - Ask detailed follow-up questions on projects if necessary.
                    - Focus on technologies the candidate claims to know.
                    - Ask practical questions rather than trivia.
                    - Increase or decrease difficulty based on previous answers.
                    - Never reveal the answers.
                    - Wait for the candidate to finish before asking the next question.
                    - Keep the interview conversational.
                    - At the end, thank the candidate and conclude the interview naturally.
                    `,
                }
            })
        )
    })

    ws.on("message", function incoming(message) {
        console.log(JSON.parse(message.toString()));
    });
}