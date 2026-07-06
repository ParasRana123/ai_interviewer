import { useParams } from "react-router";
import { useEffect , useRef } from "react";
import { BACKEND_URL } from "@/lib/config";
import axios from "axios";

export function Interview() {
    const { interviewId } = useParams<{ interviewId: string }>();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        (async () => {
            const pc = new RTCPeerConnection();
            audioRef.current = document.createElement("audio");
            audioRef.current.autoplay = true;
            pc.ontrack = (e) => (audioRef.current!.srcObject = e.streams[0]!);
            const ms = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });

            const socket = new WebSocket('wss://api.deepgram.com/v1/listen' , [
                'token',
                process.env.DEEPGRAM_API_KEY!
            ]);

            socket.onopen = () => {
                const mediaRecorder = new MediaRecorder(ms , { mimeType: "audio/webm" });
                mediaRecorder.start(250);
                mediaRecorder.addEventListener("dataavailable" , (e) => {
                    socket.send(e.data);
                });
            };

            socket.onmessage = (message) => {
                const recieved = JSON.parse(message.data);
                const transcript = recieved.channel.alternatives[0].transcript;
                if(transcript) {
                    console.log("Transcript:", transcript);
                    axios.post(`${BACKEND_URL}/api/v1/session1/${interviewId}` , {
                        message: transcript
                    })
                }
            }

            pc.addTrack(ms.getTracks()[0]!);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const sdpResponse = await fetch(`${BACKEND_URL}/api/v1/session/${interviewId}` , {
                method: "POST",
                body: offer.sdp,
                headers: {
                    "Content-Type" : "application/sdp",
                },
            });

            const answer = {
                type: "answer" as "answer",
                sdp: await sdpResponse.text(),
            };

            await pc.setRemoteDescription(answer);
        })()
    } , [interviewId]);

    return <div>
        <audio autoPlay ref={audioRef}></audio>
        interview
    </div>
}