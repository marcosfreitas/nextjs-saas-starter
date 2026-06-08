import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">
        {process.env.NEXT_PUBLIC_APP_NAME ?? 'My SaaS'}
      </h1>
      <p className="text-muted-foreground">Your SaaS, ready to ship.</p>
      <div className="mt-2 flex gap-3">
        <Link
          href="/auth/sign-in"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Log in
        </Link>
        <Link
          href="/auth/sign-in"
          className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Sign up
        </Link>
      </div>
    </main>
  );
}
