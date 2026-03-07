const STORAGE_KEY = 'lp_onboarding';

export interface OnboardingState {
  apiKeyGenerated: boolean;
  sdkInstalled: boolean;
  firstCallMade: boolean;
  completedAt: string | null;
  dismissedAt: string | null;
}

const DEFAULT_STATE: OnboardingState = {
  apiKeyGenerated: false,
  sdkInstalled: false,
  firstCallMade: false,
  completedAt: null,
  dismissedAt: null,
};

export function getOnboardingState(): OnboardingState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

export function updateOnboarding(partial: Partial<OnboardingState>): void {
  const current = getOnboardingState();
  const updated = { ...current, ...partial };

  // Auto-complete if all steps done
  if (
    updated.apiKeyGenerated &&
    updated.sdkInstalled &&
    updated.firstCallMade &&
    !updated.completedAt
  ) {
    updated.completedAt = new Date().toISOString();
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function isOnboardingComplete(): boolean {
  const state = getOnboardingState();
  return !!state.completedAt;
}

export function dismissOnboarding(): void {
  updateOnboarding({ dismissedAt: new Date().toISOString() });
}

export function resetOnboarding(): void {
  localStorage.removeItem(STORAGE_KEY);
}
