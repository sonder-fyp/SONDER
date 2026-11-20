import { Container, PageMasthead } from "@/components/layout";
import { TeacherClasses } from "./TeacherClasses";

export default function Page() {
  return (
    <Container className="pb-20">
      <PageMasthead
        label="Teacher"
        title="Classes"
        lede="Create a Mathematics class and share its join code with your students."
      />
      <TeacherClasses />
    </Container>
  );
}
