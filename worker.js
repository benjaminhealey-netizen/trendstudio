const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/claude") {
      return env.ASSETS.fetch(request);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });
    }

    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured. Add it in Cloudflare Workers > Settings > Environment Variables." }),
        { status: 500, headers: CORS }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS });
    }

    const messages = body.system
      ? [{ role: "system", content: body.system }, ...body.messages]
      : body.messages;

    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1000,
        messages,
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: data.error?.message || "OpenAI API error" }),
        { status: upstream.status, headers: CORS }
      );
    }

    const text = data.choices?.[0]?.message?.content || "No response";
    return new Response(
      JSON.stringify({ content: [{ type: "text", text }] }),
      { status: 200, headers: CORS }
    );
  },
};
