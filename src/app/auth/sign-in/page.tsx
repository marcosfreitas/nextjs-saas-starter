'use client';

import { useState } from 'react';
import { createClient } from '@/infrastructure/database/client';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
    setSent(true);
  }

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-center">Check your email for a sign-in link.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border rounded px-3 py-2"
        />
        <button type="submit" className="bg-primary text-primary-foreground rounded px-4 py-2">
          Send link
        </button>
      </form>
    </main>
  );
}
