"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MarkReadButton() {
  const router = useRouter();
  return (
    <Button
      onClick={() => {
        toast.success("Marked as read", {
          description: "You can find this again from My insights.",
        });
        router.push("/student");
      }}
    >
      <Check className="size-4" />
      Mark as read
    </Button>
  );
}
