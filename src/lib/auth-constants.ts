// Shared by the proxy (no database access) and the server-side auth layer.
export const SESSION_COOKIE = "dst_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days
export const userRoles = ["admin", "user"] as const;
export type UserRole = (typeof userRoles)[number];
