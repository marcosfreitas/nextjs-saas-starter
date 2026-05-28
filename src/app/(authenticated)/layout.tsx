import { redirect } from 'next/navigation';
import { getCurrentUserOrNull } from '@/infrastructure/database/auth-session';

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserOrNull();
  if (!user) redirect('/auth/sign-in');

  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
