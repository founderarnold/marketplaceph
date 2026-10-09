import { Bike, Briefcase, Building2, Calculator, Car, ChefHat, Gift, Hammer, HeartPulse, Megaphone, Package, Ship, Sparkles, Truck, Shirt, Smartphone, Sofa, Sprout, Tag, Utensils, Wrench, type LucideIcon } from "lucide-react";

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
  "building-2": Building2,
  ship: Ship,
  truck: Truck,
  bike: Bike,
  megaphone: Megaphone,
  "chef-hat": ChefHat,
  calculator: Calculator,
  sparkles: Sparkles,
  wrench: Wrench,
};

export function CategoryIcon({ name, size = 24 }: { name: string | null; size?: number }) {
  const Icon = (name && icons[name]) || Tag;
  return <Icon size={size} aria-hidden />;
}
