import Link from "next/link";
import { BrandMark } from "@/components/app/BrandMark";
import { ThemeToggle } from "@/components/app/ThemeToggle";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-dvh">
      <header className="mx-auto flex h-24 max-w-[1200px] items-center justify-between px-6 md:px-12">
        <Link href="/" aria-label="Sonder home">
          <BrandMark size={36} />
        </Link>
        <ThemeToggle />
      </header>
      <main
        id="main"
        className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-[1200px] items-center px-6 pb-16 pt-8 md:px-12"
      >
        <div className="w-full border-t border-border py-10 md:py-14">
          {children}
        </div>
      </main>
    </div>
  );
}
