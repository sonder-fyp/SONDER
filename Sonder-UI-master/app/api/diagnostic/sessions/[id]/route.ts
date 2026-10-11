import { currentRoute } from "@/lib/diagnostic/routes";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return currentRoute(request, (await context.params).id);
}
