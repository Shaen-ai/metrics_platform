"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useStore } from "@/lib/store";
import { Card, Button } from "@/components/ui";
import { ArrowLeft, Package, ShoppingCart, X, Plus, Minus } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { CatalogItem, User } from "@/lib/types";
import {
  catalogItemAllCategoryLabels,
  catalogItemMatchesCategoryFilter,
} from "@/lib/catalogItemCategories";

interface CartItem {
  item: CatalogItem;
  quantity: number;
  selectedColor?: { name: string; hex: string };
}

export default function PublicCatalogPage() {
  const params = useParams();
  const adminSlug = params.adminSlug as string;
  
  const { getAdminBySlug, getPublicCatalog } = useStore();
  const [admin, setAdmin] = useState<User | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<{ name: string; hex: string } | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const categories = useMemo(() => {
    const displayAndCount = new Map<string, { label: string; count: number }>();
    for (const item of catalogItems) {
      for (const label of catalogItemAllCategoryLabels(item)) {
        const slug = label.toLowerCase();
        const cur = displayAndCount.get(slug);
        if (!cur) {
          displayAndCount.set(slug, { label, count: 1 });
        } else {
          displayAndCount.set(slug, { label: cur.label, count: cur.count + 1 });
        }
      }
    }
    const rows = [...displayAndCount.entries()]
      .map(([slug, { label, count }]) => ({ slug, label, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [
      { slug: "all" as const, label: "", count: catalogItems.length },
      ...rows,
    ];
  }, [catalogItems]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") return catalogItems;
    return catalogItems.filter((item) =>
      catalogItemMatchesCategoryFilter(item, selectedCategory),
    );
  }, [catalogItems, selectedCategory]);

  useEffect(() => {
    let cancelled = false;
    getAdminBySlug(adminSlug).then(async (u) => {
      if (cancelled) return;
      if (u) {
        setAdmin(u);
        const items = await getPublicCatalog(u.id);
        if (!cancelled) setCatalogItems(items);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [adminSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Store not found</p>
      </div>
    );
  }

  const selectedItemData = catalogItems.find((item) => item.id === selectedItem);

  const addToCart = (item: typeof catalogItems[0], color?: { name: string; hex: string }) => {
    setCart((prev) => {
      // If item has colors, check for exact match (same item + same color)
      // If item has no colors, check for same item only
      const colorKey = color ? color.hex : null;
      const existing = prev.find((ci) => {
        if (ci.item.id !== item.id) return false;
        const ciColorKey = ci.selectedColor ? ci.selectedColor.hex : null;
        return ciColorKey === colorKey;
      });
      
      if (existing) {
        return prev.map((ci) => {
          const ciColorKey = ci.selectedColor ? ci.selectedColor.hex : null;
          if (ci.item.id === item.id && ciColorKey === colorKey) {
            return { ...ci, quantity: ci.quantity + 1 };
          }
          return ci;
        });
      }
      return [...prev, { item, quantity: 1, selectedColor: color || undefined }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((ci) =>
          ci.item.id === itemId
            ? { ...ci, quantity: Math.max(0, ci.quantity + delta) }
            : ci
        )
        .filter((ci) => ci.quantity > 0)
    );
  };

  const cartTotal = cart.reduce((sum, ci) => sum + ci.item.price * ci.quantity, 0);
  const cartCount = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  return (
    <div className="min-h-screen bg-[var(--muted)]">
      {/* Header */}
      <header className="bg-[var(--background)] border-b border-[var(--border)] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/${adminSlug}`}
                className="flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Link>
              <h1 className="text-xl font-bold">{admin.companyName} - Catalog</h1>
            </div>
            <Button variant="outline" onClick={() => setShowCart(true)} className="relative">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Cart
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-[var(--primary)] text-white text-xs rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Category Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.slug
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--background)] hover:bg-[var(--secondary)]"
              }`}
            >
              {cat.slug === "all" ? "All Items" : cat.label}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        {filteredItems.length === 0 ? (
          <Card className="p-12 text-center">
            <Package className="w-12 h-12 mx-auto text-[var(--muted-foreground)] mb-4" />
            <h3 className="text-lg font-semibold mb-2">No items available</h3>
            <p className="text-[var(--muted-foreground)]">
              Check back later for new products.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map((item) => (
              <Card
                key={item.id}
                className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedItem(item.id)}
              >
                <div className="relative h-48 bg-[var(--muted)]">
                  {item.images[0] ? (
                    <Image
                      src={item.images[0]}
                      alt={item.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-12 h-12 text-[var(--muted-foreground)]" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold line-clamp-1">{item.name}</h3>
                  <p className="text-sm text-[var(--muted-foreground)] line-clamp-2 mt-1">
                    {item.description}
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-lg font-bold text-[var(--primary)]">
                      {formatPrice(item.price, item.currency)}
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {item.deliveryDays} days
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Item Detail Modal */}
      {selectedItemData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="relative">
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setSelectedColor(null);
                }}
                className="absolute top-4 right-4 z-10 w-8 h-8 bg-[var(--background)] rounded-full flex items-center justify-center shadow"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="relative h-64 bg-[var(--muted)]">
                {selectedItemData.images[0] ? (
                  <Image
                    src={selectedItemData.images[0]}
                    alt={selectedItemData.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-16 h-16 text-[var(--muted-foreground)]" />
                  </div>
                )}
              </div>
            </div>
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-2">{selectedItemData.name}</h2>
              <p className="text-[var(--muted-foreground)] mb-4">
                {selectedItemData.description}
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-[var(--muted)] rounded-lg">
                  <p className="text-sm text-[var(--muted-foreground)]">Dimensions</p>
                  <p className="font-medium">
                    {selectedItemData.sizes.width} × {selectedItemData.sizes.height} × {selectedItemData.sizes.depth} {selectedItemData.sizes.unit}
                  </p>
                </div>
                <div className="p-3 bg-[var(--muted)] rounded-lg">
                  <p className="text-sm text-[var(--muted-foreground)]">Delivery</p>
                  <p className="font-medium">{selectedItemData.deliveryDays} days</p>
                </div>
              </div>

              {selectedItemData.availableColors && selectedItemData.availableColors.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm font-medium mb-3">Select Color</p>
                  <div className="flex flex-wrap gap-3">
                    {selectedItemData.availableColors.map((color, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedColor(color)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                          selectedColor?.hex === color.hex
                            ? "border-[var(--primary)] bg-[var(--primary)]/10"
                            : "border-[var(--input)] hover:border-[var(--primary)]/50"
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-full border border-[var(--border)]"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="text-sm font-medium">{color.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                <span className="text-2xl font-bold text-[var(--primary)]">
                  {formatPrice(selectedItemData.price, selectedItemData.currency)}
                </span>
                <Button onClick={() => {
                  addToCart(selectedItemData, selectedColor || undefined);
                  setSelectedItem(null);
                  setSelectedColor(null);
                }}>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Add to Cart
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowCart(false)}>
          <div
            className="absolute right-0 top-0 h-full w-full max-w-md bg-[var(--background)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                <h2 className="text-xl font-bold">Your Cart</h2>
                <button onClick={() => setShowCart(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-12 h-12 mx-auto text-[var(--muted-foreground)] mb-4" />
                    <p className="text-[var(--muted-foreground)]">Your cart is empty</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((ci) => (
                      <div
                        key={ci.item.id}
                        className="flex gap-4 p-3 bg-[var(--muted)] rounded-lg"
                      >
                        <div className="w-16 h-16 rounded bg-[var(--background)] relative flex-shrink-0">
                          {ci.item.images[0] ? (
                            <Image
                              src={ci.item.images[0]}
                              alt={ci.item.name}
                              fill
                              className="object-cover rounded"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-6 h-6 text-[var(--muted-foreground)]" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{ci.item.name}</h4>
                          {ci.selectedColor && (
                            <div className="flex items-center gap-2 mt-1">
                              <div
                                className="w-4 h-4 rounded-full border border-[var(--border)]"
                                style={{ backgroundColor: ci.selectedColor.hex }}
                              />
                              <span className="text-xs text-[var(--muted-foreground)]">
                                {ci.selectedColor.name}
                              </span>
                            </div>
                          )}
                          <p className="text-sm text-[var(--primary)] font-medium">
                            {formatPrice(ci.item.price)}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => updateQuantity(ci.item.id, -1)}
                              className="w-6 h-6 rounded bg-[var(--background)] flex items-center justify-center"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center">{ci.quantity}</span>
                            <button
                              onClick={() => updateQuantity(ci.item.id, 1)}
                              className="w-6 h-6 rounded bg-[var(--background)] flex items-center justify-center"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">
                            {formatPrice(ci.item.price * ci.quantity)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-4 border-t border-[var(--border)]">
                  <div className="flex justify-between mb-4">
                    <span className="font-medium">Total</span>
                    <span className="text-xl font-bold">{formatPrice(cartTotal)}</span>
                  </div>
                  <Link href={`/${adminSlug}/checkout?items=${encodeURIComponent(JSON.stringify(cart))}`}>
                    <Button className="w-full">
                      Proceed to Quote Request
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
