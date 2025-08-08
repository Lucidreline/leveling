import { RRule, RRuleSet, rrulestr } from "rrule";

/**
 * Return the next occurrence after `from` (inclusive) given an RRULE string.
 * If `anchor` is provided, it seeds the series.
 */
export function getNextOccurrence(rruleStr: string, from = new Date(), anchor?: string): Date | null {
  let rule: RRule | RRuleSet;
  try {
    rule = rrulestr(rruleStr, { unfold: true }) as RRule | RRuleSet;
  } catch {
    return null;
  }
  const dtstart = anchor ? new Date(anchor) : undefined;
  // If the rule had no DTSTART, we can add one by rebuilding it with dtstart
  if (dtstart && rule instanceof RRule && !rule.options.dtstart) {
    const opts = { ...rule.options, dtstart };
    const rebuilt = new RRule(opts);
    return rebuilt.after(from, true) ?? null;
  }
  return rule.after(from, true) ?? null;
}

/** Helper: get browser timezone string */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** ISO date (yyyy-mm-dd) for grouping “today/tomorrow” logic client-side */
export function isoDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
