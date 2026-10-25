'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/database/server';
import { TERMS_VERSION } from '@/config/legal';

export async function completeOnboarding(formData: FormData) {
  if (formData.get('accept') !== 'on') {
    throw new Error('The terms must be accepted to continue.');
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/sign-in');

  // Consent first: a row per acceptance, append-only. If the profile update below
  // fails, the user retries and the second row is the accurate record of that try.
  const { error: consentError } = await supabase.from('consents').insert({
    user_id: user.id,
    document: 'terms',
    version: TERMS_VERSION,
  });
  if (consentError) throw consentError;

  const { error } = await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) throw error;

  redirect('/dashboard');
}
