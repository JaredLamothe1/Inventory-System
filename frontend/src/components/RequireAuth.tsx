import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "@/hooks/useAuth";

type RequireAuthProps = {
  /** Optional: render children if you use <RequireAuth>...</RequireAuth> */
  children?: React.ReactNode;
  /** Optional: allow overriding where to send unauthenticated users */
  redirectTo?: string;
  /** Optional: what to render while auth is loading; default is nothing */
  renderWhileLoading?: React.ReactNode | null;
};

const RequireAuth: React.FC<RequireAuthProps> = ({
  children,
  redirectTo = "/login",
  renderWhileLoading = null,
}) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <>{renderWhileLoading}</>;

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  // Support BOTH patterns:
  // 1) Wrapper pattern: <RequireAuth><Layout/></RequireAuth>
  // 2) Route element pattern: <Route element={<RequireAuth/>}><Route element={<Layout/>}/></Route>
  return <>{children ?? <Outlet />}</>;
};

export default RequireAuth;
