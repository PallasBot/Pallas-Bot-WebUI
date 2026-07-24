import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchConsoleSetupStatus } from "@/api/fullConsole";

function allowsPendingSetup(pathname: string): boolean {
  return (
    pathname === "/setup" ||
    pathname === "/login" ||
    pathname === "/preferences" ||
    pathname.startsWith("/preferences/")
  );
}

function setupSatisfied(data: Awaited<ReturnType<typeof fetchConsoleSetupStatus>> | undefined): boolean {
  if (!data) return true;
  if (!data.requires_setup && !data.default_password_active) return true;
  return false;
}

export default function ConsoleSetupGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const setupQ = useQuery({
    queryKey: ["auth-setup"],
    queryFn: fetchConsoleSetupStatus,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!setupQ.isSuccess) return;
    if (allowsPendingSetup(location.pathname)) return;
    if (setupSatisfied(setupQ.data)) return;
    if (setupQ.data && !setupQ.data.requires_setup) return;
    const redirect = `${location.pathname}${location.search}${location.hash}`;
    navigate(
      {
        pathname: "/setup",
        search: redirect && redirect !== "/setup" ? `?redirect=${encodeURIComponent(redirect)}` : undefined,
      },
      { replace: true },
    );
  }, [setupQ.isSuccess, setupQ.data, location.pathname, location.search, location.hash, navigate]);

  return <>{children}</>;
}
