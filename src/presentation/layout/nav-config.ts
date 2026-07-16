import {
  ArrowLeftRight,
  ClipboardList,
  Home,
  MessageCircle,
  PlusCircle,
  Receipt,
  Settings,
  ShoppingCart,
  UserCircle,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { TenantContext } from "@/domain/shared/tenant-context";
import { cashMovementLabels, partyLabels, transactionLabels } from "@/presentation/shared/labels";

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
    // Réservée à VENDEUR : PATRON crée désormais une opération depuis le
    // bouton dédié de la page liste unifiée ci-dessous (pas de lien sidebar
    // séparé) — VENDEUR n'a pas encore cette page ("mes-operations" non
    // construite), ce lien reste donc son seul accès sidebar à la création.
    key: "nouvelle-operation",
    label: transactionLabels.newOperationButtonLabel,
    href: "/transactions/nouvelle",
    icon: PlusCircle,
    roles: ["VENDEUR"],
  },
  {
    // Fusion des anciennes entrées "Créances"/"Dettes" — une seule liste
    // unifiée (voir transactions-list.tsx), plus de filtre pré-appliqué par
    // l'URL de la sidebar.
    key: "operations",
    label: transactionLabels.listTitle,
    href: "/transactions",
    icon: Receipt,
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

/** Titre de la page courante affiché dans le header, dérivé du pathname —
 * pas de breadcrumb, un seul titre clair. Le premier item dont le `href`
 * préfixe le pathname l'emporte (ex: "/transactions/nouvelle" matche
 * "nouvelle-operation" avant "operations", grâce à l'ordre du tableau). */
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
 * bar (bottom sheet / popover) — chacun navigue vers sa page dédiée (voir
 * quick-action-sheet.tsx, grille 2×2 déjà pilotée par ce tableau). "Mouvement
 * de caisse" et "Vente" sont réservés à PATRON (même garde que
 * createCashMovement — jamais de trésorerie globale pour un vendeur, cf.
 * CLAUDE.md "Rôles") : le menu VENDEUR reste à 2 entrées, seul celui de
 * PATRON forme une grille 2×2 complète.
 */
export type QuickActionItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  roles: NavRole[];
};

export const QUICK_ACTION_ITEMS: QuickActionItem[] = [
  {
    key: "nouvelle-operation",
    label: transactionLabels.newOperationButtonLabel,
    href: "/transactions/nouvelle",
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
    label: cashMovementLabels.newButtonLabel,
    href: "/caisse/nouveau",
    icon: ArrowLeftRight,
    roles: ["PATRON"],
  },
  {
    key: "nouvelle-vente",
    label: cashMovementLabels.saleQuickActionLabel,
    href: "/ventes/new",
    icon: ShoppingCart,
    roles: ["PATRON"],
  },
];

export function getQuickActionItems(role: NavRole): QuickActionItem[] {
  return QUICK_ACTION_ITEMS.filter((item) => item.roles.includes(role));
}
