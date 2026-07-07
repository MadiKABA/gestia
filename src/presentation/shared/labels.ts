/**
 * Vocabulaire UI centralisé — seul endroit à modifier pour ajuster un terme
 * affiché au commerçant dans toute l'app (jamais de jargon comptable/
 * technique, cf. CLAUDE.md "Vocabulaire imposé"). N'est jamais importé par
 * domain/ ou application/ : le sens de dépendance layer-first va toujours
 * vers la présentation, jamais l'inverse.
 */

export const commonLabels = {
  cancel: "Annuler",
  confirm: "Confirmer",
  delete: "Supprimer",
  deleting: "Suppression...",
  genericError: "Une erreur est survenue",
};

export const partyLabels = {
  typeClient: "Client",
  typeSupplier: "Fournisseur",
  typeBoth: "Client et fournisseur",
  filterAll: "Tous",
  filterClient: "Clients",
  filterSupplier: "Fournisseurs",

  listTitle: "Clients",
  newButtonLabel: "Nouveau client",
  newPageTitle: "Nouveau client",
  editPageTitle: "Modifier le client",
  createSubmitLabel: "Créer le client",
  editSubmitLabel: "Enregistrer les modifications",

  emptyStateList: "Aucun client pour le moment.",
  emptyStateTransactions: "Aucune transaction pour ce client.",

  isCompanyLabel: "Entreprise",
  isCompanyDescription: "Ce client est une société, pas un particulier",
  companyNameField: "Nom de la société (recommandé)",
  contactNameField: "Nom du contact",

  nameRequiredError: "Le nom du client est obligatoire",

  deleteConfirmTitle: (name: string) => `Supprimer ${name} ?`,
  deleteConfirmDescription:
    "Ce client sera retiré de votre liste. Rien n'est perdu définitivement : il pourra être restauré si besoin.",

  notFoundMessage: "Ce client n'existe plus, il a peut-être déjà été supprimé.",
};

export const authLabels = {
  vendeurNotFoundMessage: "Ce vendeur n'existe plus.",
};
