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

  // One database function writes the consent row and sets onboarded_at together.
  // The profile has no direct update grant, so the gate cannot be passed by hand.
  const { error } = await supabase.rpc('complete_onboarding', { p_terms_version: TERMS_VERSION });
  if (error) throw error;

  redirect('/dashboard');
}
