import { answerRoute } from "@/lib/diagnostic/routes";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return answerRoute(request, (await context.params).id);
}
