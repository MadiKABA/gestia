"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff, X } from "lucide-react";
import { Button } from "@/presentation/shared/components/ui/button";
import {
  PRODUCT_PHOTO_ALLOWED_MIME_TYPES,
  PRODUCT_PHOTO_MAX_SIZE_BYTES,
} from "@/domain/product/product-photo";
import type { ProductPhoto } from "@/domain/product/product.entity";
import { productLabels } from "@/presentation/shared/labels";

/**
 * Sélection de fichier avec aperçu local immédiat (`URL.createObjectURL`) —
 * jamais d'upload réseau à la sélection : `onChange` ne fait que convertir le
 * fichier en base64 (lu en mémoire, aucun appel réseau), l'upload Cloudinary
 * réel est déclenché plus tard par le mutation-handler serveur au moment de
 * la synchronisation (voir product-mutation-handler.ts), qu'on soumette en
 * ligne ou hors ligne — même règle que le reste du formulaire.
 */
export function ProductPhotoInput({
  value,
  onChange,
  existingPhotoUrl,
}: {
  value: ProductPhoto | null | undefined;
  onChange: (photo: ProductPhoto | null | undefined) => void;
  /** Photo déjà confirmée côté serveur (mode édition) — affichée tant
   * qu'aucune nouvelle sélection/suppression ne l'a remplacée. */
  existingPhotoUrl?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Révoque l'URL objet locale au démontage — évite une fuite mémoire, la
  // photo elle-même reste possédée par le state React (base64), pas ce blob.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function onFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    // Validation immédiate côté client, avant toute lecture — la validation
    // faisant foi reste côté serveur (validateProductPhotoFile), une fois
    // décodée depuis le payload de mutation.
    if (!(PRODUCT_PHOTO_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError(productLabels.photoFormatError);
      return;
    }
    if (file.size > PRODUCT_PHOTO_MAX_SIZE_BYTES) {
      setError(productLabels.photoTooLargeError);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      onChange({ mimeType: file.type, base64 });
    };
    reader.readAsDataURL(file);

    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  }

  function clearPhoto() {
    onChange(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  const displayedUrl = previewUrl ?? (value === null ? null : (existingPhotoUrl ?? null));

  return (
    <div className="flex items-center gap-4">
      {displayedUrl ? (
        // Aperçu local (`blob:`) impossible à faire passer par next/image
        // (optimiseur conçu pour des URLs http(s)/statiques) — image brute
        // volontaire ici, uniquement pour ce cas précis.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displayedUrl}
          alt=""
          className="border-border size-16 rounded-lg border object-cover"
        />
      ) : (
        <div className="border-border bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-lg border">
          <ImageOff className="size-5" aria-hidden="true" />
        </div>
      )}

      <div className="space-y-1.5">
        <input
          ref={inputRef}
          type="file"
          accept={PRODUCT_PHOTO_ALLOWED_MIME_TYPES.join(",")}
          onChange={onFileSelected}
          className="hidden"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            {productLabels.photoSelectButtonLabel}
          </Button>
          {displayedUrl ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearPhoto}>
              <X className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>
    </div>
  );
}
