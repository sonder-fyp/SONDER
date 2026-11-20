import { Container, PageMasthead } from "@/components/layout";
import { MathsTopicPicker } from "./MathsTopicPicker";
export default function Diagnostics() {
  return (
    <Container className="pb-20">
      <PageMasthead
        label="Your learning"
        title="Diagnostics"
        lede="Choose an available Mathematics topic. Start a check or pick up where you left off."
      />
      <MathsTopicPicker />
    </Container>
  );
}
