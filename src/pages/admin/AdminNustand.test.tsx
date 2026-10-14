import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: "owner" },
    userRole: "admin" as string | null,
    isLoading: false,
    isRoleLoading: false,
  },
  load: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/components/admin/AdminLayout", () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/features/nustand/api", () => ({
  loadRows: mocks.load,
  importRows: vi.fn(),
  saveReview: vi.fn(),
  exportCurrentContacts: vi.fn(),
  copyCurrentContact: vi.fn(),
}));
import { AdminNustand } from "./AdminNustand";
beforeEach(() => {
  mocks.auth = {
    user: { id: "owner" },
    userRole: "admin",
    isLoading: false,
    isRoleLoading: false,
  };
  mocks.load.mockReset();
});
afterEach(cleanup);
it("fails closed on an unknown role without querying private records", () => {
  mocks.auth.userRole = null;
  render(<AdminNustand />);
  expect(screen.getByText("Nustand is private.")).toBeInTheDocument();
  expect(mocks.load).not.toHaveBeenCalled();
});
it("does not expose import controls when server authorization fails", async () => {
  mocks.load.mockRejectedValue(new Error("denied"));
  render(<AdminNustand />);
  await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  expect(screen.queryByLabelText("Load pilot results")).not.toBeInTheDocument();
});
it("removes private rows immediately when accounts change", async () => {
  mocks.load.mockResolvedValue([]);
  const view = render(<AdminNustand />);
  await screen.findByLabelText("Load pilot results");
  mocks.auth = { ...mocks.auth, user: { id: "another" } };
  mocks.load.mockReturnValue(new Promise(() => {}));
  view.rerender(<AdminNustand />);
  expect(screen.queryByLabelText("Load pilot results")).not.toBeInTheDocument();
});
