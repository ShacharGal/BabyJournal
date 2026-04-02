const SUPABASE_URL = "https://mcbhiwqtzdjkwqbljjdq.supabase.co";
const APP_URL = "https://baby-journal-sepia.vercel.app";

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const config = {
  matcher: "/share/:id*",
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const id = url.pathname.split("/share/")[1];
  if (!id) return;

  // Only serve OG HTML to crawlers/bots; let browsers through to the SPA
  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  const isBot =
    /bot|crawl|spider|facebookexternalhit|whatsapp|telegram|slack|discord|twitterbot|linkedinbot|preview/i.test(
      ua
    );

  if (!isBot) {
    // Rewrite to /entry/:id so the SPA handles it directly
    return Response.redirect(`${APP_URL}/entry/${id}`, 302);
  }

  let title = "Baby Journal";
  let description = "A precious memory";
  let image = `${APP_URL}/favicon.svg`;

  try {
    const resp = await fetch(
      `${SUPABASE_URL}/functions/v1/entry-meta?id=${encodeURIComponent(id)}`
    );
    if (resp.ok) {
      const meta = await resp.json();
      if (meta.title) title = meta.title;
      if (meta.description) description = meta.description;
      if (meta.thumbnail_url) image = meta.thumbnail_url;
    }
  } catch (_) {
    // fall through to defaults
  }

  const entryUrl = `${APP_URL}/entry/${id}`;

  return new Response(
    `<!doctype html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${escHtml(title)}</title>
  <meta property="og:title" content="${escHtml(title)}"/>
  <meta property="og:description" content="${escHtml(description)}"/>
  <meta property="og:image" content="${escHtml(image)}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${escHtml(entryUrl)}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${escHtml(title)}"/>
  <meta name="twitter:description" content="${escHtml(description)}"/>
  <meta name="twitter:image" content="${escHtml(image)}"/>
  <meta http-equiv="refresh" content="0;url=${escHtml(entryUrl)}"/>
</head>
<body>
  <a href="${escHtml(entryUrl)}">View memory →</a>
</body>
</html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}
