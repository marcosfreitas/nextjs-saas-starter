import { isOnboardingExempt } from '@/shared/utils/onboarding-gate';

describe('isOnboardingExempt', () => {
  it('lets the onboarding and auth routes through', () => {
    expect(isOnboardingExempt('/onboarding')).toBe(true);
    expect(isOnboardingExempt('/auth/callback')).toBe(true);
    expect(isOnboardingExempt('/auth/sign-in')).toBe(true);
    expect(isOnboardingExempt('/api/v1/users')).toBe(true);
  });

  it('sends every other page to onboarding', () => {
    expect(isOnboardingExempt('/')).toBe(false);
    expect(isOnboardingExempt('/dashboard')).toBe(false);
  });

  it('does not treat a prefix as a match', () => {
    expect(isOnboardingExempt('/onboarding-old')).toBe(false);
    expect(isOnboardingExempt('/authority')).toBe(false);
    expect(isOnboardingExempt('/api-docs')).toBe(false);
  });
});
