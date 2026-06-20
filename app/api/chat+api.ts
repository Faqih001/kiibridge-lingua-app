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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "AI not configured" }, { status: 500 });
  }

  const resolvedSystem =
    systemPrompt ||
    `You are KiiBridge, a friendly and encouraging ${language} language tutor. ` +
      `Help the user practice ${language} through natural conversation. ` +
      `Keep responses concise (2-3 sentences). ` +
      `Gently correct mistakes and introduce vocabulary naturally. ` +
      `Encourage the user to try writing in ${language}.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: resolvedSystem }, ...messages],
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return Response.json({ error: text }, { status: res.status });
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const reply = data.choices?.[0]?.message?.content ?? "";
  return Response.json({ reply });
}
