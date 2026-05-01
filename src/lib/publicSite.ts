export const DEFAULT_PUBLIC_SITE_LAYOUT = "tunzone-classic-light";

export const publicSiteLayouts = [
  {
    id: "tunzone-classic-light",
    name: "Tunzone Classic Light",
    description: "Clean white showroom with warm orange accents.",
    swatches: ["#ffffff", "#E8772E", "#1A1A1A"],
  },
  {
    id: "architect-black-white",
    name: "Architect Black & White",
    description: "Monochrome editorial layout for premium studios.",
    swatches: ["#0F0F10", "#FFFFFF", "#A3A3A3"],
  },
  {
    id: "soft-pink-red",
    name: "Soft Pink & Red",
    description: "Warm lifestyle storefront with rose and red tones.",
    swatches: ["#FFF1F2", "#E11D48", "#7F1D1D"],
  },
  {
    id: "luxury-dark-gold",
    name: "Luxury Dark Gold",
    description: "Dark gallery with gold details for high-end offers.",
    swatches: ["#11100E", "#D6A84F", "#F8F0DF"],
  },
  {
    id: "minimal-white-oak",
    name: "Minimal White Oak",
    description: "Soft neutral design for calm modern interiors.",
    swatches: ["#FAF7F0", "#B88A57", "#2F2A24"],
  },
  {
    id: "industrial-graphite",
    name: "Industrial Graphite",
    description: "Graphite surfaces with strong orange conversion points.",
    swatches: ["#1F2937", "#F97316", "#E5E7EB"],
  },
  {
    id: "warm-beige-studio",
    name: "Warm Beige Studio",
    description: "Friendly beige palette for family furniture brands.",
    swatches: ["#F5E9DA", "#C47A3A", "#443126"],
  },
  {
    id: "blue-modern-tech",
    name: "Blue Modern Tech",
    description: "Crisp blue interface for technology-forward sellers.",
    swatches: ["#EFF6FF", "#2563EB", "#172554"],
  },
  {
    id: "green-natural-home",
    name: "Green Natural Home",
    description: "Organic green theme for natural material catalogs.",
    swatches: ["#F0FDF4", "#16A34A", "#14532D"],
  },
  {
    id: "premium-showroom",
    name: "Premium Showroom",
    description: "Polished magazine-style layout for large catalogs.",
    swatches: ["#F8FAFC", "#7C3AED", "#111827"],
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
