"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useStore } from "@/lib/store";
import { Card, Button } from "@/components/ui";
import { ArrowLeft, Boxes, Plus, Trash2, ShoppingCart } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { Module, User } from "@/lib/types";

interface BuilderModule {
  module: Module;
  x: number;
  y: number;
}

export default function ModuleBuilderPage() {
  const params = useParams();
  const adminSlug = params.adminSlug as string;
  
  const { getAdminBySlug, getPublicModules } = useStore();
  const [admin, setAdmin] = useState<User | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [placedModules, setPlacedModules] = useState<BuilderModule[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminBySlug(adminSlug).then(async (u) => {
      if (cancelled) return;
      if (u) {
        setAdmin(u);
        const mods = await getPublicModules(u.id);
        if (!cancelled) setModules(mods);
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
  
  const addModule = (module: typeof modules[0]) => {
    setPlacedModules((prev) => [
      ...prev,
      { module, x: prev.length * 70, y: 50 },
    ]);
  };

  const removeModule = (index: number) => {
    setPlacedModules((prev) => prev.filter((_, i) => i !== index));
  };

  const totalPrice = placedModules.reduce((sum, pm) => sum + pm.module.price, 0);

  const categories = [...new Set(modules.map((m) => m.category))];

  return (
    <div className="min-h-screen bg-[var(--muted)] flex flex-col">
      {/* Header */}
      <header className="bg-[var(--background)] border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/${adminSlug}`}
                className="flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Link>
              <h1 className="text-xl font-bold">{admin.companyName} - Module Builder</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-lg font-bold">
                Total: {formatPrice(totalPrice)}
              </span>
              <Button disabled={placedModules.length === 0}>
                <ShoppingCart className="w-4 h-4 mr-2" />
                Request Quote
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Module Library */}
        <aside className="w-80 bg-[var(--background)] border-r border-[var(--border)] overflow-y-auto">
          <div className="p-4">
            <h2 className="font-semibold mb-4">Available Modules</h2>
            
            {categories.map((category) => (
              <div key={category} className="mb-6">
                <h3 className="text-sm font-medium text-[var(--muted-foreground)] uppercase mb-2">
                  {category}
                </h3>
                <div className="space-y-2">
                  {modules
                    .filter((m) => m.category === category)
                    .map((module) => (
                      <div
                        key={module.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedModuleId === module.id
                            ? "border-[var(--primary)] bg-[var(--primary)]/5"
                            : "border-[var(--border)] hover:border-[var(--primary)]/50"
                        }`}
                        onClick={() => setSelectedModuleId(module.id)}
                      >
                        <div className="flex gap-3">
                          <div className="w-12 h-12 rounded bg-[var(--muted)] relative flex-shrink-0">
                            {module.images[0] ? (
                              <Image
                                src={module.images[0]}
                                alt={module.name}
                                fill
                                className="object-cover rounded"
                                unoptimized
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Boxes className="w-5 h-5 text-[var(--muted-foreground)]" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{module.name}</h4>
                            <p className="text-xs text-[var(--muted-foreground)]">
                              {module.sizes.width}×{module.sizes.height}×{module.sizes.depth} {module.sizes.unit}
                            </p>
                            <p className="text-sm font-medium text-[var(--primary)]">
                              {formatPrice(module.price)}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            addModule(module);
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add to Build
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            ))}

            {modules.length === 0 && (
              <div className="text-center py-8">
                <Boxes className="w-12 h-12 mx-auto text-[var(--muted-foreground)] mb-2" />
                <p className="text-[var(--muted-foreground)]">No modules available</p>
              </div>
            )}
          </div>
        </aside>

        {/* Build Area */}
        <main className="flex-1 p-6">
          <Card className="h-full">
            <div className="p-4 border-b border-[var(--border)]">
              <h2 className="font-semibold">Your Build</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                {placedModules.length} modules added
              </p>
            </div>

            {placedModules.length === 0 ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <Boxes className="w-16 h-16 mx-auto text-[var(--muted-foreground)] mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Start Building</h3>
                  <p className="text-[var(--muted-foreground)] max-w-sm">
                    Select modules from the left panel and add them to your build.
                    Combine different pieces to create your perfect furniture.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4">
                {/* Visual Build Area */}
                <div className="relative bg-[var(--muted)] rounded-lg h-64 mb-4 overflow-hidden">
                  <div className="absolute inset-0 flex items-end justify-center gap-1 p-4">
                    {placedModules.map((pm, index) => (
                      <div
                        key={index}
                        className="relative bg-[var(--primary)]/20 border-2 border-[var(--primary)] rounded flex items-center justify-center"
                        style={{
                          width: `${Math.min(pm.module.sizes.width, 100)}px`,
                          height: `${Math.min(pm.module.sizes.height, 150)}px`,
                        }}
                      >
                        <span className="text-xs font-medium text-center px-1">
                          {pm.module.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Module List */}
                <div className="space-y-2">
                  {placedModules.map((pm, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-[var(--muted)] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-[var(--background)] relative">
                          {pm.module.images[0] ? (
                            <Image
                              src={pm.module.images[0]}
                              alt={pm.module.name}
                              fill
                              className="object-cover rounded"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Boxes className="w-4 h-4 text-[var(--muted-foreground)]" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{pm.module.name}</p>
                          <p className="text-sm text-[var(--muted-foreground)]">
                            {pm.module.sizes.width}×{pm.module.sizes.height}×{pm.module.sizes.depth} {pm.module.sizes.unit}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-medium">{formatPrice(pm.module.price)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeModule(index)}
                          className="text-[var(--destructive)]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border)]">
                  <span className="text-lg font-medium">Total</span>
                  <span className="text-2xl font-bold text-[var(--primary)]">
                    {formatPrice(totalPrice)}
                  </span>
                </div>
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}
