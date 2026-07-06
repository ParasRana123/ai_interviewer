import WebSocket from "ws";

export const initSideband = (callId: string, interviewId: string) => {
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
                    instructions: `You are supposed to inetrview this user based on their computer science intellect.
                    Ask about 2-3 questions based on their resume.
                    `,
                }
            })
        )
    })

    ws.on("message", function incoming(message) {
        console.log(JSON.parse(message.toString()));
    });
}