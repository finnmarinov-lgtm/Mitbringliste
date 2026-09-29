// Erzeugt die App-Icons (PNG) aus icon.svg und das Vorschaubild vorschau.png aus grafik/vorschau.html,
// mit Chrome oder Edge ohne Fenster. Aufruf: node make-icons.js
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!BROWSER) throw new Error('Chrome oder Edge nicht gefunden');

const quelle = readFileSync(new URL('./icon.svg', import.meta.url), 'utf8');
const ordner = mkdtempSync(join(tmpdir(), 'mb-icons-'));

// eckig: volle Fläche (für iPhone und "maskable"), rand: Motiv verkleinert in die sichere Zone
function bild(datei, groesse, { eckig = false, rand = 1 } = {}) {
  let svg = quelle;
  if (eckig) svg = svg.replace('rx="112"', 'rx="0"');
  if (rand !== 1) {
    const v = (1 - rand) * 256;
    svg = svg.replace('<g id="bild">', `<g id="bild" transform="translate(${v} ${v}) scale(${rand})">`);
  }
  const html = join(ordner, datei + '.html');
  writeFileSync(html, `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block;width:${groesse}px;height:${groesse}px}</style></head><body>${svg}</body></html>`);
  execFileSync(BROWSER, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
    `--window-size=${groesse},${groesse}`, `--screenshot=${join(process.cwd(), datei)}`, pathToFileURL(html).href], { stdio: 'ignore' });
  console.log('geschrieben:', datei);
}

bild('icon-192.png', 192);
bild('icon-512.png', 512);
bild('icon-180.png', 180, { eckig: true });
bild('icon-maskable-512.png', 512, { eckig: true, rand: 0.8 });
rmSync(ordner, { recursive: true, force: true });

// Vorschaubild beim Teilen des Links (1200 × 630); Schriften aus dem Netz, deshalb etwas Zeit lassen
execFileSync(BROWSER, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1200,630',
  '--virtual-time-budget=8000', '--allow-file-access-from-files', `--screenshot=${join(process.cwd(), 'vorschau.png')}`,
  new URL('./grafik/vorschau.html', import.meta.url).href], { stdio: 'ignore' });
// Als JPG speichern (kleiner, damit WhatsApp & Co. die Vorschau sicher anzeigen); nutzt .NET über PowerShell
const png = join(process.cwd(), 'vorschau.png'), jpg = join(process.cwd(), 'vorschau.jpg');
execFileSync('powershell', ['-NoProfile', '-Command', `Add-Type -AssemblyName System.Drawing;
  $img = [System.Drawing.Image]::FromFile('${png}');
  $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' };
  $par = New-Object System.Drawing.Imaging.EncoderParameters 1;
  $par.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 88L;
  $img.Save('${jpg}', $enc, $par); $img.Dispose()`], { stdio: 'inherit' });
rmSync(png);
console.log('geschrieben: vorschau.jpg');
