import { Container, PageMasthead } from "@/components/layout";
import { StudentHistory } from "./StudentHistory";

export default function Page() {
  return (
    <Container className="pb-20">
      <PageMasthead label="Your learning" title="Past checks"
        lede="Every check you have started, newest first. Unfinished ones can be resumed where you left off." />
      <StudentHistory />
    </Container>
  );
}
