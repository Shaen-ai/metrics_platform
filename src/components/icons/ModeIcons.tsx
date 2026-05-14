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
  Refrigerator,
  Coffee,
  Fan,
  Cpu,
  LampDesk,
  Layers,
  LucideIcon,
  Paintbrush,
  PanelTop,
  PanelsTopLeft,
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
  Refrigerator,
  Coffee,
  Fan,
  Cpu,
  LampDesk,
  Layers,
  Paintbrush,
  PanelTop,
  PanelsTopLeft,
};

interface ModeIconProps {
  name: string;
  className?: string;
}

export function ModeIcon({ name, className }: ModeIconProps) {
  const Icon = iconMap[name] || Armchair;
  return <Icon className={className} />;
}

