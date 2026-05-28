import { getCurrentUser } from '@/infrastructure/database/auth-session';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground mt-1">Welcome, {user.email}</p>
    </main>
  );
}
