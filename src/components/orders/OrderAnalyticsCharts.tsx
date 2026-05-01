"use client";

import { useId, useMemo, type ReactNode } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { BarChart3, PieChart as PieChartIcon, type LucideIcon } from "lucide-react";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Aligned with src/app/globals.css (:root). SVG fills cannot rely on CSS variables in all clients.
 * Primary #E8772E, cream #FEF3E7, emerald for delivered (same family as orders KPI / status chips).
 */
const SITE = {
  primary: "#E8772E",
  primaryMid: "#F4A261",
  primaryWash: "#FCDCC4",
  delivered: "#059669",
} as const;

const THEME = {
  barHigh: SITE.primaryWash,
  barLow: SITE.primary,
  grid: "rgba(107, 114, 128, 0.11)",
  tick: "rgba(107, 114, 128, 0.78)",
  barStroke: "rgba(232, 119, 46, 0.22)",
  cursor: "rgba(232, 119, 46, 0.07)",
  delivered: SITE.delivered,
  pipeline: SITE.primary,
} as const;

type BarRow = { day: string; orders: number };

function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayTick(key: string): string {
  const [y, mo, d] = key.split("-").map(Number);
  if (!y || !mo || !d) return key;
  return new Date(y, mo - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDayTitle(key: string): string {
  const [y, mo, d] = key.split("-").map(Number);
  if (!y || !mo || !d) return key;
  return new Date(y, mo - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ChartShell({
  icon: Icon,
  title,
  subtitle,
  children,
  footer,
  className,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)]/75 bg-white",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-10px_rgba(15,23,42,0.12)]",
        "ring-1 ring-black/[0.025]",
        className,
      )}
    >
      <div className="border-b border-[var(--border)]/45 bg-gradient-to-br from-[var(--muted)]/35 via-white to-white px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/90",
              "shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-black/[0.04]",
            )}
          >
            <Icon className="h-[18px] w-[18px] text-[var(--primary)] opacity-[0.92]" strokeWidth={2} />
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="text-sm font-semibold leading-snug tracking-tight text-[var(--foreground)] sm:text-[0.9375rem]">
              {title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)] sm:text-[13px]">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
      <div className="relative flex min-h-[260px] flex-1 flex-col px-2 pb-3 pt-3 sm:min-h-[280px] sm:px-3 sm:pb-4 sm:pt-4">
        {children}
        {footer}
      </div>
    </div>
  );
}

type Props = {
  ordersInRange: Order[];
};

