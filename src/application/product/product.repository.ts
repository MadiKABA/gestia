import type { Product, ProductInput, ProductType } from "@/domain/product/product.entity";

export type ProductSearchQuery = {
  /** Filtre texte combiné nom + code-barres, même convention que
   * `PartySearchQuery.search` (nom + téléphone). */
  search?: string;
  categoryId?: string;
  type?: ProductType;
};

/**
 * Forme persistée par le repository — la photo brute (`ProductInput.photo`,
 * base64) n'atteint jamais Prisma directement : seul `photoUrl`, déjà résolu
 * par le mutation-handler (upload Cloudinary, voir
 * infrastructure/product/product-mutation-handler.ts), y est écrit.
 * `photoUrl` absent (`undefined`) sur un update = aucun changement de photo ;
 * `null` = suppression explicite de la photo existante.
 */
export type ResolvedProductInput = Omit<ProductInput, "photo"> & { photoUrl?: string | null };

/**
 * Contrat implémenté par src/infrastructure/product/product.repository.ts.
 * Toutes les méthodes sont implicitement bornées au tenant courant (voir
 * TenantScopedRepository).
 */
export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  findMany(query: ProductSearchQuery): Promise<Product[]>;
  /** `id` fourni par l'appelant (généré côté client hors ligne), même règle
   * que PartyRepository.create. `createdById` séparé de `input` (même
   * convention que TransactionRepository.create) : jamais fourni par le
   * formulaire, toujours par le contexte serveur au moment de la mutation. */
  create(id: string, input: ResolvedProductInput, createdById: string): Promise<Product>;
  update(id: string, input: ResolvedProductInput): Promise<Product>;
  /** Soft delete (`deletedAt`) — jamais de suppression définitive. */
  delete(id: string): Promise<Product>;
  /** Réservé à `deleteProductCategory` (garde de suppression bloquante) —
   * même forme que `hasOpenTransactionsForParty`. */
  hasActiveProductsInCategory(categoryId: string): Promise<boolean>;
  /** Nombre de produits/services actifs par catégorie, en une seule requête
   * — utilisé par la liste des catégories pour l'affichage du compteur. */
  countActiveByCategoryIds(categoryIds: string[]): Promise<Map<string, number>>;
}
