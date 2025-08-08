// src/lib/milestones.ts

export type Milestone = {
  milestone_name: string;
  reward_percentage: number; // 0..100
  is_complete: boolean;
  completedAt?: any; // Timestamp (server)
};

/**
 * Validate that milestone percentages are in [0,100] and total <= 100.
 * Returns { ok, total, error }.
 */
export function validateMilestones(ms: Milestone[]) {
  const total = ms.reduce((sum, m) => sum + (Number(m.reward_percentage) || 0), 0);
  if (ms.some((m) => m.reward_percentage < 0 || m.reward_percentage > 100)) {
    return { ok: false, total, error: "Each milestone % must be between 0 and 100." };
  }
  if (total > 100) {
    return { ok: false, total, error: `Milestone percentages total ${total}%, which exceeds 100%.` };
  }
  return { ok: true, total, error: "" };
}

/**
 * Given final_reward and milestones, compute how much XP to award for a single milestone index.
 * Rule:
 * - Let T = sum of all milestone % (clamped by validate to <=100).
 * - If T == 0: milestones pay nothing.
 * - Each milestone pays: final_reward * (m.reward_percentage / T) * T/100 = final_reward * (m.reward_percentage / 100)
 *   …i.e., its literal percentage of final_reward.
 * - The quest completion (when toggled complete) pays the remainder: final_reward * (1 - T/100).
 *
 * (This matches your examples: 4×25% → each pays 25%, completion pays 0.
 *  2×30% → each milestone pays 30%, completion pays 40%.)
 */
export function payoutForMilestone(final_reward: number, milestonePercent: number) {
  const pct = Math.max(0, Math.min(100, Number(milestonePercent) || 0));
  const amt = Math.round((final_reward * pct) / 100);
  return amt;
}

/** Payout at quest completion given total milestone % */
export function payoutForQuestCompletion(final_reward: number, totalMilestonePct: number) {
  const t = Math.max(0, Math.min(100, Number(totalMilestonePct) || 0));
  const amt = Math.round(final_reward * (1 - t / 100));
  return amt;
}
