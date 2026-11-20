import { Container, PageMasthead } from "@/components/layout";
import { StudentClasses } from "./StudentClasses";

export default function Page() {
  return (
    <Container className="pb-20">
      <PageMasthead label="Student" title="My classes" lede="Join your Mathematics class with the code from your teacher." />
      <StudentClasses />
    </Container>
  );
}
