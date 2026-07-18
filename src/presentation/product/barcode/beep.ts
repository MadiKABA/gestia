const BEEP_SRC = "/sounds/beep.wav";

let sharedAudio: HTMLAudioElement | null = null;

function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio(BEEP_SRC);
    sharedAudio.preload = "auto";
  }
  return sharedAudio;
}

/**
 * Débloque la lecture audio pour le reste de la session — à appeler depuis
 * le `onClick` qui ouvre le scanner (geste utilisateur direct, pas un effet
 * différé), jamais depuis un effet React. Les navigateurs mobiles (Chrome
 * Android inclus) exigent qu'un `<audio>` soit joué au moins une fois en
 * réaction directe à un geste avant d'autoriser une lecture ultérieure
 * déclenchée par du code asynchrone (ici, la détection réussie, plusieurs
 * frames après l'ouverture) — sans cet amorçage, `playSuccessBeep()` plus
 * tard échoue silencieusement (promesse rejetée, aucun son).
 */
export function unlockBeepAudio(): void {
  const audio = getSharedAudio();
  const playResult = audio.play();
  if (playResult && typeof playResult.then === "function") {
    playResult
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
      })
      .catch(() => {
        // Toujours débloqué au prochain geste utilisateur — pas fatal ici.
      });
  }
}

/** Lecture du bip de confirmation — voir unlockBeepAudio() pour la condition
 * qui la rend audible sur mobile. Jamais bloquant si indisponible. */
export function playSuccessBeep(): void {
  const audio = getSharedAudio();
  audio.currentTime = 0;
  void audio.play().catch(() => {
    // Bip optionnel, jamais fatal pour le scan lui-même.
  });
}
