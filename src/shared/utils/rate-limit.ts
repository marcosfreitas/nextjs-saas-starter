import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { RateLimitError } from '@/shared/errors';

let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit {
  if (!ratelimit) {
    ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      analytics: true,
    });
  }
  return ratelimit;
}

export async function checkRateLimit(identifier: string): Promise<void> {
  const { success } = await getRatelimit().limit(identifier);
  if (!success) throw new RateLimitError();
}
