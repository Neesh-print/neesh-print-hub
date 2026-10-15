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
      screen.getByRole("button", { name: "Find leads" }),
    ).toBeEnabled(),
  );
  fireEvent.change(screen.getByLabelText("Discovery area"), {
    target: { value: "Brooklyn" },
  });
  fireEvent.change(screen.getByLabelText("Discovery segment"), {
    target: { value: "Presence" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Find leads" }));
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
  expect(screen.getByRole("button", { name: /Add\s+selected/ })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: /Add 1 selected/ }));
  await waitFor(() =>
    expect(mocks.research).toHaveBeenCalledWith(["osm:node:1"]),
  );
  expect(mocks.import.mock.calls[0][0][0].review.contacts).toEqual({});
});

it("shows tagged new leads, hides ones you already have, and adds all at once", async () => {
  const lead = (id: string, name: string, website: string) => ({
    id, name, city: "New York", website, neighborhood: "Fort Greene", space_type: "Hair salon",
    original_record: { address: "12 Lafayette Ave" }, do_not_contact: false, contacts: [],
    job: { status: "not_started" }, fit: { score: null, segment: "Wait" },
  });
  mocks.status.mockResolvedValue({
    enabled: true,
    jobs: [{
      id: "job", kind: "discovery", prospect_id: null, status: "completed", finished_at: "2026-10-15",
      input: { area: "Brooklyn", segment: "Wait", neighborhood: "Fort Greene" },
      result: { attribution: "Google Places", candidates: [
        lead("gp:1", "Salon Nordic", "https://salon.example"),
        lead("gp:2", "Known Spa", "https://www.known.example"),
        lead("gp:3", "Calm Dental", "https://calm.example"),
      ] },
    }],
  });
  mocks.import.mockResolvedValue(2);
  mocks.research.mockResolvedValue(2);
  const existing = [{ source: { ...lead("csv:9", "Different Name", "https://known.example/"), fit: { score: null, segment: null, uncertainties: [] } }, review: { stage: "New", segment: "", notes: "", next_follow_up: "", do_not_contact: false, contacts: {}, fit_score: null }, version: 1 }];
  render(<ResearchPanel rows={existing as never} onRefresh={refresh} />);
  await screen.findByText(/2 new leads, 1 you already have/);
  expect(screen.queryByText("Known Spa")).toBeNull();
  expect(screen.getAllByText(/Hair salon · Fort Greene · ICP: Wait/)).toHaveLength(2);
  expect(screen.getByText(/Places from Google/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Add all 2 and find contacts" }));
  await waitFor(() => expect(mocks.research).toHaveBeenCalledWith(["gp:1", "gp:3"]));
});
