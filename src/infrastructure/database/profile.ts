import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * True when the signed-in user has finished onboarding.
 *
 * Fails closed: a profile that cannot be read counts as not onboarded, so the
 * user goes to the onboarding step instead of past the consent step. The row is
 * readable only by its owner (RLS), so the caller's own session is enough.
 */
export async function isOnboarded(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) return false;
  return data?.onboarded_at != null;
}
