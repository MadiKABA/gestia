import {
  ArrowRightLeft,
  ClipboardList,
  HandCoins,
  Home,
  MessageCircle,
  PlusCircle,
  Receipt,
  Settings,
  UserCircle,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { TenantContext } from "@/domain/shared/tenant-context";
import { partyLabels, transactionLabels } from "@/presentation/shared/labels";

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
  {
    key: "tiers",
    label: partyLabels.listTitle,
    href: "/tiers",
    icon: Users,
    roles: ["PATRON", "VENDEUR"],
  },
  {
    key: "nouvelle-operation",
    label: transactionLabels.newOperationButtonLabel,
    href: "/transactions/nouvelle",
    icon: PlusCircle,
    roles: ["PATRON", "VENDEUR"],
  },
  {
    key: "creances",
    label: "Créances",
    href: "/transactions?type=CREANCE",
    icon: Receipt,
    roles: ["PATRON"],
  },
  {
    key: "dettes",
    label: "Dettes",
    href: "/transactions?type=DETTE",
    icon: HandCoins,
    roles: ["PATRON"],
  },
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

/**
 * Titres de pages accessibles (ex: depuis la fiche client ou le bouton "+")
 * mais qui n'ont pas leur propre entrée de navigation dédiée. Sert aussi de
 * secours pour "Créances"/"Dettes" (SIDEBAR_NAV_ITEMS) : leur `href` inclut
 * une query string (`/transactions?type=...`), jamais égale à `pathname`
 * (qui ne la contient pas) — ce mapping matche sur le pathname seul, peu
 * importe le filtre choisi. Distinct de SIDEBAR_NAV_ITEMS pour ne jamais
 * faire apparaître cette entrée générique dans le menu.
 */
const EXTRA_PAGE_TITLES: { href: string; label: string }[] = [
  { href: "/transactions", label: transactionLabels.listTitle },
];

/** Titre de la page courante affiché dans le header, dérivé du pathname —
 * pas de breadcrumb, un seul titre clair. */
export function getPageTitle(pathname: string): string {
  const match = SIDEBAR_NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (match) return match.label;

  const extra = EXTRA_PAGE_TITLES.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return extra?.label ?? "Gestia";
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
    { type: "link", key: "tiers", label: partyLabels.listTitle, href: "/tiers", icon: Users },
    { type: "quick-action", key: "quick-action", label: "Ajouter" },
    { type: "link", key: "caisse", label: "Caisse", href: "/caisse", icon: Wallet },
    { type: "more", key: "more", label: "Plus" },
  ],
  VENDEUR: [
    { type: "link", key: "tiers", label: partyLabels.listTitle, href: "/tiers", icon: Users },
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
 * `href` absent : l'item ouvre le wizard de création d'opération sur place
 * plutôt que de naviguer vers une page dédiée (voir quick-action-sheet.tsx).
 */
export type QuickActionItem = {
  key: string;
  label: string;
  href?: string;
  icon: LucideIcon;
  roles: NavRole[];
};

export const QUICK_ACTION_ITEMS: QuickActionItem[] = [
  {
    key: "nouvelle-operation",
    label: transactionLabels.newOperationButtonLabel,
    icon: Receipt,
    roles: ["PATRON", "VENDEUR"],
  },
  {
    key: "nouveau-paiement",
    label: "Nouveau paiement",
    href: "/paiements/nouveau",
    icon: Wallet,
    roles: ["PATRON", "VENDEUR"],
  },
  {
    key: "mouvement-caisse",
    label: "Mouvement de caisse",
    href: "/caisse/mouvement",
    icon: ArrowRightLeft,
    roles: ["PATRON"],
  },
];

export function getQuickActionItems(role: NavRole): QuickActionItem[] {
  return QUICK_ACTION_ITEMS.filter((item) => item.roles.includes(role));
}
