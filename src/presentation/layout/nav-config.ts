import {
  ClipboardList,
  HandCoins,
  Home,
  MessageCircle,
  Receipt,
  Settings,
  UserCircle,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { TenantContext } from "@/domain/shared/tenant-context";

export type NavRole = TenantContext["role"];

/**
 * Contenu complet de navigation (drawer mobile ET sidebar fixe desktop
 * partagent cette même liste — un seul tableau à étendre pour les futures
 * features V1.5/V2, jamais de liens dupliqués dans le JSX des composants).
 */
export type SidebarNavItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  roles: NavRole[];
};

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { key: "dashboard", label: "Accueil", href: "/dashboard", icon: Home, roles: ["PATRON"] },
  { key: "tiers", label: "Tiers", href: "/tiers", icon: Users, roles: ["PATRON", "VENDEUR"] },
  { key: "creances", label: "Créances", href: "/creances", icon: Receipt, roles: ["PATRON"] },
  { key: "dettes", label: "Dettes", href: "/dettes", icon: HandCoins, roles: ["PATRON"] },
  { key: "caisse", label: "Caisse", href: "/caisse", icon: Wallet, roles: ["PATRON"] },
  {
    key: "mes-operations",
    label: "Mes opérations",
    href: "/mes-operations",
    icon: ClipboardList,
    roles: ["VENDEUR"],
  },
  {
    key: "relances",
    label: "Relances WhatsApp",
    href: "/relances",
    icon: MessageCircle,
    roles: ["PATRON"],
  },
  { key: "vendeurs", label: "Vendeurs", href: "/vendeurs", icon: UserCog, roles: ["PATRON"] },
  {
    key: "parametres",
    label: "Paramètres",
    href: "/parametres",
    icon: Settings,
    roles: ["PATRON"],
  },
  { key: "profil", label: "Profil", href: "/profil", icon: UserCircle, roles: ["VENDEUR"] },
];

export function getSidebarNavItems(role: NavRole): SidebarNavItem[] {
  return SIDEBAR_NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/** Titre de la page courante affiché dans le header, dérivé du pathname —
 * pas de breadcrumb, un seul titre clair. */
export function getPageTitle(pathname: string): string {
  const match = SIDEBAR_NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label ?? "Gestia";
}

/**
 * Bottom tab bar mobile : structurellement différente par rôle (pas un
 * simple filtre du tableau sidebar) car elle inclut des entrées spéciales
 * (bouton central "+", raccourci "Plus" vers le drawer) absentes de la
 * sidebar.
 */
export type BottomTabItem =
  | { type: "link"; key: string; label: string; href: string; icon: LucideIcon }
  | { type: "quick-action"; key: "quick-action"; label: string }
  | { type: "more"; key: "more"; label: string };

export const BOTTOM_TAB_ITEMS: Record<NavRole, BottomTabItem[]> = {
  PATRON: [
    { type: "link", key: "dashboard", label: "Accueil", href: "/dashboard", icon: Home },
    { type: "link", key: "tiers", label: "Tiers", href: "/tiers", icon: Users },
    { type: "quick-action", key: "quick-action", label: "Ajouter" },
    { type: "link", key: "caisse", label: "Caisse", href: "/caisse", icon: Wallet },
    { type: "more", key: "more", label: "Plus" },
  ],
  VENDEUR: [
    { type: "link", key: "tiers", label: "Tiers", href: "/tiers", icon: Users },
    { type: "quick-action", key: "quick-action", label: "Ajouter" },
    {
      type: "link",
      key: "mes-operations",
      label: "Mes opérations",
      href: "/mes-operations",
      icon: ClipboardList,
    },
    { type: "more", key: "more", label: "Plus" },
  ],
};

/**
 * Items du menu rapide ouvert par le bouton central "+" de la bottom tab
 * bar (bottom sheet / popover) — mêmes actions pour les deux rôles.
 */
export type QuickActionItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

export const QUICK_ACTION_ITEMS: QuickActionItem[] = [
  { key: "nouvelle-creance", label: "Nouvelle créance", href: "/creances/nouvelle", icon: Receipt },
  { key: "nouvelle-dette", label: "Nouvelle dette", href: "/dettes/nouvelle", icon: HandCoins },
  { key: "nouveau-paiement", label: "Nouveau paiement", href: "/paiements/nouveau", icon: Wallet },
];
