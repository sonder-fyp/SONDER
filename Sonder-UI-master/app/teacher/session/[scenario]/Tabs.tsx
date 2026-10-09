import { RouteTabs } from "@/components/app/RouteTabs";
import { studentForScenario } from "@/fixtures/students";
import { STUDENT_HISTORY } from "@/fixtures/insights/student-history";
import type { ScenarioId } from "@/fixtures/scenarios/types";

export function SessionTabs({ scenarioId }: { scenarioId: ScenarioId }) {
  const student = studentForScenario(scenarioId);
  const hasInsights = student ? Boolean(STUDENT_HISTORY[student.id]) : false;

  return (
    <RouteTabs
      tabs={[
        { label: "Evidence", href: `/teacher/session/${scenarioId}` },
        { label: "Review", href: `/teacher/session/${scenarioId}/review` },
        ...(hasInsights && student
          ? [
              {
                label: "Student insights",
                href: `/teacher/students/${student.id}/insights`,
              },
            ]
          : []),
      ]}
    />
  );
}