export function OrderAnalyticsCharts({ ordersInRange }: Props) {
  const { t } = useTranslation();
  const gradId = useId().replace(/\W/g, "");

  const barData = useMemo(() => {
    const map = new Map<string, BarRow>();
    for (const o of ordersInRange) {
      const key = dayKey(o.createdAt);
      const cur = map.get(key) ?? { day: key, orders: 0 };
      cur.orders += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [ordersInRange]);

  const pieRows = useMemo(() => {
    const delivered = ordersInRange.filter((o) => o.status === "delivered").length;
    const active = ordersInRange.filter(
      (o) => o.status !== "delivered" && o.status !== "rejected",
    ).length;
    return [
      {
        name: t("orders.analytics.legendDelivered"),
        value: delivered,
        fill: THEME.delivered,
      },
      {
        name: t("orders.analytics.legendOnTheWay"),
        value: active,
        fill: THEME.pipeline,
      },
    ].filter((row) => row.value > 0);
  }, [ordersInRange, t]);

  const pieTotal = useMemo(() => pieRows.reduce((s, r) => s + r.value, 0), [pieRows]);

  const ordersLabelShort = t("orders.analytics.tooltipOrders").toLowerCase();
  const countLabelShort = t("orders.analytics.tooltipCount").toLowerCase();

  if (ordersInRange.length === 0) {
    return (
      <ChartShell
        icon={BarChart3}
        title={t("orders.analytics.chartOrdersPerDay")}
        subtitle={t("orders.analytics.chartBarSubtitle")}
        className="lg:col-span-2"
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
          <div
            className={cn(
              "max-w-sm rounded-2xl border border-[var(--border)]/60 bg-[var(--muted)]/25 px-5 py-4",
              "text-sm leading-relaxed text-[var(--muted-foreground)]",
            )}
          >
            {t("orders.analytics.noDataInRange")}
          </div>
        </div>
      </ChartShell>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-7">
      <ChartShell
        icon={BarChart3}
        title={t("orders.analytics.chartOrdersPerDay")}
        subtitle={t("orders.analytics.chartBarSubtitle")}
      >
        <div className="h-full w-full min-h-[220px] flex-1 sm:min-h-[240px]">
          <ResponsiveContainer width="100%" height="100%" minHeight={220}>
            <BarChart data={barData} margin={{ top: 6, right: 8, left: -6, bottom: 2 }} barCategoryGap="22%">
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SITE.primaryMid} stopOpacity={0.95} />
                  <stop offset="55%" stopColor={THEME.barLow} stopOpacity={1} />
                  <stop offset="100%" stopColor={SITE.primary} stopOpacity={0.94} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={THEME.grid} strokeDasharray="4 6" />
              <XAxis
                dataKey="day"
                tickFormatter={formatDayTick}
                tick={{ fill: THEME.tick, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                width={38}
                tick={{ fill: THEME.tick, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <Tooltip
                cursor={{ fill: THEME.cursor, radius: 10 }}
                animationDuration={180}
                wrapperStyle={{ outline: "none" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as BarRow | undefined;
                  const dayKeyVal = row?.day ?? (typeof label === "string" ? label : "");
                  const n = row?.orders ?? (typeof payload[0]?.value === "number" ? payload[0].value : 0);
                  return (
                    <div
                      className={cn(
                        "max-w-[240px] rounded-xl border border-[var(--border)]/90 bg-white/95 px-3.5 py-3",
                        "shadow-[0_12px_40px_-16px_rgba(26,26,26,0.12)] backdrop-blur-md",
                      )}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                        {formatDayTitle(dayKeyVal)}
                      </p>
                      <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
                        {n}
                        <span className="ml-1.5 text-sm font-medium text-[var(--muted-foreground)]">
                          {ordersLabelShort}
                        </span>
                      </p>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="orders"
                name="orders"
                fill={`url(#${gradId})`}
                radius={[10, 10, 6, 6]}
                maxBarSize={48}
                stroke={THEME.barStroke}
                strokeWidth={1}
                animationDuration={620}
                animationEasing="ease-out"
                activeBar={{
                  fill: SITE.primary,
                  fillOpacity: 0.35,
                  stroke: "rgba(232, 119, 46, 0.45)",
                  strokeWidth: 1,
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartShell>

      <ChartShell
        icon={PieChartIcon}
        title={t("orders.analytics.chartDeliveredVsActive")}
        subtitle={t("orders.analytics.chartPieSubtitle")}
        footer={
          pieRows.length > 0 ? (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-[var(--border)]/40 px-2 pt-5">
              {pieRows.map((row) => (
                <div
                  key={row.name}
                  className="flex items-center gap-2.5 rounded-full bg-[var(--muted)]/20 py-1 pl-1 pr-3"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full shadow-sm ring-2 ring-white"
                    style={{ backgroundColor: row.fill }}
                  />
                  <span className="text-[13px] text-[var(--muted-foreground)]">{row.name}</span>
                  <span className="text-[13px] font-semibold tabular-nums text-[var(--foreground)]">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null
        }
      >
        {pieRows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-4 py-12">
            <p className="max-w-xs text-center text-sm leading-relaxed text-[var(--muted-foreground)]">
              {t("orders.analytics.noSliceData")}
            </p>
          </div>
        ) : (
          <div className="h-full w-full min-h-[220px] flex-1 sm:min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={220}>
              <PieChart>
                <Tooltip
                  animationDuration={180}
                  wrapperStyle={{ outline: "none" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0];
                    const name = p.name ?? "";
                    const value = typeof p.value === "number" ? p.value : Number(p.value ?? 0);
                    const pct = pieTotal > 0 ? Math.round((value / pieTotal) * 100) : 0;
                    return (
                      <div
                        className={cn(
                          "min-w-[168px] rounded-xl border border-[var(--border)]/90 bg-white/95 px-3.5 py-3",
                          "shadow-[0_12px_40px_-16px_rgba(26,26,26,0.12)] backdrop-blur-md",
                        )}
                      >
                        <p className="text-sm font-medium leading-snug text-[var(--foreground)]">{name}</p>
                        <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
                          {value}
                          <span className="ml-1.5 text-sm font-medium text-[var(--muted-foreground)]">
                            {countLabelShort}
                          </span>
                        </p>
                        {pieTotal > 0 ? (
                          <p className="mt-2 text-xs font-medium tabular-nums text-[var(--muted-foreground)]">
                            {pct}% {t("orders.analytics.ofChartTotal")}
                          </p>
                        ) : null}
                      </div>
                    );
                  }}
                />
                <Pie
                  data={pieRows}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="52%"
                  outerRadius="76%"
                  paddingAngle={2.75}
                  cornerRadius={7}
                  stroke="#ffffff"
                  strokeWidth={2.5}
                  animationDuration={680}
                  animationEasing="ease-out"
                >
                  {pieRows.map((entry, i) => (
                    <Cell key={`${entry.name}-${i}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartShell>
    </div>
  );
}
