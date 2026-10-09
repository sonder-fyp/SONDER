import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DataTable } from "./DataTable";

afterEach(() => {
  cleanup();
});

const COLUMNS = [
  { key: "name", header: "Student", cell: (row: { id: string; name: string }) => row.name },
  { key: "topic", header: "Topic", cell: () => "Rounding" },
];

describe("DataTable", () => {
  it("marks the header with a SectionRule and selected rows with a left accent", () => {
    render(
      <DataTable
        caption="Class"
        columns={COLUMNS}
        rows={[
          { id: "a", name: "Amina" },
          { id: "b", name: "Bilal" },
        ]}
        getRowKey={(row) => row.id}
        onRowClick={vi.fn()}
        isRowSelected={(row) => row.id === "b"}
      />,
    );

    expect(document.querySelector("[data-slot=section-rule]")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Student" })).toBeTruthy();

    const selected = screen.getByRole("row", { name: /Bilal/ });
    expect(selected.getAttribute("aria-current")).toBe("true");
    expect(selected.className).toContain("bg-muted");
    expect(selected.querySelector("[data-slot=row-accent]")).toBeTruthy();

    const idle = screen.getByRole("row", { name: /Amina/ });
    expect(idle.getAttribute("aria-current")).toBeNull();
    expect(idle.querySelector("[data-slot=row-accent]")).toBeNull();
  });
});
