"use client";

import { useState } from "react";
import { ScanBarcode } from "lucide-react";
import { Input } from "@/presentation/shared/components/ui/input";
import { Button } from "@/presentation/shared/components/ui/button";
import { BarcodeScannerModal } from "@/presentation/product/components/barcode-scanner-modal";
import { productLabels } from "@/presentation/shared/labels";

/**
 * Champ code-barres avec bouton de scan caméra à côté — la saisie manuelle
 * directe reste toujours possible (même champ). Un lecteur USB desktop tape
 * le code puis Entrée très vite (HID clavier, cf. spec point 6) : dans un
 * `<form>` avec un seul bouton de soumission, Entrée déclencherait sinon une
 * soumission prématurée avant que les autres champs obligatoires ne soient
 * remplis — explicitement empêché ici, Entrée ne fait que confirmer ce
 * champ (blur), jamais soumettre le formulaire englobant.
 */
export function BarcodeInput({
  id,
  value,
  onValueChange,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const [scannerOpen, setScannerOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onValueChange={onValueChange}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={() => setScannerOpen(true)}>
          <ScanBarcode className="size-4" aria-hidden="true" />
          {productLabels.barcodeScanButtonLabel}
        </Button>
      </div>
      <BarcodeScannerModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={onValueChange}
      />
    </>
  );
}
