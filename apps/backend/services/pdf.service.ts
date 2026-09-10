import { PDFParse } from "pdf-parse";

export async function extractText(buffer: Buffer): Promise<string> {
    if (!buffer || buffer.length === 0) {
        return "";
    }

    // 1. Try standard PDFParse
    try {
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        if (result && typeof result.text === "string" && result.text.trim()) {
            return result.text.trim();
        }
    } catch (e: any) {
        console.warn("PDFParse standard extraction notice:", e?.message || e);
    }

    // 2. Fallback: stream text extraction from PDF content streams
    try {
        const rawString = buffer.toString("latin1");
        // Extract text in PDF text blocks (between BT and ET)
        const textBlocks = rawString.match(/BT[\s\S]*?ET/g);
        if (textBlocks && textBlocks.length > 0) {
            const extracted = textBlocks
                .join(" ")
                .replace(/\(([^)]*)\)/g, "$1 ")
                .replace(/\[([^\]]*)\]/g, "$1 ")
                .replace(/[\\/]/g, " ")
                .replace(/\s+/g, " ");
            if (extracted.trim().length > 30) {
                return extracted.trim();
            }
        }

        // 3. Fallback: extract any readable ASCII/UTF-8 strings
        const asciiMatches = rawString.match(/[a-zA-Z0-9@.,:;+\-_/#\s]{4,}/g);
        if (asciiMatches && asciiMatches.length > 0) {
            const cleanAscii = asciiMatches.join(" ").replace(/\s+/g, " ").trim();
            if (cleanAscii.length > 50) {
                return cleanAscii;
            }
        }
    } catch (fallbackErr) {
        console.warn("Fallback PDF stream extraction notice:", fallbackErr);
    }

    return "";
}