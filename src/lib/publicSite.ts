export const DEFAULT_PUBLIC_SITE_LAYOUT = "tunzone-classic-light";

export const publicSiteLayouts = [
  {
    id: "tunzone-classic-light",
    name: "Editorial Cream",
    description: "Warm editorial layout with serif headings and terracotta accents.",
    swatches: ["#F5F1EB", "#c8622a", "#1a1614"],
  },
  {
    id: "architect-black-white",
    name: "Brutalist Mono",
    description: "High-contrast black and white with sharp edges and bold type.",
    swatches: ["#ffffff", "#000000", "#555555"],
  },
  {
    id: "soft-pink-red",
    name: "Soft Botanica",
    description: "Organic warmth with blush tones and generous rounded shapes.",
    swatches: ["#faf7f5", "#c45c6a", "#2d2926"],
  },
  {
    id: "luxury-dark-gold",
    name: "Dark Showroom",
    description: "Gallery-dark backdrop with refined gold accents.",
    swatches: ["#0a0908", "#c9a54e", "#f0e8d8"],
  },
  {
    id: "minimal-white-oak",
    name: "Scandinavian Light",
    description: "Cool minimal Nordic aesthetic with muted blue-grey tones.",
    swatches: ["#f8f9fa", "#5b7a8a", "#2c3e50"],
  },
  {
    id: "industrial-graphite",
    name: "Neo Industrial",
    description: "Dark graphite with sharp geometry and bold amber highlights.",
    swatches: ["#1a1d23", "#e87a2e", "#e4e4e7"],
  },
  {
    id: "warm-beige-studio",
    name: "Warm Terracotta",
    description: "Earthy clay palette with bold serif headings and natural warmth.",
    swatches: ["#f4ece3", "#b85c3a", "#3d2e22"],
  },
  {
    id: "blue-modern-tech",
    name: "Blue Modern",
    description: "Clean professional blue with crisp lines and modern geometry.",
    swatches: ["#f8fafc", "#2563eb", "#0f172a"],
  },
  {
    id: "green-natural-home",
    name: "Natural Oak",
    description: "Japandi-inspired with warm wood tones and understated green.",
    swatches: ["#faf8f5", "#5c7a5c", "#2c2418"],
  },
  {
    id: "premium-showroom",
    name: "Premium Slate",
    description: "Dark navy gallery with champagne gold accents and serif typography.",
    swatches: ["#0c1220", "#c4a265", "#e8e4dc"],
  },
] as const;

export const publicSiteTextFields = [
  { key: "heroTitle", label: "Hero title" },
  { key: "heroSubtitle", label: "Hero subtitle" },
  { key: "primaryCta", label: "Primary CTA" },
  { key: "secondaryCta", label: "Secondary CTA" },
  { key: "catalogTitle", label: "Catalog title" },
  { key: "catalogSubtitle", label: "Catalog subtitle" },
  { key: "plannersTitle", label: "Planners title" },
  { key: "plannersSubtitle", label: "Planners subtitle" },
  { key: "materialsTitle", label: "Materials title" },
  { key: "materialsSubtitle", label: "Materials subtitle" },
] as const;

export const DEFAULT_PUBLIC_CATALOG_LAYOUT = "grid";

export const publicCatalogLayouts = [
  { id: "grid", name: "Grid" },
  { id: "list", name: "List" },
  { id: "masonry", name: "Masonry" },
  { id: "magazine", name: "Magazine" },
  { id: "reels", name: "Reels" },
  { id: "gallery", name: "Gallery" },
] as const;

export type PublicCatalogLayoutId = (typeof publicCatalogLayouts)[number]["id"];
