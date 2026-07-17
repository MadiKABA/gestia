"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { ResponsivePanel } from "@/presentation/shared/components/responsive-panel";
import { Button } from "@/presentation/shared/components/ui/button";
import { ensureZXingModulePrepared } from "@/presentation/product/barcode/zxing-setup";
import { productLabels } from "@/presentation/shared/labels";
import { cn } from "@/lib/utils";

type ScanState = "scanning" | "success" | "error";

const DETECT_INTERVAL_MS = 300;
/** Délai raisonnable avant le signal visuel d'erreur — ne ferme jamais le
 * scanner automatiquement, l'utilisateur garde la main (voir spec point 6). */
const NO_READ_TIMEOUT_MS = 8000;

/** Bip de confirmation généré via Web Audio API — pas de fichier audio à
 * charger/précacher, jamais bloquant si indisponible (permissions/plateforme). */
function playBeep(): void {
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.2;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.15);
    oscillator.onended = () => void context.close();
  } catch {
    // Son de confirmation optionnel, jamais bloquant.
  }
}

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
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (noReadTimeoutId) clearTimeout(noReadTimeoutId);
      setState("success");
      playBeep();
      // Flash vert bref avant fermeture — laisse le temps du retour visuel,
      // voir spec point 6 ("ferme le scanner et remplit le champ").
      setTimeout(() => {
        stopCamera();
        onDetected(value);
      }, 400);
    }

    async function start() {
      try {
        const { BarcodeDetector } = await import("barcode-detector/ponyfill");
        if (cancelled) return;
        const detector = new BarcodeDetector();

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        intervalId = setInterval(() => {
          if (!videoRef.current || cancelled) return;
          detector
            .detect(videoRef.current)
            .then((barcodes) => {
              if (!cancelled && barcodes.length > 0) {
                onSuccess(barcodes[0]!.rawValue);
              }
            })
            .catch(() => {
              // Erreur de décodage ponctuelle (frame illisible) — retente à
              // la prochaine frame, jamais fatal.
            });
        }, DETECT_INTERVAL_MS);

        noReadTimeoutId = setTimeout(() => {
          if (!cancelled) setState("error");
        }, NO_READ_TIMEOUT_MS);
      } catch (err) {
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
