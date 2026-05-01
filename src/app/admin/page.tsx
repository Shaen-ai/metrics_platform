"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { Package, ShoppingCart, DollarSign, Clock } from "lucide-react";
import { formatPrice, formatDate } from "@/lib/utils";
import Link from "next/link";

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { currentUser, catalogItems, orders, fetchCatalogItems, fetchOrders } = useStore();

  useEffect(() => { fetchCatalogItems().catch(() => {}); fetchOrders().catch(() => {}); }, []);

  if (!currentUser) return null;
  const pendingOrders = orders.filter((o) => o.status === "pending");
  const acceptedOrders = orders.filter((o) => o.status === "accepted");
  const totalRevenue = acceptedOrders.reduce((sum, o) => sum + o.totalPrice, 0);

  const stats = [
    {
      title: t("dashboard.catalogItems"),
      value: catalogItems.length,
      description: t("dashboard.itemsInCatalog"),
      icon: Package,
      color: "text-[#E8772E]",
      bgColor: "bg-[#FEF3E7]",
    },
    {
      title: t("dashboard.pendingOrders"),
      value: pendingOrders.length,
      description: t("dashboard.ordersAwaiting"),
      icon: Clock,
      color: "text-[#E8772E]",
      bgColor: "bg-[#FEF3E7]",
    },
    {
      title: t("dashboard.totalRevenue"),
      value: formatPrice(totalRevenue, currentUser.currency),
      description: t("dashboard.fromAccepted"),
      icon: DollarSign,
      color: "text-[#E8772E]",
      bgColor: "bg-[#FEF3E7]",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        <p className="text-[var(--muted-foreground)]">
          {t("auth.welcomeBack")}, {currentUser.name}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="rounded-2xl border-[#F0E6D8]">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    {stat.description}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("dashboard.recentOrders")}</CardTitle>
          {orders.length > 0 && (
            <Link
              href="/admin/orders"
              className="text-sm text-[var(--primary)] hover:underline"
            >
              {t("dashboard.viewAllOrders")}
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t("dashboard.noOrdersYet")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 bg-[var(--muted)] rounded-lg"
                >
                  <div>
                    <p className="font-medium">{order.customerName}</p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {order.items.length} {t("orders.items")} • {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatPrice(order.totalPrice, order.currency)}
                    </p>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        order.status === "pending"
                          ? "bg-[#FEF3E7] text-[#E8772E]"
                          : order.status === "accepted"
                          ? "bg-green-100 text-green-700"
                          : order.status === "rejected"
                          ? "bg-red-100 text-red-700"
                          : order.status === "delivered"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-[#FEF3E7] text-[#E8772E]"
                      }`}
                    >
                      {t(`orders.status${order.status.charAt(0).toUpperCase() + order.status.slice(1)}`)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {pendingOrders.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t("dashboard.pendingOrders")}</p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {pendingOrders.length} {t("dashboard.ordersAwaiting")}
                </p>
              </div>
              <Link
                href="/admin/orders?status=pending"
                className="px-4 py-2 bg-[#E8772E] text-white rounded-full hover:opacity-90 transition-opacity"
              >
                {t("dashboard.viewPending")}
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
