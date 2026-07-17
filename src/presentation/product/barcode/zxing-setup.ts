import { prepareZXingModule } from "barcode-detector/ponyfill";

let prepared = false;

/**
 * Configure le chargement du binaire WASM de décodage depuis notre propre
 * origine (`/zxing_reader.wasm`, copié dans public/ à l'installation par
 * scripts/copy-zxing-wasm.mjs) — jamais le CDN jsDelivr par défaut du
 * package : condition du scan hors ligne (PWA offline-first) et de la CSP
 * `connect-src 'self'` (next.config.ts). Idempotent, sans effet si déjà
 * appelé (plusieurs montages du scanner dans une même session).
 */
export function ensureZXingModulePrepared(): void {
  if (prepared) return;
  prepared = true;
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? "/zxing_reader.wasm" : prefix + path,
    },
  });
}
