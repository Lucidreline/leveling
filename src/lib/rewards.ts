export type RewardCalc = {
  initial_reward: number;
  bonus_amount: number; // can be negative
  final_reward: number;
  bonus_multiplier: number;
};

function round(n: number) {
  return Math.max(0, Math.round(n));
}

/**
 * base: quest=1.0, sidequest=0.75, task=0.5
 * difficulty: 1..100
 * if bonus=true, multiply by random 0.75..1.25 and record the delta
 */
export function computeReward(
  kind: "quest" | "sidequest" | "task",
  difficulty: number,
  bonus: boolean
): RewardCalc {
  const base =
    kind === "quest" ? 1 : kind === "sidequest" ? 0.75 : 0.5;
  const initial = round(difficulty * base);

  const r = bonus ? 0.75 + Math.random() * 0.5 : 1; // 0.75..1.25
  const finalR = round(initial * r);
  const bonusAmt = finalR - initial;

  return {
    initial_reward: initial,
    bonus_amount: bonusAmt,
    final_reward: finalR,
    bonus_multiplier: r,
  };
}
