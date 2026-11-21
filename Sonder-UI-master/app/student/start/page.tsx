import { redirect } from "next/navigation";

/** Self-start was retired on 18 Nov 2026: checks start from an assignment. Old links land on the home. */
export default function Diagnostics() {
  redirect("/student");
}
