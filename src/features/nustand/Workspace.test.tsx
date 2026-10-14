import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Workspace } from "./Workspace";
import { emptyReview, type Row } from "./model";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("previews CSV before saving and paginates the imported list", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const input =
    "Name,Address,City,Notes\n" +
    Array.from(
      { length: 260 },
      (_, i) => `Space ${i},${i} Main St,New York,Keep ${i}`,
    ).join("\n");
  const onImport = vi.fn().mockImplementation(async (rows) => rows);
  render(<Workspace onImport={onImport} />);
  fireEvent.change(screen.getByLabelText("Import spaces"), {
    target: {
      files: [
        { name: "list.csv", size: input.length, text: async () => input },
      ],
    },
  });
  await screen.findByText(/260 records parsed/);
  expect(onImport).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Add new spaces" }));
  await screen.findByText("Page 1 of 11");
  expect(onImport).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByRole("button", { name: "Review Space 25" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("Page 2 of 11")).toBeInTheDocument();
  expect(
    screen.getAllByRole("button", { name: "Review Space 25" }),
  ).not.toHaveLength(0);
});
function row(): Row {
  return {
    source: {
      id: "test",
      name: "Example Space",
      do_not_contact: false,
      original_record: { notes: "Preserve original" },
      contacts: [
        {
          id: "e",
          kind: "email",
          value: "hello@example.org",
          quality_status: "observed_on_website",
          review_reasons: [],
          evidence: [],
        },
      ],
      fit: { score: null, uncertainties: [] },
      job: { status: "completed" },
    },
    review: emptyReview(),
    version: 0,
  };
}
describe("Prospect workflow", () => {
  it("saves contact decisions and notes without changing source data", async () => {
    const r = row();
    const original = JSON.stringify(r.source);
    const onSave = vi.fn().mockResolvedValue(1);
    render(<Workspace initialRows={[r]} onSave={onSave} />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Review Example Space" })[0],
    );
    fireEvent.change(screen.getByLabelText("Decision for hello@example.org"), {
      target: { value: "accepted" },
    });
    fireEvent.change(screen.getByLabelText("Review notes"), {
      target: { value: "Buyer checked" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save review" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][1].contacts.e).toBe("accepted");
    expect(onSave.mock.calls[0][1].notes).toBe("Buyer checked");
    expect(JSON.stringify(r.source)).toBe(original);
  });
  it("retains edits and reports a failed database save", async () => {
    render(
      <Workspace
        initialRows={[row()]}
        onSave={vi.fn().mockRejectedValue(new Error("Reload before saving"))}
      />,
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Review Example Space" })[0],
    );
    fireEvent.change(screen.getByLabelText("Review notes"), {
      target: { value: "Keep this draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save review" }));
    await waitFor(() =>
      expect(screen.getAllByRole("alert")[0]).toHaveTextContent(
        "Reload before saving",
      ),
    );
    expect(screen.getByLabelText("Review notes")).toHaveValue(
      "Keep this draft",
    );
  });
  it("filters spaces and disables exports before qualification", () => {
    render(<Workspace initialRows={[row()]} />);
    expect(
      screen.getByRole("button", { name: "Export qualified contacts" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Search spaces"), {
      target: { value: "Not present" },
    });
    expect(
      screen.getByText("No spaces match these filters."),
    ).toBeInTheDocument();
  });
  it("blocks a stale-tab export when the current server check fails", async () => {
    const r = row();
    r.review.stage = "Qualified";
    r.review.contacts.e = "accepted";
    const onExport = vi
      .fn()
      .mockRejectedValue(new Error("Current decisions could not be checked"));
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    render(
      <Workspace initialRows={[r]} onSave={vi.fn()} onExport={onExport} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Export qualified contacts" }),
    );
    await screen.findByText("Current decisions could not be checked");
    expect(onExport).toHaveBeenCalledWith(["test"]);
    expect(click).not.toHaveBeenCalled();
  });
  it("requires a saved acceptance before copying a contact", () => {
    render(<Workspace initialRows={[row()]} />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Review Example Space" })[0],
    );
    fireEvent.change(screen.getByLabelText("Decision for hello@example.org"), {
      target: { value: "accepted" },
    });
    expect(
      screen.queryByRole("button", { name: "Copy accepted contact" }),
    ).not.toBeInTheDocument();
  });
  it("does not copy a contact whose saved decision has changed", async () => {
    const r = row();
    r.review.contacts.e = "accepted";
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const onCopy = vi
      .fn()
      .mockRejectedValue(new Error("This space is suppressed"));
    render(<Workspace initialRows={[r]} onSave={vi.fn()} onCopy={onCopy} />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Review Example Space" })[0],
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Copy accepted contact" }),
    );
    await waitFor(() =>
      expect(screen.getAllByRole("alert")[0]).toHaveTextContent(
        "This space is suppressed",
      ),
    );
    expect(writeText).not.toHaveBeenCalled();
  });
  it("does not download an in-flight export after the workspace unmounts", async () => {
    const r = row();
    r.review.stage = "Qualified";
    r.review.contacts.e = "accepted";
    let finish: (csv: string) => void;
    const onExport = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const view = render(
      <Workspace initialRows={[r]} onSave={vi.fn()} onExport={onExport} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Export qualified contacts" }),
    );
    view.unmount();
    finish!("Name,Email");
    await Promise.resolve();
    await Promise.resolve();
    expect(click).not.toHaveBeenCalled();
  });
});
