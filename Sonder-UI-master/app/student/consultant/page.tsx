import { ChatConsultant } from "@/components/app/ChatConsultant";
import {
  STUDENT_PROMPTS,
  STUDENT_FALLBACK,
  STUDENT_GREETING,
} from "@/fixtures/consultant/student-thread";

export default function StudentConsultant() {
  return (
    <ChatConsultant
      config={{
        personaLabel: "AI Consultant",
        greeting: STUDENT_GREETING,
        prompts: STUDENT_PROMPTS,
        fallback: STUDENT_FALLBACK,
      }}
      label="Ask the consultant"
    />
  );
}
