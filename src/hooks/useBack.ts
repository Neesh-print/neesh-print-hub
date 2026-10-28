import { useLocation, useNavigate } from "react-router-dom";

/**
 * Back to wherever the user came from, keeping its tabs and filters; to
 * `fallback` when the page was opened directly (a link, a new tab).
 */
export function useBack(fallback: string) {
  const navigate = useNavigate();
  const location = useLocation();
  // React Router gives the first page of a visit the key "default".
  return () => (location.key !== "default" ? navigate(-1) : navigate(fallback));
}
