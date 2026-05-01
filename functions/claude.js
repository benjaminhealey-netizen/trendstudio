export async function onRequestPost(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  const apiKey = context.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY not configured. Add it in Cloudflare Pages > Settings > Environment Variables." }),
      { status: 500, headers: corsHeaders }
    );
  }

  let body;
  try {
    body = await context.request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders });
  }

  const messages = body.system
    ? [{ role: "system", content: body.system }, ...body.messages]
    : body.messages;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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

  const data = await response.json();

  const text = data.choices?.[0]?.message?.content || data.error?.message || "No response";
  const normalized = { content: [{ type: "text", text }] };

  return new Response(JSON.stringify(normalized), {
    status: response.status,
    headers: corsHeaders,
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
