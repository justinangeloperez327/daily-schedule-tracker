// The server runs in UTC, but schedules and reports use the site's calendar date.
// Override with SITE_TIME_ZONE (IANA name) if the sites are not in the UAE.
export const SITE_TIME_ZONE = process.env.SITE_TIME_ZONE || "Asia/Dubai";

// YYYY-MM-DD for "today" at the site.
export function siteToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}
