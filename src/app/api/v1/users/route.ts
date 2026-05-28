import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, handleError } from '@/shared/utils/api-handler';
import { getCurrentUser } from '@/infrastructure/database/auth-session';
import { createClient } from '@/infrastructure/database/server';
import { UserRepository } from '@/infrastructure/repositories/user.repository';
import { GetUserService } from '@/core/users/services/get-user.service';

export async function GET(_req: NextRequest) {
  try {
    const authUser = await getCurrentUser();
    const supabase = await createClient();
    const repo = new UserRepository(supabase);
    const service = new GetUserService(repo);
    const user = await service.execute(authUser.id);
    return ok(user);
  } catch (err) {
    return handleError(err);
  }
}

const UpdateSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function PATCH(req: NextRequest) {
  try {
    const authUser = await getCurrentUser();
    const body = UpdateSchema.parse(await req.json());
    const supabase = await createClient();
    const repo = new UserRepository(supabase);
    const user = await repo.upsert({ id: authUser.id, email: authUser.email!, name: body.name });
    return ok(user);
  } catch (err) {
    return handleError(err);
  }
}
