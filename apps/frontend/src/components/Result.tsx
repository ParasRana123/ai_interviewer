import { BACKEND_URL } from "@/lib/config";
import axios from "axios"
import { useEffect, useState } from "react"
import { useParams } from "react-router"

interface Result {
    transcript: { type: "Assistant" | "User" , content: string , createdAt: Date }[],
    score: number,
    feedback: string,
    status: "DONE" | "INPROGRESS" | "PRE"
}

export function Result() {
    const { interviewId } = useParams();

    const [result , setResult] = useState<Result>({
        score: 0,
        feedback: "",
        transcript: [],
        status: "PRE"
    })

    useEffect(() => {
        axios.get(`${BACKEND_URL}/api/v1/result/${interviewId}`)
             .then(response => {
                setResult(response.data)
                if(response.data.status == "DONE") {
                    clearInterval(intervalId)
                }
             })

        let intervalId = setInterval(() => {
            axios.get(`${BACKEND_URL}/api/v1/result/${interviewId}`)
             .then(response => {
                setResult(response.data)
            })
        } , 5 * 1000)

        return () => {
            clearInterval(intervalId)
        }

    } , [interviewId])

    return <div>
        {result.status == "DONE" && <div>
            Score - {result.score}
            Feedback - {result.feedback}
            Transcript - 
            {result.transcript.sort((a , b) => a.createdAt.getTime() - b.createdAt.getTime()).map(x => <div>
                {x.type} - {x.content}
            </div>)}
        </div>}
    </div>
}