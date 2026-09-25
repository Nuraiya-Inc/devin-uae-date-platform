/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // pdfkit must run from real node_modules, NOT be bundled by webpack:
  // its compiled code reads built-in font metrics via
  // readFileSync(__dirname + '/data/Helvetica.afm'). When bundled,
  // __dirname points at .next/server/chunks/ where no data/ directory
  // exists, so the first certificate/PDF request throws ENOENT and the
  // download fails with an empty file. Externalizing keeps __dirname
  // inside node_modules/pdfkit and lets output tracing copy the package
  // (including js/data/*.afm) into the standalone build.
  serverExternalPackages: ['pdfkit'],
  outputFileTracingIncludes: {
    '/api/certificates/[partnerId]': ['./node_modules/pdfkit/js/data/**'],
  },
  experimental: {
    serverActions: {
      // 80 MB — matches the chat-route MAX_TOTAL_ATTACHMENT_BYTES (8 files
      // × 50 MB) and lib/storage.ts single-file cap. Sharp downscales images
      // before sending to Anthropic, so this is the upload boundary only.
      bodySizeLimit: '80mb',
      // Browser-preview / reverse proxies rewrite Host but keep the browser's
      // Origin, which trips the server-action CSRF origin check. Dev-only
      // allowances; extra origins can be added via ALLOWED_ACTION_ORIGINS
      // (comma-separated host[:port] entries).
      allowedOrigins: [
        '127.0.0.1:64358',
        ...(process.env.ALLOWED_ACTION_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? []),
      ],
    },
    // NOTE: dropped `middlewareClientMaxBodySize` experimental option — it
    // increases build memory pressure on small VPSes and caused OOM kills.
    // Instead we exclude /api/chat/upload-attachment from the middleware
    // matcher (see src/middleware.ts) so the streaming endpoint isn't
    // subject to the default 10 MB middleware body cap at all.
  },
  async rewrites() {
    return [
      // Public investor data room: /investor-data-room → static HTML in public/.
      // The trailing-slash variant is also accepted (Next.js's default
      // trailingSlash behavior would 308-redirect /investor-data-room/ →
      // /investor-data-room before reaching this rewrite, so the bare path
      // is the canonical one).
      {
        source: '/investor-data-room',
        destination: '/investor-data-room/index.html',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // microphone=(self) → required for voice-to-chat (Whisper) and any
          // future in-browser voice/audio features. (self) allows our own
          // origin only — no third-party iframe can request the mic.
          // camera=(self)     → for future webcam / QR-scan features.
          // geolocation=()    → still blocked; not used anywhere yet.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
          // Stricter than Bas's: chemicals IP — we don't want this embeddable anywhere
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
      /**
       * Static assets (chunks, CSS, fonts) get content hashes in their
       * filename, so they're safe to cache forever. This means once a
       * specific hash is fetched, browsers/CDNs never re-request it.
       */
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      /**
       * Public investor data room — confidential, no caching, no indexing.
       * The chatbot on safabioworks.com gates access upstream with a code,
       * but once an investor lands here, we still want belt-and-braces:
       *   - X-Robots-Tag: noindex, nofollow → keeps it out of search engines
       *   - Cache-Control: private, no-store → no intermediary caching,
       *     forces a fresh fetch (matters when we later swap "#" placeholder
       *     hrefs for short-lived signed download URLs)
       */
      {
        source: '/investor-data-room',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
      {
        source: '/investor-data-room/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
