export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    new URL(request.url).protocol.slice(0, -1);

  if (!origin || !host || !/^https?$/i.test(protocol)) return false;

  try {
    const originUrl = new URL(origin);
    const requestOrigin = new URL(`${protocol}://${host}`);
    return originUrl.origin === origin && originUrl.origin === requestOrigin.origin;
  } catch {
    return false;
  }
}
