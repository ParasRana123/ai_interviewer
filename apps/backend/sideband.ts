import { prisma } from "./prisma/db";

/**
 * Native conversation manager for recording and querying interview messages.
 */
export const recordConversationMessage = async (
    interviewId: string,
    type: "USER" | "ASSISTANT",
    message: string
) => {
    if (!interviewId || !message.trim()) return null;

    try {
        return await prisma.message.create({
            data: {
                interviewId,
                type,
                message: message.trim(),
            },
        });
    } catch (err: any) {
        console.warn("Failed to record conversation message:", err?.message || err);
        return null;
    }
};

export const getConversationHistory = async (interviewId: string) => {
    if (!interviewId) return [];
    try {
        return await prisma.message.findMany({
            where: { interviewId },
            orderBy: { createdAt: "asc" },
        });
    } catch (err: any) {
        console.warn("Failed to fetch conversation history:", err?.message || err);
        return [];
    }
};

/**
 * Legacy compatibility stub
 */
export const initSideband = async (callId?: string, interviewId?: string) => {
    console.info("Sideband initialized for interview session:", interviewId);
};