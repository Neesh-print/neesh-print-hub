import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  discover: vi.fn(),
  import: vi.fn(),
  research: vi.fn(),
}));
vi.mock("./api", () => ({
  researchStatus: mocks.status,
  discoverSpaces: mocks.discover,
  importRows: mocks.import,
  queueResearch: mocks.research,
}));
import { ResearchPanel } from "./ResearchPanel";
const refresh = vi.fn().mockResolvedValue(undefined);
beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.status.mockResolvedValue({ enabled: true, jobs: [] });
  refresh.mockClear();
});
afterEach(cleanup);
it("queues a bounded discovery with the selected area and segment", async () => {
  mocks.discover.mockResolvedValue("job");
  render(<ResearchPanel rows={[]} onRefresh={refresh} />);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Discover spaces" }),
    ).toBeEnabled(),
  );
  fireEvent.change(screen.getByLabelText("Discovery area"), {
    target: { value: "Brooklyn" },
  });
  fireEvent.change(screen.getByLabelText("Discovery segment"), {
    target: { value: "Presence" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Discover spaces" }));
  await waitFor(() =>
    expect(mocks.discover).toHaveBeenCalledWith("Brooklyn", "Presence", ""),
  );
});
it("does not import or research discovered spaces without selection and confirmation", async () => {
  const source = {
    id: "osm:node:1",
    name: "New Space",
    city: "New York",
    website: "https://example.org",
    original_record: { address: "10 Main St" },
    do_not_contact: false,
    contacts: [],
    job: { status: "not_started" },
    fit: { score: null },
  };
  mocks.status.mockResolvedValue({
    enabled: true,
    jobs: [
      {
        id: "job",
        kind: "discovery",
        prospect_id: null,
        status: "completed",
        finished_at: "2026-10-14",
        input: { area: "Manhattan", segment: "Catalog" },
        result: { candidates: [source] },
      },
    ],
  });
  mocks.import.mockResolvedValue(1);
  mocks.research.mockResolvedValue(1);
  render(<ResearchPanel rows={[]} onRefresh={refresh} />);
  await screen.findByText(/New Space/);
  expect(mocks.import).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Add selected and research" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Add selected and research" }),
  );
  await waitFor(() =>
    expect(mocks.research).toHaveBeenCalledWith(["osm:node:1"]),
  );
  expect(mocks.import.mock.calls[0][0][0].review.contacts).toEqual({});
});
