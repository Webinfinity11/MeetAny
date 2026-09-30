import {
  Airplane, Armchair, Bed, Briefcase, Broom, Calculator, ClipboardText, Desktop, Factory, ForkKnife, Handshake,
  HardHat, MagnifyingGlass, Megaphone, Package, Shapes, SquaresFour, Storefront, Tray, Truck,
  Carrot, Wine, CookingPot, Stack, PaintRoller, Lightning, Couch, TShirt, Tag, Printer, Warehouse, Stamp,
  Barcode, Paperclip, WashingMachine, Wrench, ShieldCheck, Code, Headset, PenNib, Camera, Confetti, Scales,
  ChartLineUp, UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

// Phosphor (light weight: thin, unfilled, neutral — owner asked for plain and business-like) for places where the icon itself carries the meaning (categories, partner types,
// steps, empty states). Keyed by the same names as the /icons.svg sprite so call sites stay readable.
// Small meta icons (city, deadline) stay on the thin sprite icons.
const icons: Record<string, PhosphorIcon> = {
  utensils: ForkKnife,
  "hard-hat": HardHat,
  armchair: Armchair,
  factory: Factory,
  package: Package,
  truck: Truck,
  store: Storefront,
  sparkles: Broom,
  monitor: Desktop,
  megaphone: Megaphone,
  "briefcase-business": Briefcase,
  plane: Airplane,
  "bed-double": Bed,
  calculator: Calculator,
  shapes: Shapes,
  handshake: Handshake,
  "file-text": ClipboardText,
  inbox: Tray,
  search: MagnifyingGlass,
  "layout-grid": SquaresFour,
  // One icon per category (the home category strip); keys are category ids.
  food_fresh: Carrot, food_processed: Package, beverages: Wine, catering: CookingPot,
  building_materials: Stack, renovation: PaintRoller, engineering: Lightning,
  furniture: Couch, equipment: Storefront, textiles: TShirt,
  packaging: Tag, printing: Printer,
  freight: Truck, warehouse: Warehouse, customs: Stamp,
  wholesale: Barcode, office_household: Paperclip,
  cleaning: Broom, laundry: WashingMachine, technical_service: Wrench, security: ShieldCheck,
  software_web: Code, it_support: Headset,
  branding_design: PenNib, advertising: Megaphone, photo_video: Camera, events: Confetti,
  accounting: Calculator, legal: Scales, consulting: ChartLineUp, hr_training: UsersThree,
  hotel_services: Bed, tours: Airplane,
};

/** Thin neutral line icon (see `.duo-icon` in base.css). Decorative: aria-hidden. */
export function DuoIcon({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  const Glyph = icons[name] || Shapes;
  return <Glyph className={className ? `duo-icon ${className}` : "duo-icon"} weight="light" size={size} aria-hidden="true" focusable="false" />;
}
