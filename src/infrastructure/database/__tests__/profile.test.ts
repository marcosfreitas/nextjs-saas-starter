import type { SupabaseClient } from '@supabase/supabase-js';
import { isOnboarded } from '@/infrastructure/database/profile';

type Result = { data: unknown; error: unknown };

/** A stand-in for the query chain: each table answers with a fixed result. */
function fakeClient(results: Record<string, Result>): SupabaseClient {
  const chain = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'limit']) builder[m] = () => builder;
    builder.maybeSingle = async () => results[table];
    return builder;
  };
  return { from: (table: string) => chain(table) } as unknown as SupabaseClient;
}

const ok = (data: unknown): Result => ({ data, error: null });

describe('isOnboarded', () => {
  it('passes when the profile is onboarded and the current terms are accepted', async () => {
    const client = fakeClient({
      profiles: ok({ onboarded_at: '2026-11-01T00:00:00Z' }),
      consents: ok({ id: 'c1' }),
    });
    await expect(isOnboarded(client, 'u1', '2026-10-25')).resolves.toBe(true);
  });

  it('fails when the profile is not onboarded', async () => {
    const client = fakeClient({ profiles: ok({ onboarded_at: null }), consents: ok({ id: 'c1' }) });
    await expect(isOnboarded(client, 'u1', '2026-10-25')).resolves.toBe(false);
  });

  it('fails when there is no acceptance for the current terms version', async () => {
    const client = fakeClient({
      profiles: ok({ onboarded_at: '2026-11-01T00:00:00Z' }),
      consents: ok(null),
    });
    await expect(isOnboarded(client, 'u1', '2026-12-01')).resolves.toBe(false);
  });

  it('fails closed when the profile cannot be read', async () => {
    const client = fakeClient({ profiles: { data: null, error: new Error('down') }, consents: ok({ id: 'c1' }) });
    await expect(isOnboarded(client, 'u1', '2026-10-25')).resolves.toBe(false);
  });

  it('fails closed when the consent read errors', async () => {
    const client = fakeClient({
      profiles: ok({ onboarded_at: '2026-11-01T00:00:00Z' }),
      consents: { data: null, error: new Error('down') },
    });
    await expect(isOnboarded(client, 'u1', '2026-10-25')).resolves.toBe(false);
  });
});
