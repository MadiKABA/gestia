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
  editButtonLabel: "Modifier",

  emptyStateList: "Aucun client pour le moment.",
  emptyStateTransactions: "Aucune opération pour ce client.",

  isCompanyLabel: "Entreprise",
  isCompanyDescription: "Ce client est une société, pas un particulier",
  companyNameField: "Nom de la société (recommandé)",
  contactNameField: "Nom du contact",

  nameField: "Nom",
  phoneField: "Téléphone",
  whatsappField: "WhatsApp (si différent du téléphone)",
  whatsappHelperText: "Un moyen de contact est requis : téléphone ou WhatsApp.",
  typeField: "Type",
  noteField: "Note (optionnel)",

  nameRequiredError: "Le nom du client est obligatoire",

  deleteConfirmTitle: (name: string) => `Supprimer ${name} ?`,
  deleteConfirmDescription:
    "Ce client sera retiré de votre liste. Rien n'est perdu définitivement : il pourra être restauré si besoin.",

  notFoundMessage: "Ce client n'existe plus, il a peut-être déjà été supprimé.",

  historyTitle: "Historique",

  // Étape "personne" du parcours de création d'une opération (wizard) :
  // recherche/sélection d'un tiers existant ou création à la volée.
  pickerSearchPlaceholder: "Rechercher un client par nom ou téléphone",
  pickerCreateNewLabel: "Créer une nouvelle personne",
  pickerCreateNewNameField: "Nom",
  pickerCreateNewPhoneField: "Téléphone",
  pickerTypeQuestion: "Client ou fournisseur ?",
  pickerContinueLabel: "Continuer",
};

export const transactionLabels = {
  typeCreance: "Créance",
  typeDette: "Dette",
  filterAll: "Toutes",
  filterCreance: "Créances",
  filterDette: "Dettes",

  statusEnCours: "En cours",
  statusPartielle: "Partielle",
  statusReglee: "Réglée",

  listTitle: "Créances et dettes",
  newCreanceButtonLabel: "Nouvelle créance",
  newDetteButtonLabel: "Nouvelle dette",
  newOperationButtonLabel: "Nouvelle opération",
  newPageTitleCreance: "Nouvelle créance",
  newPageTitleDette: "Nouvelle dette",
  editPageTitle: "Modifier l'opération",
  createSubmitLabel: "Enregistrer",
  editSubmitLabel: "Enregistrer les modifications",
  editButtonLabel: "Modifier",

  emptyStateList: "Aucune créance ni dette pour le moment.",

  partyField: "Client",
  descriptionField: "Qu'est-ce qui a été pris ?",
  amountField: "Montant (FCFA)",
  quantityField: "Quantité (optionnel)",
  dueDateField: "Échéance (optionnel)",
  referenceLabel: "Référence",
  statusLabel: "Statut",
  quantityLabel: "Quantité",
  dueDateLabel: "Échéance",

  descriptionRequiredError: "La description est obligatoire",
  amountInvalidError: "Le montant doit être supérieur à zéro",
  partyRequiredError: "Le client est obligatoire",

  deleteConfirmTitle: (reference: string) => `Supprimer ${reference} ?`,
  deleteConfirmDescription:
    "Cette opération sera retirée de votre liste. Rien n'est perdu définitivement : elle pourra être restaurée si besoin.",

  notFoundMessage: "Cette opération n'existe plus, elle a peut-être déjà été supprimée.",

  // Vocabulaire "situation" (étape 3 du wizard ET résumé agrégé) — mêmes
  // termes exacts partout dans l'app, jamais reformulés différemment.
  owedToMeLabel: "On me doit",
  owedByMeLabel: "Je dois",
  situationQuestion: "Quelle est la situation ?",

  // Parcours de création unifié (wizard).
  amountFieldShort: "Montant",
  quickAmountAriaLabel: (amount: number) => `Ajouter ${amount.toLocaleString("fr-FR")} FCFA`,
  stepPersonTitle: "Qui est concerné ?",
  stepAmountTitle: "Montant et description",
  stepSituationTitle: "Situation",
  backLabel: "Retour",
  continueLabel: "Continuer",
  saveLabel: "Enregistrer",

  showMoreLabel: "Voir plus",
};

export const paymentLabels = {
  payButtonLabel: (type: "CREANCE" | "DETTE") => (type === "CREANCE" ? "Encaisser" : "Rembourser"),
  methodField: "Mode de paiement",
  methodCash: "Espèces",
  methodWave: "Wave",
  methodOrangeMoney: "Orange Money",
  methodOther: "Autre",
  amountRemainingHint: (remaining: number) =>
    `Solde restant : ${remaining.toLocaleString("fr-FR")} FCFA`,
  historyTitle: "Historique des paiements",
  amountExceedsRemainingError: "Le montant ne peut pas dépasser le solde restant",
  amountInvalidError: "Le montant doit être supérieur à zéro",

  editDisabledTooltip: "Déjà réglée en partie, modification impossible",
};

export const authLabels = {
  vendeurNotFoundMessage: "Ce vendeur n'existe plus.",
};

export const pwaLabels = {
  installTitle: "Installer Gestia",
  installDescription: "Accédez à Gestia plus rapidement, même hors connexion.",
  installButton: "Installer",
  later: "Plus tard",
  iosTitle: "Installer Gestia",
  iosInstructions: "Appuyez sur Partager, puis « Sur l'écran d'accueil ».",
  dismissAria: "Plus tard",
};

export const storageLabels = {
  warningTitle: "Stockage limité sur cet appareil",
  warningDescription:
    "Synchronisez dès que possible pour ne pas risquer de perdre des actions en attente.",
  dismissAria: "Fermer l'avertissement",
};

export const syncLabels = {
  offline: "Hors ligne",
  offlinePending: (count: number) =>
    `Hors ligne — ${count} action${count > 1 ? "s" : ""} en attente`,
  syncing: "Synchronisation en cours...",
  pending: (count: number) => `${count} action${count > 1 ? "s" : ""} en attente`,
  error: "Échec de la synchronisation, nouvelle tentative en cours",
  authRequired: "Session expirée — reconnexion nécessaire",
  syncNow: "Synchroniser maintenant",
};
