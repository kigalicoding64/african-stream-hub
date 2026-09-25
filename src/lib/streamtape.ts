import { createClient } from "../integrations/supabase/client";

const supabase = createClient();

interface StreamtapeFile {
  id: string;
  name: string;
  url: string;
}

export async function uploadToStreamtape(file: File): Promise<string> {
  const login = import.meta.env.VITE_STREAMTAPE_LOGIN;
  const key = import.meta.env.VITE_STREAMTAPE_KEY;

  if (!login || !key) {
    throw new Error("Streamtape API login or key is not configured.");
  }

  // Request upload URL
  const uploadUrlResponse = await fetch(
    `https://api.streamtape.com/file/ul?login=${login}&key=${key}`
  );
  const uploadUrlData = await uploadUrlResponse.json();

  if (uploadUrlData.status !== 200) {
    throw new Error(`Failed to get upload URL: ${uploadUrlData.msg}`);
  }

  const uploadUrl = uploadUrlData.result.url;

  // Upload file
  const formData = new FormData();
  formData.append("file", file);

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });
  const uploadData = await uploadResponse.json();

  if (uploadData.status !== 200) {
    throw new Error(`Failed to upload file to Streamtape: ${uploadData.msg}`);
  }

  const fileId = uploadData.result.id;
  return `https://streamtape.com/e/${fileId}/`;
}

export async function getStreamtapeFiles(): Promise<StreamtapeFile[]> {
  const login = import.meta.env.VITE_STREAMTAPE_LOGIN;
  const key = import.meta.env.VITE_STREAMTAPE_KEY;

  if (!login || !key) {
    throw new Error("Streamtape API login or key is not configured.");
  }

  const response = await fetch(
    `https://api.streamtape.com/file/listfolder?login=${login}&key=${key}`
  );
  const data = await response.json();

  if (data.status !== 200) {
    throw new Error(`Failed to fetch Streamtape files: ${data.msg}`);
  }

  return data.result.files.map((file: any) => ({
    id: file.id,
    name: file.name,
    url: `https://streamtape.com/e/${file.id}/`,
  }));
}

export async function syncStreamtapeToSupabase(): Promise<number> {
  const files = await getStreamtapeFiles();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated.");
  }

  const upsertData = files.map((file) => ({
    owner_id: user.id,
    title: file.name,
    video_url: file.url,
    status: "ready",
    visibility: "public",
  }));

  const { error, count } = await supabase
    .from("videos")
    .upsert(upsertData, { onConflict: "video_url", ignoreDuplicates: true })
    .select()
    .count();

  if (error) {
    console.error("Error syncing Streamtape files to Supabase:", error);
    throw new Error("Failed to sync Streamtape files to Supabase.");
  }

  return count || 0;
}
