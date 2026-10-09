import { ChatConsultant } from "@/components/app/ChatConsultant";
import {
  TEACHER_PROMPTS,
  TEACHER_FALLBACK,
  TEACHER_GREETING,
} from "@/fixtures/consultant/teacher-thread";

export default function TeacherConsultant() {
  return (
    <ChatConsultant
      config={{
        personaLabel: "AI Consultant",
        greeting: TEACHER_GREETING,
        prompts: TEACHER_PROMPTS,
        fallback: TEACHER_FALLBACK,
      }}
      label="Ask the consultant"
    />
  );
}
