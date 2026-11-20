import { NextResponse } from "next/server";
import { withAccess } from "@/lib/auth/guard";
import { productErrorResponse } from "@/lib/classes/server";
import { engine } from "@/lib/diagnostic/server";
import { parseCatalogue } from "@/lib/diagnostic/validation";

export const runtime = "nodejs";

/** The units the running diagnostic service offers, so a teacher assigns only what students can start. */
export const GET = withAccess(["teacher"], async () => {
  try {
    const catalogue = await engine("/engine/units", parseCatalogue);
    return NextResponse.json(
      { units: catalogue.units.map(({ unit_id, name }) => ({ unit_id, name })), question_budget: catalogue.question_budget },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return productErrorResponse(error);
  }
});
