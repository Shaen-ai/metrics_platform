"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useStore } from "@/lib/store";
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, Button, Input, ConfirmDialog } from "@/components/ui";
import { Plus, Search, Edit, Trash2, Package, Box, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { api } from "@/lib/api";
import ModelViewerCard from "@/components/ModelViewerCard";

export default function CatalogPage() {
  const { t } = useTranslation();
  const { catalogItems, fetchCatalogItems, deleteCatalogItem, currentUser } = useStore();
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { fetchCatalogItems().catch(() => {}); }, []);

  const hasPending3d = catalogItems.some(
    (i) => i.modelStatus === "queued" || i.modelStatus === "processing"
  );
  useEffect(() => {
    if (!hasPending3d) return;
    const token = api.getToken();
    if (!token) return;

    const pollMeshyAndRefresh = async () => {
      const items = useStore.getState().catalogItems;
      const pending = items.filter(
        (i) =>
          (i.modelStatus === "queued" || i.modelStatus === "processing") &&
          i.modelJobId
      );
      for (const item of pending) {
        try {
          await fetch(
            `/api/meshy/status/${encodeURIComponent(item.modelJobId!)}?entityId=${encodeURIComponent(item.id)}&entityType=catalog`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch {
          /* network blip — next tick retries */
        }
      }
      await fetchCatalogItems();
    };

    pollMeshyAndRefresh();
    const id = setInterval(pollMeshyAndRefresh, 5000);
    return () => clearInterval(id);
  }, [hasPending3d, fetchCatalogItems]);

  const filteredItems = catalogItems.filter(
    (item) => {
      const q = search.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.model && item.model.toLowerCase().includes(q))
      );
    }
  );

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteCatalogItem(deleteId).catch(console.error);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("catalog.title")}</h1>
          <p className="text-[var(--muted-foreground)]">{t("catalog.description")}</p>
        </div>
        <Button asChild>
          <Link href="/admin/catalog/new">
            <Plus className="w-4 h-4 mr-2" />
            {t("catalog.addItem")}
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
        <Input
          placeholder={t("catalog.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Items Grid */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-[var(--muted-foreground)]" />
            <h3 className="font-medium mb-2">{t("catalog.noItems")}</h3>
            <p className="text-[var(--muted-foreground)] mb-4">{t("catalog.addFirst")}</p>
            <Button asChild>
              <Link href="/admin/catalog/new">
                <Plus className="w-4 h-4 mr-2" />
                {t("catalog.addItem")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className="relative h-48 min-h-[12rem] bg-[var(--muted)] overflow-hidden">
                {item.modelUrl && item.modelStatus === "done" ? (
                  <ModelViewerCard
                    src={item.modelUrl}
                    alt={item.name}
                    fallbackImage={item.images[0]}
                  />
                ) : item.images[0] ? (
                  <Image
                    src={item.images[0]}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                ) : item.modelStatus === "queued" || item.modelStatus === "processing" ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                    <span className="text-xs font-medium text-blue-600">Generating 3D...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Package className="w-12 h-12 text-[var(--muted-foreground)]" />
                  </div>
                )}
                {item.modelUrl && item.modelStatus === "done" && (
                  <div className="absolute top-2 left-2 px-2 py-1 bg-emerald-500 text-white text-xs rounded flex items-center gap-1 pointer-events-none">
                    <Box className="w-3 h-3" />
                    3D
                  </div>
                )}
                {!item.isActive && (
                  <div className="absolute top-2 right-2 px-2 py-1 bg-red-500 text-white text-xs rounded">
                    {t("common.inactive")}
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium">{item.name}</h3>
                    {item.model && (
                      <p className="text-xs text-[var(--muted-foreground)]">{t("catalog.model")}: {item.model}</p>
                    )}
                    <p className="text-sm text-[var(--muted-foreground)]">{item.category}</p>
                  </div>
                  <p className="font-bold text-[var(--primary)]">
                    {formatPrice(item.price, item.currency)}
                  </p>
                </div>
                <p className="text-sm text-[var(--muted-foreground)] mb-3 line-clamp-2">
                  {item.description}
                </p>
                {item.sizes && (
                  <div className="text-xs text-[var(--muted-foreground)] mb-3">
                    {item.sizes.width} × {item.sizes.height} × {item.sizes.depth} {item.sizes.unit}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/admin/catalog/${item.id}`}>
                      <Edit className="w-4 h-4 mr-1" />
                      {t("common.edit")}
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    className="text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        title={t("common.confirmDeleteTitle")}
        message={t("common.confirmDeleteMessage")}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        variant="danger"
      />
    </div>
  );
}
