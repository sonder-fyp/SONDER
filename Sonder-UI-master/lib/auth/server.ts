import "server-only";
import { createNeonAuth, type NeonAuth } from "@neon/auth/next/server";

let instance: NeonAuth | undefined;

export function getAuth(): NeonAuth {
  if (instance) return instance;

  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret || secret.length < 32) {
    throw new Error("Neon Auth is not configured for this application.");
  }
  if (new URL(baseUrl).protocol !== "https:") {
    throw new Error("Neon Auth must use an HTTPS endpoint.");
  }

  instance = createNeonAuth({
    baseUrl,
    cookies: { secret },
  });
  return instance;
}

export async function getSignedInUser() {
  const { data, error } = await getAuth().getSession();
  if (error) throw new Error("Unable to verify the current authentication session.");
  return data?.user ?? null;
}
