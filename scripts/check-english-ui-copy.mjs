import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const roots = ["apps/hq/src", "packages/ui/src", "services/api/src", "services/api/deploy"];
const standaloneFiles = ["apps/hq/index.html"];
const supportedExtensions = new Set([".html", ".js", ".svelte", ".ts"]);

// High-signal French UI terms. Keep this list focused on interface copy so brand
// names and domain identifiers remain valid while visible language drift fails CI.
const forbiddenTerms = [
  "à payer",
  "à traiter",
  "activées",
  "ajouter",
  "annuler",
  "aperçu",
  "aucun",
  "aucune",
  "ayants droit",
  "banque",
  "bienvenue",
  "catégorie",
  "chargement",
  "charger plus",
  "clés de jointure",
  "compte bancaire",
  "confirmer",
  "connexion",
  "contrôle",
  "créer",
  "département",
  "déplacer",
  "dépense",
  "dépenses",
  "désactiver",
  "détection",
  "devise",
  "doublon",
  "doublons",
  "échoué",
  "écriture",
  "écritures",
  "élément",
  "éléments",
  "enregistrer",
  "erreur",
  "exécuter",
  "fermer",
  "fichier",
  "ignorer",
  "indisponible",
  "journal d'audit",
  "lecture seule",
  "libellé",
  "ligne",
  "lignes",
  "mettre à jour",
  "modifier",
  "mot de passe",
  "montant",
  "nouveau",
  "nouvelle",
  "opération réussie",
  "paiement",
  "paiements",
  "paramètres",
  "période",
  "précédent",
  "préparation",
  "projet",
  "rapprochement",
  "rechercher",
  "recherche",
  "réessayer",
  "référence",
  "refuser",
  "réinitialiser",
  "relevé",
  "résolu",
  "résultat",
  "revenus",
  "saisissez",
  "sélection",
  "sélectionnez",
  "solde",
  "statut",
  "suivant",
  "supprimer",
  "tableau de bord",
  "terminé",
  "toutes",
  "tous",
  "télécharger",
  "trésorerie",
  "utilisateur",
  "valider"
];

const patterns = forbiddenTerms.map((term) => ({
  term,
  pattern: new RegExp(
    `(?<![\\p{L}\\p{N}_])${escapeRegExp(term)}(?![\\p{L}\\p{N}_])`,
    "iu"
  )
}));

const files = [];
for (const root of roots) {
  await collectSourceFiles(root, files);
}
files.push(...standaloneFiles);

const hits = [];
for (const file of files) {
  const lines = (await readFile(file, "utf8")).split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const searchableLine = normalizeLineForScan(file, line);
    for (const { term, pattern } of patterns) {
      if (pattern.test(searchableLine)) {
        hits.push(`${relative(process.cwd(), file)}:${String(index + 1)} [${term}] ${line.trim()}`);
        break;
      }
    }
  }
}

if (hits.length > 0) {
  console.error(`English UI copy check failed: ${String(hits.length)} French marker(s) found.`);
  for (const hit of hits.slice(0, 80)) {
    console.error(hit);
  }
  if (hits.length > 80) {
    console.error(`... ${String(hits.length - 80)} more hit(s)`);
  }
  process.exit(1);
}

console.log("PASS English-only UI copy guard");

async function collectSourceFiles(directory, output) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectSourceFiles(path, output);
    } else if (entry.isFile() && supportedExtensions.has(extname(entry.name))) {
      output.push(path);
    }
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function normalizeLineForScan(file, line) {
  const decodedLine = line
    .replace(/\\x([0-9a-f]{2})/giu, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/\\u([0-9a-f]{4})/giu, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)));

  // Bank import remains backward-compatible with legacy French CSV headers; this
  // exact parser alias is input data, not rendered interface copy. Remove only
  // that literal so another French marker on the same bundled line still fails.
  if (file.endsWith("services/api/src/index.ts") || file.endsWith("services/api/deploy/server.bundle.js")) {
    return decodedLine.replace(/(["'])solde\1/giu, '$1legacy-balance-header$1');
  }

  return decodedLine;
}
