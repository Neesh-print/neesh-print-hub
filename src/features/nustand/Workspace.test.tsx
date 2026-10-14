import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Workspace } from "./Workspace";
import { emptyReview, type Row } from "./model";
afterEach(cleanup);
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
});
