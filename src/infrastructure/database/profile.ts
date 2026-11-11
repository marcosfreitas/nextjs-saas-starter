import type { SupabaseClient } from '@supabase/supabase-js';
import { TERMS_VERSION } from '@/config/legal';

/**
 * True when the signed-in user has finished onboarding for the current terms.
 *
 * Two facts must both hold: the profile is marked onboarded, and an acceptance
 * exists for the terms version in force. A new terms text bumps TERMS_VERSION, and
 * every account then goes back through the acceptance step, because an old
 * acceptance never covers a new text.
 *
 * Fails closed: a read error counts as not onboarded, so the user goes to the
 * onboarding step instead of past the consent step. Both tables are readable only
 * by their owner (RLS), so the caller's own session is enough.
 */
export async function isOnboarded(
  supabase: SupabaseClient,
  userId: string,
  termsVersion: string = TERMS_VERSION
): Promise<boolean> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', userId)
    .maybeSingle();
  if (profileError || profile?.onboarded_at == null) return false;

  const { data: consent, error: consentError } = await supabase
    .from('consents')
    .select('id')
    .eq('user_id', userId)
    .eq('document', 'terms')
    .eq('version', termsVersion)
    .limit(1)
    .maybeSingle();
  if (consentError) return false;
  return consent != null;
}
