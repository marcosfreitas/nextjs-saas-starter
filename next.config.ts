import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/shared/i18n/request.ts');

const nextConfig: NextConfig = {
  reactCompiler: true,

  /**
   * Both of these are already the framework default. They are written down
   * anyway because the default is the safe value and a generated project is
   * where someone flips it to ship a logo.
   *
   * `dangerouslyAllowSVG` makes the optimizer serve SVG through
   * `/_next/image`. SVG is a script-bearing document, not a bitmap, so a file
   * fetched from somewhere else and served from our origin runs under our
   * origin: session cookies, local storage, the lot. Next 16.4.1 patched an
   * unauthenticated RCE in that same path (see the 16.4.2 bump); the flag being
   * false is what kept this template out of reach of it. Turning it on needs a
   * `contentDispositionType: 'attachment'` and a CSP of its own, so it is a
   * decision with homework, not a one-line config.
   *
   * `remotePatterns: []` means the optimizer refuses every external host. The
   * route exists in any Next app, whether or not the app renders an `<Image>`,
   * and `src/proxy.ts` excludes `_next/image` from its matcher, so no
   * middleware runs in front of it. An empty list is the only thing standing
   * between that route and being an open image proxy for the whole internet,
   * billed to whoever deployed it. Add the hosts you actually serve, one
   * pattern each, never a wildcard hostname.
   */
  images: {
    dangerouslyAllowSVG: false,
    remotePatterns: [],
  },
};

export default withNextIntl(nextConfig);
