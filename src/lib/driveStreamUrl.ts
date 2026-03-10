const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const driveStreamUrl = (fileId: string) =>
  `${SUPABASE_URL}/functions/v1/drive-stream?fileId=${encodeURIComponent(fileId)}`;
