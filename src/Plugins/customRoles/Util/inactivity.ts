export const dayMs = 86_400_000;

export interface WatchState {
 since: number;
 reset: boolean;
}

export const watchWindow = (
 beat: number,
 since: number,
 now: number,
 tolerance: number,
): WatchState =>
 beat > 0 && since > 0 && now - beat <= tolerance
  ? { since, reset: false }
  : { since: now, reset: true };

export interface CoverageInput {
 now: number;
 serviceSince: number;
 trackingSince: number;
 observedAt: number;
 countsOnline: boolean;
 presenceBeat: number;
 presenceSince: number;
 presenceTolerance: number;
}

export const coverageStart = (input: CoverageInput): number => {
 const starts = [input.serviceSince, input.trackingSince];
 if (input.observedAt <= input.trackingSince) starts.push(input.now);
 if (input.countsOnline) {
  starts.push(
   watchWindow(input.presenceBeat, input.presenceSince, input.now, input.presenceTolerance).since,
  );
 }

 return Math.max(...starts);
};

export interface RewardPolicy {
 wipe: boolean;
 sources: string[];
 threshold: number;
 since: number;
 trackingSince: number;
}

export const inactiveUnder = (
 policy: RewardPolicy,
 activity: Map<string, number>,
 now: number,
): boolean => {
 if (!policy.wipe || policy.threshold < dayMs) return false;
 if (now - policy.since < policy.threshold) return false;

 const last = Math.max(policy.trackingSince, ...policy.sources.map((source) => activity.get(source) ?? 0));

 return last < now - policy.threshold;
};

export const shouldWipe = (
 granting: RewardPolicy[],
 activity: Map<string, number>,
 now: number,
): boolean => granting.length > 0 && granting.every((policy) => inactiveUnder(policy, activity, now));
