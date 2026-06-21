import { PDFParse } from "pdf-parse";

export async function extractText(buffer: Buffer): Promise<string>{
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText();
    return result.text;
}