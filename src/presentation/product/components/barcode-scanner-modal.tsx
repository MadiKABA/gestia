"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { ResponsivePanel } from "@/presentation/shared/components/responsive-panel";
import { Button } from "@/presentation/shared/components/ui/button";
import { ensureZXingModulePrepared } from "@/presentation/product/barcode/zxing-setup";
import { playSuccessBeep } from "@/presentation/product/barcode/beep";
import { productLabels } from "@/presentation/shared/labels";
import { cn } from "@/lib/utils";

type ScanState = "scanning" | "success" | "error";

const DETECT_INTERVAL_MS = 300;
/** Délai raisonnable avant le signal visuel d'erreur — ne ferme jamais le
 * scanner automatiquement, l'utilisateur garde la main (voir spec point 6). */
const NO_READ_TIMEOUT_MS = 8000;

/** Préfixe grep-able pour isoler ces logs dans la console distante (chrome://inspect
 * sur Android) — retiré une fois le diagnostic du scan conclu. */
const LOG_PREFIX = "[barcode-scan]";

/**
 * Scan caméra (Android + iOS) via `barcode-detector` (ZXing-WASM,
 * fonctionne sur Safari/iOS contrairement à l'API native `BarcodeDetector`
 * seule — voir zxing-setup.ts). Aucun contrôle de torche (indisponible sur
 * iOS Safari) : retour visuel plein écran à la place (flash vert = succès,
 * flash rouge = pas de lecture après un délai raisonnable, sans fermeture
 * automatique) + bip de confirmation.
 *
 * `ScannerSession` remonte entièrement (via `key`) à chaque ouverture et à
 * chaque "Réessayer" plutôt que de réinitialiser son état depuis un effet du
 * parent — évite un `setState` synchrone en tête d'effet (cascade de rendus).
 */
export function BarcodeScannerModal({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (value: string) => void;
}) {
  const [sessionKey, setSessionKey] = useState(0);

  const handleDetected = useCallback(
    (value: string) => {
      onDetected(value);
      onOpenChange(false);
    },
    [onDetected, onOpenChange],
  );
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);
  const handleRetry = useCallback(() => setSessionKey((count) => count + 1), []);

  return (
    <ResponsivePanel open={open} onOpenChange={onOpenChange} title={productLabels.scanTitle}>
      {open ? (
        <ScannerSession
          key={sessionKey}
          onDetected={handleDetected}
          onCancel={handleCancel}
          onRetry={handleRetry}
        />
      ) : null}
    </ResponsivePanel>
  );
}

function ScannerSession({
  onDetected,
  onCancel,
  onRetry,
}: {
  onDetected: (value: string) => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<ScanState>("scanning");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let noReadTimeoutId: ReturnType<typeof setTimeout> | undefined;

    ensureZXingModulePrepared();

    function stopCamera() {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    function onSuccess(value: string) {
      console.warn(`${LOG_PREFIX} code détecté :`, value);
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (noReadTimeoutId) clearTimeout(noReadTimeoutId);
      setState("success");
      playSuccessBeep();
      // Flash vert bref avant fermeture — laisse le temps du retour visuel,
      // voir spec point 6 ("ferme le scanner et remplit le champ").
      setTimeout(() => {
        stopCamera();
        onDetected(value);
      }, 400);
    }

    async function start() {
      try {
        console.warn(`${LOG_PREFIX} import de la bibliothèque de détection…`);
        const { BarcodeDetector } = await import("barcode-detector/ponyfill");
        if (cancelled) return;
        const detector = new BarcodeDetector();
        console.warn(`${LOG_PREFIX} BarcodeDetector construit`);

        console.warn(`${LOG_PREFIX} demande d'accès caméra (getUserMedia)…`);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const [track] = stream.getVideoTracks();
        console.warn(`${LOG_PREFIX} flux caméra obtenu`, track?.getSettings());

        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        console.warn(
          `${LOG_PREFIX} vidéo en lecture — readyState=${videoRef.current.readyState}` +
            ` dimensions=${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`,
        );

        // Amorce explicite du module WASM AVANT la première frame — sépare
        // clairement, dans les logs, un échec de chargement (jamais aucune
        // frame annoncée "analysée" ensuite) d'un échec de détection pure
        // (frames analysées, mais aucun code trouvé) : deux causes très
        // différentes que le diagnostic précédent n'avait pas distinguées.
        try {
          const detected = await detector.detect(videoRef.current);
          console.warn(`${LOG_PREFIX} amorçage du décodeur OK (${detected.length} résultat(s))`);
        } catch (warmupError) {
          console.error(
            `${LOG_PREFIX} amorçage du décodeur EN ÉCHEC — voir l'erreur ci-dessus`,
            warmupError,
          );
        }

        let frameCount = 0;
        intervalId = setInterval(() => {
          if (!videoRef.current || cancelled) return;
          frameCount += 1;
          const currentFrame = frameCount;
          detector
            .detect(videoRef.current)
            .then((barcodes) => {
              console.warn(
                `${LOG_PREFIX} frame #${currentFrame} analysée — ${barcodes.length} code(s)`,
              );
              if (!cancelled && barcodes.length > 0) {
                onSuccess(barcodes[0]!.rawValue);
              }
            })
            .catch((detectError) => {
              // Erreur de décodage ponctuelle (frame illisible) — retente à
              // la prochaine frame, jamais fatal, mais toujours journalisée
              // (contrairement à avant : plus jamais avalée en silence) pour
              // distinguer un vrai échec récurrent d'un bruit de frame isolé.
              console.error(`${LOG_PREFIX} frame #${currentFrame} en erreur`, detectError);
            });
        }, DETECT_INTERVAL_MS);

        noReadTimeoutId = setTimeout(() => {
          console.warn(
            `${LOG_PREFIX} timeout sans lecture après ${frameCount} frame(s) analysée(s)`,
          );
          if (!cancelled) setState("error");
        }, NO_READ_TIMEOUT_MS);
      } catch (err) {
        console.error(`${LOG_PREFIX} échec avant le démarrage du scan`, err);
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : productLabels.scanCameraError);
          setState("error");
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (noReadTimeoutId) clearTimeout(noReadTimeoutId);
      stopCamera();
    };
  }, [onDetected]);

  return (
    <div className="space-y-4">
      <div className="border-border relative aspect-square w-full overflow-hidden rounded-xl border bg-black">
        <video ref={videoRef} className="size-full object-cover" muted playsInline autoPlay />
        {/* Cadre de visée */}
        <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-white/70" />
        {/* Flash plein écran : vert (succès) / rouge (pas de lecture) */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 transition-opacity duration-200",
            state === "success" && "bg-[#1B7A5A]/60 opacity-100",
            state === "error" && "bg-[#C0392B]/40 opacity-100",
            state === "scanning" && "opacity-0",
          )}
        />
      </div>

      <p className="text-muted-foreground text-center text-sm">
        {state === "error" && errorMessage ? errorMessage : productLabels.scanInstructions}
      </p>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          {productLabels.scanCancelLabel}
        </Button>
        {state === "error" ? (
          <Button type="button" variant="outline" className="flex-1" onClick={onRetry}>
            <RotateCw className="size-4" aria-hidden="true" />
            {productLabels.scanRetryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
