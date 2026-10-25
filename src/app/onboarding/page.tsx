import { redirect } from 'next/navigation';
import { getCurrentUserOrNull } from '@/infrastructure/database/auth-session';
import { createClient } from '@/infrastructure/database/server';
import { isOnboarded } from '@/infrastructure/database/profile';
import { TERMS_VERSION } from '@/config/legal';
import { completeOnboarding } from './actions';

export default async function OnboardingPage() {
  const user = await getCurrentUserOrNull();
  if (!user) redirect('/auth/sign-in');

  const supabase = await createClient();
  if (await isOnboarded(supabase, user.id)) redirect('/dashboard');

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <form action={completeOnboarding} className="flex flex-col gap-4 w-full max-w-sm">
        <h1 className="text-2xl font-semibold">Welcome</h1>
        <p className="text-sm text-muted-foreground">
          Add the details this product needs here. Then accept the terms (version {TERMS_VERSION}).
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="accept" required className="mt-1" />
          <span>I accept the terms of use and the privacy policy.</span>
        </label>
        <button type="submit" className="rounded bg-black px-4 py-2 text-white">
          Continue
        </button>
      </form>
    </main>
  );
}
