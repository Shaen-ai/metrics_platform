"use client";

import {
  Armchair,
  Sofa,
  ChefHat,
  DoorClosed,
  Tv,
  Bed,
  UtensilsCrossed,
  Briefcase,
  TreePine,
  Square,
  RectangleHorizontal,
  LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Armchair,
  Sofa,
  ChefHat,
  DoorClosed,
  Tv,
  Bed,
  UtensilsCrossed,
  Briefcase,
  TreePine,
  Square,
  RectangleHorizontal,
};

interface ModeIconProps {
  name: string;
  className?: string;
}

export function ModeIcon({ name, className }: ModeIconProps) {
  const Icon = iconMap[name] || Armchair;
  return <Icon className={className} />;
}

