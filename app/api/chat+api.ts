type GeminiMessage = {
  role: "user" | "model";
  parts: Array<{ text: string }>;
};

export async function POST(request: Request): Promise<Response> {
  let body: {
    messages?: Array<{ role: string; content: string }>;
    language?: string;
    systemPrompt?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages = [], language = "your target language", systemPrompt } = body;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Gemini not configured" }, { status: 500 });
  }

  const resolvedSystem =
    systemPrompt ||
    `You are KiiBridge, a friendly and encouraging ${language} language tutor. ` +
      `Help the user practice ${language} through natural conversation. ` +
      `Keep responses concise (2-3 sentences). ` +
      `Gently correct mistakes and introduce vocabulary naturally. ` +
      `Encourage the user to try writing in ${language}.`;

  const contents: GeminiMessage[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: resolvedSystem }] },
        contents,
        generationConfig: { maxOutputTokens: 300 },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return Response.json({ error: text }, { status: res.status });
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
  };
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return Response.json({ reply });
}
