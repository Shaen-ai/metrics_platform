"use client";

import {
  Armchair,
  Sofa,
  DoorOpen,
  ChefHat,
  Tv,
  Bed,
  UtensilsCrossed,
  Briefcase,
  TreePine,
  Square,
  RectangleHorizontal,
  DoorClosed,
  PanelLeftClose,
  SquareStack,
  Hexagon,
  LayoutGrid,
  LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Armchair,
  Sofa,
  DoorOpen,
  ChefHat,
  Tv,
  Bed,
  UtensilsCrossed,
  Briefcase,
  TreePine,
  Square,
  RectangleHorizontal,
  DoorClosed,
  PanelLeftClose,
  SquareStack,
  Hexagon,
  LayoutGrid,
};

interface ModeIconProps {
  name: string;
  className?: string;
}

export function ModeIcon({ name, className }: ModeIconProps) {
  const Icon = iconMap[name] || Armchair;
  return <Icon className={className} />;
}

