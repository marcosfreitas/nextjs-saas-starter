import { redirect } from 'next/navigation';
import { getCurrentUserForPage } from '@/infrastructure/database/auth-session';
import { ForbiddenError } from '@/shared/errors';

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

const mockGetUser = jest.fn();
const mockIsOnboarded = jest.fn();

jest.mock('@/infrastructure/database/server', () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));
jest.mock('@/infrastructure/database/profile', () => ({
  isOnboarded: (...args: unknown[]) => mockIsOnboarded(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getCurrentUserForPage', () => {
  it('returns the user when signed in and onboarded', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.c' } }, error: null });
    mockIsOnboarded.mockResolvedValue(true);
    await expect(getCurrentUserForPage()).resolves.toMatchObject({ id: 'u1' });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects to sign-in when there is no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getCurrentUserForPage()).rejects.toThrow('NEXT_REDIRECT /auth/sign-in');
    expect(redirect).toHaveBeenCalledWith('/auth/sign-in');
  });

  it('redirects to onboarding when signed in but not onboarded, without throwing an error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.c' } }, error: null });
    mockIsOnboarded.mockResolvedValue(false);
    await expect(getCurrentUserForPage()).rejects.toThrow('NEXT_REDIRECT /onboarding');
    expect(redirect).toHaveBeenCalledWith('/onboarding');
  });

  it('lets other errors through', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockIsOnboarded.mockRejectedValue(new ForbiddenError('nope'));
    await expect(getCurrentUserForPage()).rejects.toBeInstanceOf(ForbiddenError);
    expect(redirect).not.toHaveBeenCalled();
  });
});
