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
  // Lien de retour explicite sur les pages de création/édition (mobile-first
  // : chaque écran doit avoir une sortie claire, jamais dépendre du seul
  // bouton retour du navigateur). Même libellé partout, voir back-link.tsx.
  back: "Retour",
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
  // "Impayée" plutôt que "En cours" : wording spécifique au badge d'alerte
  // du tableau desktop/tablette (voir CLAUDE.md "Theming", rouge = alerte).
  // La carte mobile garde "En cours" (statusEnCours), inchangée.
  statusImpayee: "Impayée",

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

  // Tableau desktop/tablette de la liste unifiée (transactions-list.tsx).
  personColumnLabel: "Personne",
  totalAmountColumnLabel: "Montant total",
  paidAmountColumnLabel: "Montant payé",
  dateColumnLabel: "Date",
  actionsColumnLabel: "Actions",
  totalCountLabel: "Nombre d'opérations",
  unpaidCountLabel: "Impayées",
  searchPlaceholder: "Rechercher par référence, nom ou téléphone",
  viewActionLabel: "Voir",

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

  whatsappButtonLabel: "Contacter sur WhatsApp",
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

export const cashMovementLabels = {
  typeEntree: "Entrée",
  typeSortie: "Sortie",

  listTitle: "Caisse",
  newButtonLabel: "Nouveau mouvement",
  newPageTitle: "Nouveau mouvement",
  createSubmitLabel: "Enregistrer",

  balanceLabel: "Solde de caisse",
  totalEntreeLabel: "Total entrées",
  totalSortieLabel: "Total sorties",

  typeField: "Type",
  amountField: "Montant (FCFA)",
  reasonField: "Motif",

  emptyStateList: "Aucun mouvement de caisse pour le moment.",
  showMoreLabel: "Voir plus",

  amountInvalidError: "Le montant doit être supérieur à zéro",
  reasonRequiredError: "Le motif est obligatoire",
};

export const authLabels = {
  vendeurNotFoundMessage: "Ce vendeur n'existe plus.",

  inviteVendeurButtonLabel: "Inviter un vendeur",
  inviteVendeurModalTitle: "Inviter un vendeur",
  vendeurNameField: "Nom du vendeur",
  vendeurPhoneField: "Numéro de téléphone",
  invitingButtonLabel: "Invitation...",
  inviteButtonLabel: "Inviter",

  vendeurInvitedTitle: "Invitation envoyée",
  vendeurInvitedDescription:
    "Un SMS avec le lien de première connexion vient d'être envoyé. Vous pouvez aussi le transmettre vous-même (WhatsApp, etc.) :",
  copyLinkButton: "Copier le lien",
  linkCopiedButton: "Lien copié !",
  copyLinkFailedMessage: "Impossible de copier automatiquement — sélectionnez le lien ci-dessus.",
  dismissVendeurInvitedLabel: "Fermer",

  premiereConnexionExpiredLinkLabel: "Code expiré ? Recevoir un nouveau code",

  viewProfileLabel: "Voir mon profil",
  signOutLabel: "Se déconnecter",
  signingOutLabel: "Déconnexion...",

  profilePageTitle: "Mon profil",
  profileNameLabel: "Nom",
  profilePhoneLabel: "Téléphone",
  profileEmailLabel: "Email",
  profileRoleLabel: "Rôle",
  roleLabelPatron: "Patron",
  roleLabelVendeur: "Vendeur",
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
  failuresLinkLabel: (count: number) => `${count} action${count > 1 ? "s" : ""} en erreur`,
};

/**
 * Résolution des mutations en échec définitif (voir
 * presentation/offline/components/sync-failures-panel.tsx) — un
 * commerçant n'y voit jamais "payment"/"party" bruts ni "sync_conflict",
 * seulement le vocabulaire déjà utilisé ailleurs dans l'app pour cette
 * entité (cf. section Vocabulaire, CLAUDE.md).
 */
export const syncFailuresLabels = {
  pageTitle: "Actions en attente",
  pageDescription:
    "Ces actions n'ont pas pu être enregistrées côté serveur. Vérifiez le motif ci-dessous, puis recréez l'action si elle est toujours nécessaire.",
  emptyState: "Aucune action en attente de résolution.",
  entityLabel: {
    party: "Client",
    transaction: "Opération",
    payment: "Paiement",
    cashMovement: "Mouvement de caisse",
  } as Record<string, string>,
  actionLabel: {
    create: "Création",
    update: "Modification",
    delete: "Suppression",
  } as Record<string, string>,
  discardButton: "Ignorer cette action",
  discardConfirmTitle: "Ignorer cette action ?",
  discardConfirmDescription:
    "Cette action ne sera plus jamais synchronisée. Si elle était toujours nécessaire, vous devrez la recréer une fois reconnecté.",
};
