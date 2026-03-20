import { NextRequest, NextResponse } from "next/server";
import { getDocumentProxy, extractText } from "unpdf";

/**
 * Split text into chunks of roughly `maxSize` characters,
 * preferring to break on paragraph or sentence boundaries.
 */
function chunkText(text: string, maxSize = 4000): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxSize) {
      chunks.push(remaining.trim());
      break;
    }

    let slice = remaining.slice(0, maxSize);

    // Try to break at the last paragraph boundary (\n\n)
    let breakIdx = slice.lastIndexOf("\n\n");

    // Fall back to the last sentence-ending punctuation followed by a space
    if (breakIdx === -1 || breakIdx < maxSize * 0.3) {
      const sentenceMatch = slice.match(/.*[.!?]\s/s);
      if (sentenceMatch) {
        breakIdx = sentenceMatch[0].length;
      }
    }

    // Fall back to the last newline
    if (breakIdx === -1 || breakIdx < maxSize * 0.3) {
      breakIdx = slice.lastIndexOf("\n");
    }

    // Absolute fallback: hard cut at maxSize
    if (breakIdx === -1 || breakIdx < maxSize * 0.3) {
      breakIdx = maxSize;
    }

    chunks.push(remaining.slice(0, breakIdx).trim());
    remaining = remaining.slice(breakIdx).trim();
  }

  return chunks.filter((c) => c.length > 0);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF files are accepted." },
        { status: 400 }
      );
    }

    // Read file into Uint8Array for unpdf
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    // Extract text using unpdf
    const pdf = await getDocumentProxy(data);
    const { totalPages, text: extractedText } = await extractText(pdf, {
      mergePages: true,
    });

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        {
          error:
            "Could not extract text from this PDF. It may contain only images or scanned content.",
        },
        { status: 422 }
      );
    }

    // Chunk the text into ~4000-character segments
    const chunks = chunkText(extractedText, 4000);

    return NextResponse.json({
      success: true,
      text: extractedText,
      chunks: chunks,
      totalPages,
      charCount: extractedText.length,
    });
  } catch (error: any) {
    console.error("Upload API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
