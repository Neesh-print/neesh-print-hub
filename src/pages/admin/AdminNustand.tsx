import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Workspace } from "@/features/nustand/Workspace";
import { importRows, loadRows, saveReview } from "@/features/nustand/api";
import type { Row } from "@/features/nustand/model";

export function AdminNustand() {
  const { user, userRole, isLoading, isRoleLoading } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<{
    userId: string;
    rows?: Row[];
    error?: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    setState(null);
    if (userId && userRole === "admin" && !isLoading && !isRoleLoading) {
      loadRows()
        .then((rows) => {
          if (active) setState({ userId, rows });
        })
        .catch(() => {
          if (active)
            setState({
              userId,
              error:
                "Nustand is not available for this account yet. Private database setup and owner access must be enabled before loading prospects.",
            });
        });
    }
    return () => {
      active = false;
    };
  }, [userId, userRole, isLoading, isRoleLoading]);
  if (isLoading || isRoleLoading)
    return <p className="p-8">Checking access…</p>;
  if (!user || userRole !== "admin")
    return <p className="p-8">Nustand is private.</p>;
  return (
    <AdminLayout>
      {state?.userId !== user.id ? (
        <p className="p-8">Checking private workspace…</p>
      ) : state.error ? (
        <p role="alert" className="p-8">
          {state.error}
        </p>
      ) : state.rows ? (
        <Workspace
          key={user.id}
          initialRows={state.rows}
          onSave={saveReview}
          onImport={async (rows) => {
            await importRows(rows);
            return loadRows();
          }}
        />
      ) : null}
    </AdminLayout>
  );
}
