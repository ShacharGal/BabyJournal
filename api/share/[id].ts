import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = "https://mcbhiwqtzdjkwqbljjdq.supabase.co";
const APP_URL = "https://baby-journal-sepia.vercel.app";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;

  let title = "Baby Journal";
  let description = "A precious memory";
  let image = `${APP_URL}/favicon.svg`;

  try {
    const resp = await fetch(
      `${SUPABASE_URL}/functions/v1/entry-meta?id=${encodeURIComponent(id ?? "")}`
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

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(`<!doctype html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${escHtml(title)}</title>
  <meta property="og:title" content="${escHtml(title)}"/>
  <meta property="og:description" content="${escHtml(description)}"/>
  <meta property="og:image" content="${escHtml(image)}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${escHtml(entryUrl)}"/>
  <meta http-equiv="refresh" content="0;url=${escHtml(entryUrl)}"/>
</head>
<body>
  <a href="${escHtml(entryUrl)}">View memory →</a>
  <script>window.location.replace(${JSON.stringify(entryUrl)});</script>
</body>
</html>`);
}
