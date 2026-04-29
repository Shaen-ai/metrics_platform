const DEFAULT_ROOT = "tunzone.com";

/** Root domain for customer storefront hostnames (`{slug}.{root}`). Override in env for staging. */
export function getStorefrontRootDomain(): string {
  return (process.env.NEXT_PUBLIC_STOREFRONT_ROOT_DOMAIN || DEFAULT_ROOT)
    .trim()
    .replace(/^\.+/, "")
    .replace(/\/+$/, "");
}

export function buildPublishedStorefrontUrl(slug: string): string {
  const root = getStorefrontRootDomain();
  return `https://${slug}.${root}`;
}
