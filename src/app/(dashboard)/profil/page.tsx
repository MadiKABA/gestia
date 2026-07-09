import { getCurrentUserAction } from "@/presentation/auth/actions";
import { ProfilView } from "@/presentation/auth/components/profil-view";

/** Accessible aux deux rôles (PATRON via le dropdown du header, VENDEUR via
 * son entrée sidebar dédiée, voir nav-config.ts) — lecture seule, aucune
 * modification (hors périmètre de ce retrofit navigation). */
export default async function ProfilPage() {
  const currentUser = await getCurrentUserAction();

  return <ProfilView currentUser={currentUser} />;
}
