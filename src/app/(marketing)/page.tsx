export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">
        {process.env.NEXT_PUBLIC_APP_NAME ?? 'My SaaS'}
      </h1>
      <p className="text-muted-foreground">Your SaaS, ready to ship.</p>
    </main>
  );
}
