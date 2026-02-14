import type { ReactNode } from "react";
import { decodeJwt } from "@/lib/jwt";

interface CanProps {
  I: string; // The permission (e.g., "Cards.Create")
  children: ReactNode;
  fallback?: ReactNode;
}

export function Can({ I, children, fallback = null }: CanProps) {
  const token = localStorage.getItem("accessToken");
  if (!token) return <>{fallback}</>;

  const decoded = decodeJwt(token);
  if (!decoded) return <>{fallback}</>;

  const roles = (decoded.roles || "")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
  if (roles.includes("system_admin") || roles.includes("Platform Admin")) {
      return <>{children}</>;
  }

  const permissions = Array.isArray(decoded.permissions) 
    ? decoded.permissions 
    : decoded.permissions ? [decoded.permissions] : [];

  if (permissions.includes(I)) {
      return <>{children}</>;
  }

  return <>{fallback}</>;
}
