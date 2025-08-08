// functions/src/rruleUtil.ts
import { RRule, RRuleSet, rrulestr } from "rrule";

/**
 * Return the next occurrence after `from` (inclusive) given an RRULE string.
 * Optionally seed with an anchor (ISO timestamp).
 */
export function getNextOccurrence(rruleStr: string, from: Date, anchor?: string): Date | null {
  let rule: RRule | RRuleSet;
  try {
    rule = rrulestr(rruleStr, { unfold: true }) as RRule | RRuleSet;
  } catch {
    return null;
  }

  const dtstart = anchor ? new Date(anchor) : undefined;
  // If we have an anchor and the rule is a single RRule without dtstart, rebuild with dtstart
  if (dtstart && rule instanceof RRule && !rule.options.dtstart) {
    const opts = { ...rule.options, dtstart };
    const rebuilt = new RRule(opts);
    return rebuilt.after(from, true) ?? null;
  }

  return (rule as any).after(from, true) ?? null;
}
