export function recommendModel(ramGb: number): string {
  if (ramGb >= 16) return 'large-v3';
  if (ramGb >= 8)  return 'small';
  return 'tiny';
}

// Recommendation based on currently free RAM — used in onboarding
export function recommendModelByAvailableRam(availableGb: number): string {
  if (availableGb > 6)  return 'large-v3';
  if (availableGb >= 4) return 'medium';
  if (availableGb >= 2) return 'small';
  return 'tiny';
}

// Minimum free RAM (GB) required to run each model without OOM risk
export const MODEL_MIN_RAM_GB: Record<string, number> = {
  'tiny':     1.0,
  'small':    1.5,
  'medium':   2.5,
  'large-v3': 5.0,
};

export function modelNeedsMoreRam(modelId: string, availableGb: number): boolean {
  const min = MODEL_MIN_RAM_GB[modelId] ?? 0;
  return availableGb < min;
}
