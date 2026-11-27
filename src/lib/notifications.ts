// Shared notification shape (client + server).
export type NotificationKind = "missing_report" | "new_report" | "wir_issue";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  at: string; // ISO timestamp used for ordering and unread state
  unread: boolean;
};
