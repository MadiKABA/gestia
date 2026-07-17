// Copie le binaire WASM de zxing-wasm (dépendance transitive de
// barcode-detector, cf. presentation/product/barcode/zxing-setup.ts) dans
// public/ — servi ensuite comme un fichier statique ordinaire par Next.js,
// depuis notre propre origine (jamais le CDN jsDelivr par défaut du
// package) : condition du scan hors ligne (PWA) et de la CSP
// `connect-src 'self'` (next.config.ts).
//
// Un require.resolve direct depuis un Route Handler échoue au build
// Turbopack (tente de bundler un .wasm comme un module JS) — copier le
// fichier une fois à l'installation, en dehors du bundle applicatif, évite
// complètement le problème. pnpm n'hoiste pas zxing-wasm à la racine
// (dépendance transitive de barcode-detector, pas une dépendance directe) :
// on résout donc un `require` scopé au module barcode-detector lui-même,
// seul capable de voir sa propre dépendance.
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const barcodeDetectorEntry = require.resolve("barcode-detector");
const requireFromBarcodeDetector = createRequire(barcodeDetectorEntry);
const wasmSource = requireFromBarcodeDetector.resolve("zxing-wasm/reader/zxing_reader.wasm");

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const destination = join(projectRoot, "public", "zxing_reader.wasm");

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(wasmSource, destination);

console.warn(`zxing_reader.wasm copié vers ${destination}`);
