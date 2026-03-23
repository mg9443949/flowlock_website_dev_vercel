import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Server configuration error: GEMINI_API_KEY is not set." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { sessions, type, userName } = body;

    if (!sessions || !Array.isArray(sessions)) {
      return NextResponse.json({ error: "Invalid sessions data" }, { status: 400 });
    }

    let prompt = "";

    if (type === "coach") {
      prompt = `You are an elite productivity coach analyzing a user's focus data. 
User Name: ${userName || "User"}
Session Data Summary: ${JSON.stringify(sessions.slice(0, 10))}

Return EXACTLY a JSON object with this shape, and NO formatting markdown around it:
{
  "focus_score": (0-100 average),
  "best_focus_window": "time of day",
  "worst_window": "time of day",
  "recommendations": [
    { "title": "insight title 1", "advice": "Max 2 sentences referencing actual numbers." },
    { "title": "insight title 2", "advice": "Max 2 sentences referencing actual numbers." },
    { "title": "insight title 3", "advice": "Max 2 sentences referencing actual numbers." }
  ],
  "encouragement": "1 warm sentence using their name"
}`;
    } else if (type === "heatmap") {
      prompt = `You are a friendly data analyst. Look at this session timeline:
User Name: ${userName || "User"}
Session Data Summary: ${JSON.stringify(sessions.slice(0, 10))}

Translate this timeline into human-readable zones. Return EXACTLY a JSON object with this shape:
{
  "peak_distractions": [
    { "zone": "time or description", "description": "1 sentence explaining what happened.", "label": "red or amber" },
    { "zone": "time or description", "description": "1 sentence explaining what happened.", "label": "red or amber" },
    { "zone": "time or description", "description": "1 sentence explaining what happened.", "label": "red or amber" }
  ],
  "deep_focus": [
    { "zone": "time or description", "description": "1 sentence celebrating it.", "label": "green" },
    { "zone": "time or description", "description": "1 sentence celebrating it.", "label": "green" }
  ]
}`;
    } else {
        return NextResponse.json({ error: "Invalid coach type" }, { status: 400 });
    }

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
          responseMimeType: "application/json"
      }
    });

    const outputText = result.text.trim();
    return NextResponse.json(JSON.parse(outputText));

  } catch (error: any) {
    console.error("AI Coach API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate insights" },
      { status: 500 }
    );
  }
}
