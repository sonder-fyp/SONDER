import { Landing } from "@/components/landing/Landing";

/**
 * Stays a server component so the metadata from layout.tsx applies statically and
 * the HTML shell streams immediately. All interactivity is one level down, which
 * is also what lets Landing use next/dynamic with ssr: false.
 */
export default function Home() {
  return <Landing />;
}
