import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response("Missing id", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: entry, error } = await supabase
    .from("entries")
    .select("title, description, thumbnail_url, date, baby_id")
    .eq("id", id)
    .single();

  if (error || !entry) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const { data: baby } = await supabase
    .from("babies")
    .select("name")
    .eq("id", entry.baby_id)
    .single();

  const babyName = baby?.name ?? "Baby";
  const title = entry.title || `${babyName}'s memory`;
  const description = entry.description
    ? entry.description.slice(0, 200)
    : `${babyName}'s memory`;

  return new Response(
    JSON.stringify({
      title,
      description,
      thumbnail_url: entry.thumbnail_url ?? null,
      date: entry.date,
      baby_name: babyName,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
