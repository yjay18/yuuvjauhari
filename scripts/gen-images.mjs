// Generates public/og.png (social card) and public/apple-touch-icon.png.
// Run once with: node scripts/gen-images.mjs
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");

const serif = "Georgia, 'Times New Roman', serif";
const sans = "Helvetica, Arial, sans-serif";
const mono = "'DejaVu Sans Mono', 'Courier New', monospace";

const chip = (x, y, w, label) => `
  <rect x="${x}" y="${y}" width="${w}" height="46" rx="23" fill="#ffffff" stroke="#c9cebb"/>
  <circle cx="${x + 22}" cy="${y + 23}" r="3.5" fill="#c78662"/>
  <text x="${x + 36}" y="${y + 30}" font-family="${mono}" font-size="19" fill="#4a5c45">${label}</text>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f0f2e9"/>
      <stop offset="0.4" stop-color="#eef0e6"/>
      <stop offset="1" stop-color="#ebeee3"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1120" cy="60" r="440" fill="#2f5d5c" opacity="0.06"/>
  <circle cx="60" cy="600" r="380" fill="#a8623f" opacity="0.06"/>
  <rect x="0" y="0" width="1200" height="6" fill="#2f4a3a"/>

  <!-- Left column -->
  <text x="80" y="126" font-family="${mono}" font-size="21" letter-spacing="3" fill="#8b4c2e">SOFTWARE ENGINEER  ·  DATA SCIENTIST</text>
  <text x="76" y="214" font-family="${serif}" font-size="78" font-weight="700" fill="#26352a">Yuuv Jauhari</text>
  <text x="80" y="288" font-family="${serif}" font-size="35" fill="#4a5c45">Research-grade evaluation,</text>
  <text x="80" y="336" font-family="${serif}" font-size="35" fill="#4a5c45">shipped as <tspan font-style="italic" fill="#a8623f">usable</tspan> products.</text>

  ${chip(80, 404, 256, "Quantexa · NLP DS")}
  ${chip(348, 404, 168, "COLM 2025")}
  ${chip(528, 404, 196, "AUROC 0.945")}
  ${chip(736, 404, 214, "94k+ ICU stays")}

  <text x="80" y="556" font-family="${mono}" font-size="18" fill="#6b7a64">Dublin, Ireland   ·   Trinity College Dublin (MSc, Distinction)   ·   github.com/yjay18</text>

  <!-- Right artifact card -->
  <rect x="742" y="160" width="384" height="300" rx="24" fill="#26352a" opacity="0.12"/>
  <rect x="738" y="152" width="384" height="300" rx="24" fill="#ffffff" stroke="#d4d8c7"/>
  <text x="766" y="196" font-family="${mono}" font-size="15" letter-spacing="1" fill="#6b7a64">ICU HYPOTENSION EWS · EVALUATION</text>

  <rect x="766" y="212" width="328" height="150" rx="12" fill="#f4f6ee" stroke="#d4d8c7"/>
  <line x1="778" y1="350" x2="1082" y2="224" stroke="#b9bfa9" stroke-width="1" stroke-dasharray="3 4"/>
  <path d="M778,350 C792,300 802,256 822,240 C846,221 888,219 940,218 C1000,217 1050,216 1082,216 L1082,350 Z" fill="#2f5d5c" opacity="0.12"/>
  <path d="M778,350 C792,300 802,256 822,240 C846,221 888,219 940,218 C1000,217 1050,216 1082,216" fill="none" stroke="#2f5d5c" stroke-width="3"/>
  <circle cx="808" cy="234" r="5.5" fill="#a8623f" stroke="#ffffff" stroke-width="2"/>

  <text x="766" y="406" font-family="${serif}" font-size="38" font-weight="700" fill="#26352a">AUROC 0.945</text>
  <text x="766" y="434" font-family="${mono}" font-size="16" fill="#6b7a64">93.75% recall @ 10% alarm · 94,259 stays</text>

  <!-- COLM badge -->
  <rect x="946" y="128" width="176" height="56" rx="14" fill="#2f4a3a"/>
  <text x="968" y="154" font-family="${sans}" font-size="19" font-weight="700" fill="#f6f7f0">COLM 2025</text>
  <text x="968" y="173" font-family="${mono}" font-size="13" fill="#cdd6c8">Accepted paper</text>
</svg>`;

await writeFile(join(pub, "og.svg"), og);
await sharp(Buffer.from(og)).png().toFile(join(pub, "og.png"));

const favicon = await readFile(join(pub, "favicon.svg"));
await sharp(favicon).resize(180, 180).png().toFile(join(pub, "apple-touch-icon.png"));

console.log("Generated og.png and apple-touch-icon.png");
