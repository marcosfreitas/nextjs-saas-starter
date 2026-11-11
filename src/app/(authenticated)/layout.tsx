import { redirect } from 'next/navigation';
import { getCurrentUserOrNull } from '@/infrastructure/database/auth-session';
import { createClient } from '@/infrastructure/database/server';
import { isOnboarded } from '@/infrastructure/database/profile';

/**
 * The navigation gate for the signed-in area. It only redirects, never throws:
 * a throw here would turn every page of the group into an error screen.
 *
 * Pages in this group do not rely on this layout for security. Each data read
 * and write goes through `getCurrentUser()`, which checks onboarding again.
 */
export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserOrNull();
  if (!user) redirect('/auth/sign-in');

  const supabase = await createClient();
  if (!(await isOnboarded(supabase, user.id))) redirect('/onboarding');

  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
