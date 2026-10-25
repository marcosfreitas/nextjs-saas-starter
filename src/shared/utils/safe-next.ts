/**
 * Same-origin path for a post-auth redirect, or the fallback.
 *
 * Rejects protocol-relative (`//evil`) and backslash tricks (`/\evil`), which
 * browsers read as another host. Anything that is not a path on this origin
 * becomes the fallback.
 */
export function safeNext(value: string | null, fallback = '/dashboard'): string {
  if (!value) return fallback;
  const isLocalPath = value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\');
  return isLocalPath ? value : fallback;
}
