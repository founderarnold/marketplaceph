import { Briefcase, Car, Gift, Hammer, HeartPulse, Package, Shirt, Smartphone, Sofa, Sprout, Tag, Utensils, Wrench, type LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = {
  utensils: Utensils,
  sprout: Sprout,
  shirt: Shirt,
  "heart-pulse": HeartPulse,
  sofa: Sofa,
  smartphone: Smartphone,
  hammer: Hammer,
  package: Package,
  car: Car,
  gift: Gift,
  briefcase: Briefcase,
  wrench: Wrench,
};

export function CategoryIcon({ name, size = 24 }: { name: string | null; size?: number }) {
  const Icon = (name && icons[name]) || Tag;
  return <Icon size={size} aria-hidden />;
}
