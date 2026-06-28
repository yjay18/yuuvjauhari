// Shared URL helpers. BASE_URL is injected by Astro/Vite at build time and
// is required for correct paths when the site is served under a sub-path
// (e.g. GitHub Pages project sites).

const BASE = import.meta.env.BASE_URL;

export const isExternal = (url: string): boolean => /^(https?:)?\/\/|^mailto:|^tel:/.test(url);

/** Prefix an internal path with the site base. External URLs pass through. */
export const withBase = (path: string): string => {
  if (isExternal(path) || path.startsWith("#")) return path;
  return `${BASE}${path.replace(/^\//, "")}`;
};

/** Resolve a link that may be external (http…) or an internal asset path. */
export const resolveUrl = (url: string): string => (isExternal(url) ? url : withBase(url));

export const projectHref = (slug: string): string => withBase(`projects/${slug}/`);
