import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    // Validate Gemini API key
    if (!process.env.GEMINI_API_KEY) {
      console.error("Missing GEMINI_API_KEY environment variable");
      return NextResponse.json(
        { error: "Server configuration error: GEMINI_API_KEY is not set." },
        { status: 500 }
      );
    }

    const formData: any = await request.formData();
    const prompt = (formData.get("prompt") as string)?.trim();
    const documentText = (formData.get("documentText") as string) || "";

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    let finalPrompt = prompt;

    // If the frontend sent document text, inject it as context
    if (documentText.trim().length > 0) {
      console.log(
        `[Chat] Using in-memory document context (${documentText.length} chars) for query: "${prompt.slice(0, 80)}..."`
      );

      finalPrompt = `You are a helpful assistant. Use the following document to answer questions:

${documentText}

User question: ${prompt}`;
    }

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: finalPrompt,
    });

    return NextResponse.json({ text: result.text });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate response" },
      { status: 500 }
    );
  }
}
