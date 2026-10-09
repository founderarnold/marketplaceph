import {
  Baby, Bike, Briefcase, Building2, Calculator, Car, ChefHat, Dumbbell, Factory, Footprints, Gamepad2, Gift, GraduationCap, Hammer, HeartPulse, Laptop, Megaphone,
  Package, PartyPopper, PawPrint, Puzzle, Rocket, Ship, Shirt, ShoppingBasket, Smartphone, Sofa, Sparkles, Sprout, Tag, Tags, Tv, Truck, Utensils, Wrench, type LucideIcon,
} from "lucide-react";

/** `categories.icon` values → icons. Unknown or missing names fall back to a tag. */
const icons: Record<string, LucideIcon> = {
  utensils: Utensils, shirt: Shirt, "heart-pulse": HeartPulse, smartphone: Smartphone, laptop: Laptop, tv: Tv, sofa: Sofa, footprints: Footprints,
  baby: Baby, "shopping-basket": ShoppingBasket, car: Car, dumbbell: Dumbbell, "paw-print": PawPrint, puzzle: Puzzle, "gamepad-2": Gamepad2,
  "graduation-cap": GraduationCap, gift: Gift, sprout: Sprout, hammer: Hammer, package: Package, "chef-hat": ChefHat, factory: Factory, tags: Tags,
  truck: Truck, "building-2": Building2, briefcase: Briefcase, megaphone: Megaphone, wrench: Wrench, "party-popper": PartyPopper, rocket: Rocket,
  // kept for older rows
  bike: Bike, calculator: Calculator, ship: Ship, sparkles: Sparkles,
};

export function CategoryIcon({ name, size = 24 }: { name: string | null; size?: number }) {
  const Icon = (name && icons[name]) || Tag;
  return <Icon size={size} aria-hidden />;
}
