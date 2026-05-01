"use client";

import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/lib/store";
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "@/components/ui";
import { Search, ShoppingCart, X, Eye, Truck } from "lucide-react";
import { formatPrice, formatDate, cn } from "@/lib/utils";
import { Order, OrderItem } from "@/lib/types";
import { buildWardrobeLaminateChart } from "@/lib/wardrobe/laminateChart";
import type { WardrobeConfig } from "@/lib/wardrobe/wardrobeLaminateTypes";
import { OrderAnalyticsCharts } from "@/components/orders/OrderAnalyticsCharts";

function getWardrobeConfigFromItem(item: OrderItem): WardrobeConfig | null {
  const d = item.customData as { kind?: string; config?: WardrobeConfig } | undefined;
  if (d?.kind === "wardrobe" && d.config && typeof d.config === "object") return d.config;
  return null;
}

type RangePreset = "7" | "30" | "90" | "custom";

type PipelineFilter = "all" | "active" | "delivered";

export default function OrdersPage() {
  const { t } = useTranslation();
  const { orders, fetchOrders, updateOrderStatus, currentUser } = useStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>("all");
  const [rangePreset, setRangePreset] = useState<RangePreset>("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [laminateModalItem, setLaminateModalItem] = useState<OrderItem | null>(null);

  const currency = currentUser?.currency ?? orders[0]?.currency ?? "USD";

  const laminateRows = useMemo(() => {
    if (!laminateModalItem) return [];
    const cfg = getWardrobeConfigFromItem(laminateModalItem);
    return cfg ? buildWardrobeLaminateChart(cfg) : [];
  }, [laminateModalItem]);

  const { ordersInAnalyticsRange, analyticsStats } = useMemo(() => {
    let rangeEnd = new Date();
    rangeEnd.setHours(23, 59, 59, 999);
    let rangeStart: Date;
    if (rangePreset === "custom" && customFrom && customTo) {
      rangeStart = new Date(customFrom);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(customTo);
      rangeEnd.setHours(23, 59, 59, 999);
    } else {
      const days = rangePreset === "7" ? 7 : rangePreset === "90" ? 90 : 30;
      rangeStart = new Date();
      rangeStart.setDate(rangeStart.getDate() - (days - 1));
      rangeStart.setHours(0, 0, 0, 0);
    }

    const inRange = orders.filter((o) => {
      const c = new Date(o.createdAt);
      return c >= rangeStart && c <= rangeEnd;
    });

    const deliveredList = inRange.filter((o) => o.status === "delivered");
    const onTheWayList = inRange.filter(
      (o) => o.status !== "delivered" && o.status !== "rejected",
    );

    return {
      ordersInAnalyticsRange: inRange,
      analyticsStats: {
        deliveredCount: deliveredList.length,
        onTheWayCount: onTheWayList.length,
        revenueDelivered: deliveredList.reduce((s, o) => s + o.totalPrice, 0),
        revenuePipeline: onTheWayList.reduce((s, o) => s + o.totalPrice, 0),
        allOrdersCount: orders.length,
      },
    };
  }, [orders, rangePreset, customFrom, customTo]);

  useEffect(() => {
    fetchOrders().catch(() => {});
  }, [fetchOrders]);

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.customerName.toLowerCase().includes(search.toLowerCase()) ||
      order.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
      (order.customerAddress?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesPipeline =
      pipelineFilter === "all" ||
      (pipelineFilter === "delivered" && order.status === "delivered") ||
      (pipelineFilter === "active" &&
        order.status !== "delivered" &&
        order.status !== "rejected");
    return matchesSearch && matchesStatus && matchesPipeline;
  });

  useEffect(() => {
    const interval = setInterval(() => fetchOrders(), 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const statuses = [
    { value: "all", label: t("common.all") },
    { value: "pending", label: t("orders.statusPending") },
    { value: "confirmed", label: t("orders.statusConfirmed") },
    { value: "reviewed", label: t("orders.statusReviewed") },
    { value: "quoted", label: t("orders.statusQuoted") },
    { value: "accepted", label: t("orders.statusAccepted") },
    { value: "rejected", label: t("orders.statusRejected") },
    { value: "delivered", label: t("orders.statusDelivered") },
  ];

  const orderTypes = {
    catalog: t("orders.typeCatalog"),
    builder: t("orders.typeBuilder"),
    custom: t("orders.typeCustom"),
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-[#FEF3E7] text-[#E8772E]";
      case "confirmed":
        return "bg-blue-100 text-blue-700";
      case "reviewed":
        return "bg-[#FEF3E7] text-[#E8772E]";
      case "quoted":
        return "bg-[#FEF3E7] text-[#C9621F]";
      case "accepted":
        return "bg-green-100 text-green-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      case "delivered":
        return "bg-emerald-100 text-emerald-800";
      default:
        return "bg-[#FEF3E7] text-[#6B7280]";
    }
  };

  const getPaymentColor = (status?: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-700";
      case "failed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const handleStatusChange = (orderId: string, newStatus: Order["status"]) => {
    updateOrderStatus(orderId, newStatus).catch(console.error);
    if (selectedOrder?.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    }
  };

  const statusOptions = statuses.slice(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("orders.title")}</h1>
        <p className="text-[var(--muted-foreground)]">{t("orders.description")}</p>
      </div>

      <Card className="overflow-hidden border-[var(--border)]/80 shadow-[0_12px_40px_-24px_rgba(15,23,42,0.15)] ring-1 ring-black/[0.02]">
        <CardHeader className="space-y-4 border-b border-[var(--border)]/40 bg-gradient-to-b from-[var(--muted)]/25 to-transparent pb-5 sm:pb-6">
          <div>
            <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
              {t("orders.analytics.rangeLabel")}
            </CardTitle>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted-foreground)] sm:text-[13px]">
              {t("orders.analytics.rangeIntro")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["7", t("orders.analytics.last7")],
                ["30", t("orders.analytics.last30")],
                ["90", t("orders.analytics.last90")],
                ["custom", t("orders.analytics.custom")],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                variant={rangePreset === key ? "primary" : "outline"}
                size="sm"
                onClick={() => setRangePreset(key)}
              >
                {label}
              </Button>
            ))}
          </div>
          {rangePreset === "custom" && (
            <div className="flex flex-wrap gap-3 items-end pt-3">
              <div>
                <label className="text-xs text-[var(--muted-foreground)] block mb-1">
                  {t("orders.analytics.from")}
                </label>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-[var(--muted-foreground)] block mb-1">
                  {t("orders.analytics.to")}
                </label>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-8 pt-2 sm:pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            <div
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-[var(--border)]/60 bg-white p-5",
                "shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow duration-300 hover:shadow-md",
                "ring-1 ring-black/[0.03]",
              )}
            >
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-400/80 via-emerald-500/40 to-transparent opacity-80" />
              <p className="text-[13px] font-medium text-[var(--muted-foreground)]">
                {t("orders.analytics.statDelivered")}
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
                {analyticsStats.deliveredCount}
              </p>
            </div>
            <div
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-[var(--border)]/60 bg-white p-5",
                "shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow duration-300 hover:shadow-md",
                "ring-1 ring-black/[0.03]",
              )}
            >
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-400/70 via-orange-400/35 to-transparent opacity-90" />
              <p className="text-[13px] font-medium text-[var(--muted-foreground)]">
                {t("orders.analytics.statOnTheWay")}
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
                {analyticsStats.onTheWayCount}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                {t("orders.pipelineActiveHint")}
              </p>
            </div>
            <div
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-[var(--border)]/60 bg-white p-5",
                "shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow duration-300 hover:shadow-md",
                "ring-1 ring-black/[0.03]",
              )}
            >
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-teal-400/75 via-teal-500/35 to-transparent" />
              <p className="text-[13px] font-medium text-[var(--muted-foreground)]">
                {t("orders.analytics.statRevenueDelivered")}
              </p>
              <p className="mt-2 text-[1.375rem] font-semibold tabular-nums tracking-tight text-emerald-700/95">
                {formatPrice(analyticsStats.revenueDelivered, currency)}
              </p>
            </div>
            <div
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-[var(--border)]/60 bg-white p-5",
                "shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow duration-300 hover:shadow-md",
                "ring-1 ring-black/[0.03]",
              )}
            >
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[var(--primary)]/50 via-[var(--primary)]/25 to-transparent" />
              <p className="text-[13px] font-medium text-[var(--muted-foreground)]">
                {t("orders.analytics.statRevenuePipeline")}
              </p>
              <p className="mt-2 text-[1.375rem] font-semibold tabular-nums tracking-tight text-[var(--primary)]">
                {formatPrice(analyticsStats.revenuePipeline, currency)}
              </p>
            </div>
          </div>
          <p className="text-center text-[12px] text-[var(--muted-foreground)] sm:text-left">
            {t("orders.analytics.totalInAccount")}:{" "}
            <span className="font-semibold tabular-nums text-[var(--foreground)]">
              {analyticsStats.allOrdersCount}
            </span>
          </p>
          <div className="border-t border-[var(--border)]/50 pt-8">
            <OrderAnalyticsCharts ordersInRange={ordersInAnalyticsRange} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", t("orders.pipelineAll")],
              ["active", t("orders.pipelineActive")],
              ["delivered", t("orders.pipelineDelivered")],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              variant={pipelineFilter === key ? "primary" : "outline"}
              size="sm"
              onClick={() => setPipelineFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
            <Input
              placeholder={t("common.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-lg border border-[var(--input)] bg-[var(--background)] min-w-[140px]"
          >
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white z-10">
              <CardTitle>{t("orders.details")}</CardTitle>
              <button
                type="button"
                onClick={() => {
                  setLaminateModalItem(null);
                  setSelectedOrder(null);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {t("orders.customerName")}
                  </p>
                  <p className="font-medium">{selectedOrder.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {t("orders.customerEmail")}
                  </p>
                  <p className="font-medium">{selectedOrder.customerEmail}</p>
                </div>
                {selectedOrder.customerPhone && (
                  <div>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {t("orders.customerPhone")}
                    </p>
                    <p className="font-medium">{selectedOrder.customerPhone}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">{t("orders.type")}</p>
                  <p className="font-medium">
                    {orderTypes[selectedOrder.type as keyof typeof orderTypes]}
                  </p>
                </div>
              </div>
              {selectedOrder.customerAddress ? (
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">{t("orders.customerAddress")}</p>
                  <p className="p-2 bg-[var(--muted)] rounded mt-1 whitespace-pre-wrap text-sm">
                    {selectedOrder.customerAddress}
                  </p>
                </div>
              ) : null}

              <div>
                <p className="text-sm text-[var(--muted-foreground)] mb-2">
                  {t("orders.items")}
                </p>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, index) => {
                    const wardrobeConfig = getWardrobeConfigFromItem(item);
                    return (
                      <div
                        key={index}
                        className="flex justify-between items-start gap-2 p-2 bg-[var(--muted)] rounded"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-[var(--muted-foreground)]">
                            x{item.quantity}
                          </p>
                          {wardrobeConfig && (
                            <p className="text-xs text-[var(--muted-foreground)] mt-1">
                              {wardrobeConfig.frame.width}×{wardrobeConfig.frame.height}×
                              {wardrobeConfig.frame.depth} cm · {wardrobeConfig.sections.length}{" "}
                              sections
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <p className="font-medium">
                            {formatPrice(item.price * item.quantity, selectedOrder.currency)}
                          </p>
                          {wardrobeConfig && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setLaminateModalItem(item)}
                            >
                              Sizes
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <p className="font-medium">{t("orders.total")}</p>
                <p className="text-lg font-bold text-[var(--primary)]">
                  {formatPrice(selectedOrder.totalPrice, selectedOrder.currency)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">Payment Status</p>
                  <span className={`inline-block mt-1 px-2.5 py-1 rounded-full text-xs font-medium ${getPaymentColor(selectedOrder.paymentStatus)}`}>
                    {selectedOrder.paymentStatus || "pending"}
                  </span>
                </div>
                {selectedOrder.paypalTransactionId && (
                  <div>
                    <p className="text-sm text-[var(--muted-foreground)]">PayPal TXN</p>
                    <p className="font-mono text-xs mt-1">{selectedOrder.paypalTransactionId}</p>
                  </div>
                )}
              </div>

              {selectedOrder.notes && (
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">{t("orders.notes")}</p>
                  <p className="p-2 bg-[var(--muted)] rounded mt-1">{selectedOrder.notes}</p>
                </div>
              )}

              {selectedOrder.status !== "delivered" && selectedOrder.status !== "rejected" && (
                <Button
                  type="button"
                  className="w-full gap-2"
                  onClick={() => handleStatusChange(selectedOrder.id, "delivered")}
                >
                  <Truck className="w-4 h-4" />
                  {t("orders.markDelivered")}
                </Button>
              )}

              <div>
                <p className="text-sm text-[var(--muted-foreground)] mb-2">
                  {t("orders.updateStatus")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() =>
                        handleStatusChange(selectedOrder.id, s.value as Order["status"])
                      }
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        selectedOrder.status === s.value
                          ? getStatusColor(s.value)
                          : "bg-[var(--muted)] hover:bg-[var(--muted)]/80"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {laminateModalItem && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between shrink-0 border-b">
              <CardTitle>Wardrobe laminate chart</CardTitle>
              <button type="button" onClick={() => setLaminateModalItem(null)} aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 p-0">
              <div className="overflow-x-auto p-4">
                {laminateRows.length === 0 ? (
                  <p className="text-sm text-[var(--muted-foreground)]">No laminate data for this line.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 pr-2 font-medium">Part</th>
                        <th className="py-2 pr-2 font-medium">W × H (cm)</th>
                        <th className="py-2 pr-2 font-medium">T (cm)</th>
                        <th className="py-2 pr-2 font-medium">Qty</th>
                        <th className="py-2 pr-2 font-medium">Category</th>
                        <th className="py-2 font-medium">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {laminateRows.map((row, i) => (
                        <tr key={i} className="border-b border-[var(--border)]/60">
                          <td className="py-2 pr-2 align-top">{row.label}</td>
                          <td className="py-2 pr-2 align-top">
                            {row.widthCm} × {row.heightCm}
                          </td>
                          <td className="py-2 pr-2 align-top">{row.thicknessCm}</td>
                          <td className="py-2 pr-2 align-top">{row.qty}</td>
                          <td className="py-2 pr-2 align-top capitalize">{row.category}</td>
                          <td className="py-2 align-top text-[var(--muted-foreground)] text-xs max-w-[200px]">
                            {row.note ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-[var(--muted-foreground)]" />
            <h3 className="font-medium mb-2">{t("orders.noOrders")}</h3>
            <p className="text-[var(--muted-foreground)]">{t("orders.willAppear")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--muted)]">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium">
                      {t("orders.customer")}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium min-w-[140px]">
                      {t("orders.customerAddress")}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium">
                      {t("orders.type")}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium">
                      {t("orders.items")}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium">
                      {t("orders.total")}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium">
                      {t("orders.status")}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium">
                      Payment
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium">
                      {t("orders.date")}
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-[var(--muted)]/50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{order.customerName}</p>
                        <p className="text-sm text-[var(--muted-foreground)]">
                          {order.customerEmail}
                        </p>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-sm line-clamp-2" title={order.customerAddress ?? ""}>
                          {order.customerAddress ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {orderTypes[order.type as keyof typeof orderTypes]}
                      </td>
                      <td className="px-4 py-3">{order.items.length}</td>
                      <td className="px-4 py-3 font-medium">
                        {formatPrice(order.totalPrice, order.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(order.status)}`}>
                          {statuses.find((s) => s.value === order.status)?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${getPaymentColor(order.paymentStatus)}`}>
                          {order.paymentStatus || "pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
