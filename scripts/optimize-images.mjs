// Prepares brand assets and responsive photos from the untouched originals in images/.
// Run with: node scripts/optimize-images.mjs            (everything)
//           node scripts/optimize-images.mjs --icons    (favicon and app icons only)
// Outputs: Public/brand/* (logos, icons, OG image) and Public/images/site/* (WebP + JPG per width),
// plus src/data/siteImages.ts (the manifest <ResponsiveImage> reads).
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'images');
const BRAND_OUT = path.join(ROOT, 'Public', 'brand');
const PHOTO_OUT = path.join(ROOT, 'Public', 'images', 'site');
const MANIFEST_OUT = path.join(ROOT, 'src', 'data', 'siteImages.ts');

const STEP_WIDTHS = [640, 1024, 1600, 2400];
// Every card/tile photo is cropped to this exact square so rows line up at the same height.
// 340 px is the largest square every card source can fill without upscaling.
const CARD_SIZE = 340;
// Larger square variants for retina screens, emitted only when the source is big enough.
const CARD_STEP_SIZES = [640, 1024, 1400];

fs.mkdirSync(BRAND_OUT, { recursive: true });
fs.mkdirSync(PHOTO_OUT, { recursive: true });

// ---------------------------------------------------------------------------------------------
// Logo: the supplied original (images/nov.png) is already a transparent PNG.
// ---------------------------------------------------------------------------------------------
const LOGO_SRC = path.join(SRC, 'nov.png');

// How strongly a pixel reads as the logo's red (0 = neutral grey/black/white).
const redness = (r, g, b) => r - Math.max(g, b);
const RED_MIN = 60;

// Reversed logo for dark surfaces: every non-red pixel becomes white; red stays red. The soft
// dark drop shadow is faded out (low-alpha dark pixels) so it doesn't turn into a white halo;
// the letters themselves sit at alpha 240+ and become solid white.
const SHADOW_ALPHA = 96;
const SOLID_ALPHA = 224;
async function toWhiteVersion(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (redness(data[i], data[i + 1], data[i + 2]) < RED_MIN) {
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
      const a = data[i + 3];
      data[i + 3] = a <= SHADOW_ALPHA ? 0 : a >= SOLID_ALPHA ? 255 : Math.round(255 * (a - SHADOW_ALPHA) / (SOLID_ALPHA - SHADOW_ALPHA));
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// Keeps only the red parts of an image (the globe, arrow and parcel of the mark).
async function redOnly(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const red = redness(data[i], data[i + 1], data[i + 2]);
    if (red < RED_MIN) data[i + 3] = 0;
    else if (red < RED_MIN + 40) data[i + 3] = Math.round(data[i + 3] * (red - RED_MIN) / 40); // soft edge
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// Icon mark: the globe in the "V" with its red orbit arrow, without the black letterforms
// around it, centred on a transparent square. Measured on the 2024x777 original: everything
// inside the globe's circle is kept, outside it only the red orbit arrow (above y 395, so the
// red of the letters below is left out).
async function buildSquareMark(transparent) {
  const MARK = { left: 960, top: 160, width: 410, height: 285 };
  const GLOBE = { x: 1148 - MARK.left, y: 300 - MARK.top, r: 130 };
  const { data, info } = await sharp(transparent).extract(MARK).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const red = await sharp(await redOnly(await sharp(data, { raw: info }).png().toBuffer())).raw().toBuffer();
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const dx = (p % info.width) - GLOBE.x, dy = Math.floor(p / info.width) - GLOBE.y;
    if (dx * dx + dy * dy > GLOBE.r * GLOBE.r) data[i + 3] = dy + GLOBE.y + MARK.top < 395 ? red[i + 3] : 0;
  }
  const markPng = await sharp(data, { raw: info }).png().toBuffer();
  const mark = await sharp(markPng).trim({ threshold: 1 }).png().toBuffer();
  const markMeta = await sharp(mark).metadata();
  const side = Math.max(markMeta.width, markMeta.height);
  return sharp(mark)
    .extend({
      top: Math.floor((side - markMeta.height) / 2), bottom: Math.ceil((side - markMeta.height) / 2),
      left: Math.floor((side - markMeta.width) / 2), right: Math.ceil((side - markMeta.width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png().toBuffer();
}

// Browser, home-screen and PWA icons, all rendered straight from the square mark at their exact
// size (never resized from another icon). `inset` is the share of the canvas the mark may fill.
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const ICONS = [
  // Tab icons sit on a white rounded tile so the red mark stays visible on dark browser tabs.
  { file: 'favicon-16.png', size: 16, inset: 1, bg: '#ffffff', tile: true },  // browser tab (standard DPI)
  { file: 'favicon-32.png', size: 32, inset: 0.94, bg: '#ffffff', tile: true }, // browser tab (retina), taskbar
  { file: 'icon-192.png', size: 192, inset: 0.92, bg: CLEAR },        // Android home screen, manifest
  { file: 'favicon.png', size: 512, inset: 0.92, bg: CLEAR },         // manifest, install splash
  { file: 'icon-maskable-512.png', size: 512, inset: 0.64, bg: '#ffffff' }, // Android adaptive: fits the 80% safe circle
  { file: 'apple-touch-icon.png', size: 180, inset: 0.76, bg: '#ffffff' },  // iOS fills transparency with black, so white
];

async function buildIcons(squareMark) {
  for (const { file, size, inset, bg, tile } of ICONS) {
    const inner = Math.round(size * inset);
    const edge = size - inner;
    let icon = sharp(squareMark)
      .resize(inner, inner, { fit: 'contain', background: CLEAR, kernel: 'lanczos3' })
      .extend({ top: Math.floor(edge / 2), bottom: Math.ceil(edge / 2), left: Math.floor(edge / 2), right: Math.ceil(edge / 2), background: CLEAR });
    if (tile) {
      const r = Math.round(size * 0.22);
      const card = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="${bg}"/></svg>`);
      icon = sharp(card).composite([{ input: await icon.png().toBuffer() }]);
    } else if (bg !== CLEAR) {
      icon = sharp(await icon.png().toBuffer()).flatten({ background: bg });
    }
    // Full-colour PNG for the tiny sizes: palette quantising visibly bands 16/32 px edges.
    const png = size <= 32 ? { compressionLevel: 9 } : { palette: true, quality: 95, effort: 10, compressionLevel: 9 };
    await icon.png(png).toFile(path.join(BRAND_OUT, file));
  }
}

async function buildBrand() {
  const transparent = await sharp(LOGO_SRC).ensureAlpha().png().toBuffer();
  // Trim at a higher threshold so the faint outer shadow doesn't pad the logo box.
  const trimmed = await sharp(transparent).trim({ threshold: 10 }).png().toBuffer();
  // The white version is trimmed again: dropping the shadow leaves a transparent margin.
  const white = await sharp(await toWhiteVersion(trimmed)).trim({ threshold: 1 }).png().toBuffer();
  // A 2024 px original is far more than any header needs; 1200 px keeps retina sharpness.
  const LOGO_W = 1200;
  await sharp(trimmed).resize(LOGO_W).png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toFile(path.join(BRAND_OUT, 'ngt-logo.png'));
  await sharp(white).resize(LOGO_W).png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toFile(path.join(BRAND_OUT, 'ngt-logo-white.png'));
  // Header/drawer version without the "FASTER • SAFER • FURTHER" line, which is ~3 px tall at
  // header size. Row 440 of the trimmed 1979x492 logo sits in the empty band (427-460) between
  // "GLOBAL TRANSPORT" and the tagline.
  const TAGLINE_TOP = 440;
  const trimmedMeta = await sharp(trimmed).metadata();
  const noTagline = await sharp(trimmed).extract({ left: 0, top: 0, width: trimmedMeta.width, height: TAGLINE_TOP }).png().toBuffer();
  await sharp(await sharp(noTagline).trim({ threshold: 1 }).png().toBuffer()).resize(LOGO_W)
    .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toFile(path.join(BRAND_OUT, 'ngt-logo-header.png'));

  const squareMark = await buildSquareMark(transparent);
  await sharp(squareMark).png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toFile(path.join(BRAND_OUT, 'ngt-mark.png'));
  await buildIcons(squareMark);

  // OG image 1200x630: the home hero photo under a dark Ink scrim (0.82, so the logo reads clearly
  // over the cranes) with the white logo centred.
  const logoForOg = await sharp(white).resize(820).png().toBuffer();
  const scrim = Buffer.from('<svg width="1200" height="630"><rect width="1200" height="630" fill="#181818" fill-opacity="0.82"/></svg>');
  await sharp(path.join(SRC, 'unsplash/hero-home.jpg')).resize(1200, 630, { fit: 'cover', position: 'centre' })
    .composite([{ input: scrim }, { input: logoForOg, gravity: 'centre' }])
    .jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(BRAND_OUT, 'og-image.jpg'));
}

// ---------------------------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------------------------
// kind 'card' = fixed CARD_SIZE square (plus 640 when the source allows it).
// kind 'hero' = keeps the given aspect ratio, widths from STEP_WIDTHS up to the source width.
const PHOTOS = [
  { name: 'hero-home', src: 'unsplash/hero-home.jpg', kind: 'hero', aspect: 16 / 9 },
  { name: 'hero-home-mobile', src: 'unsplash/hero-home.jpg', kind: 'hero', aspect: 9 / 16 },
  { name: 'track-hero', src: 'unsplash/track-hero.jpg', kind: 'hero', aspect: 2 / 1 },
  { name: 'locations-hero', src: 'unsplash/locations-hero.jpg', kind: 'hero', aspect: 2 / 1 },
  // Wide strip behind the Home callback banner.
  { name: 'callback-banner', src: 'unsplash/callback-banner.jpg', kind: 'hero', aspect: 3 / 1 },
  { name: 'services-hero', src: 'unsplash/services-hero.jpg', kind: 'hero', aspect: 12 / 5 },
  { name: 'about-hero', src: 'free-pexels/about-hero.jpg', kind: 'hero', aspect: 12 / 5 },
  { name: 'service-priority-express', src: 'free-pexels/service-priority-express.jpg', kind: 'card' },
  { name: 'service-freight-linehaul', src: 'unsplash/service-freight-linehaul.jpg', kind: 'card' },
  { name: 'service-vehicle-transport', src: 'free-pexels/service-vehicle-transport.jpg', kind: 'card' },
  { name: 'service-secure-vault', src: 'free-pexels/service-secure-vault.jpg', kind: 'card' },
  { name: 'industry-healthcare', src: 'free-pexels/industry-healthcare.jpg', kind: 'card' },
  { name: 'industry-technology', src: 'free-pexels/industry-technology.jpg', kind: 'card' },
  { name: 'industry-automotive', src: 'free-pexels/industry-automotive.jpg', kind: 'card' },
  { name: 'industry-ecommerce', src: 'unsplash/industry-ecommerce.jpg', kind: 'card' },
  { name: 'track-result-vehicle', src: 'free-pexels/service-priority-express.jpg', kind: 'card' },
  { name: 'about-operations', src: 'free-pexels/about-operations.jpg', kind: 'card' },
  { name: 'contact-team', src: 'free-pexels/about-team.jpg', kind: 'card' },
  // Shown as a 72 px thumbnail: crop tight on the face.
  { name: 'about-team', src: 'free-pexels/about-team.jpg', kind: 'card', crop: { left: 950, top: 80, width: 900, height: 900 } },
];

// `position` picks which part of the source a cover crop keeps (sharp: 'centre', 'top', 'bottom', ...).
async function writeVariants(pipelineFactory, name, width, height, position = 'centre') {
  const base = path.join(PHOTO_OUT, `${name}-${width}`);
  await pipelineFactory().resize(width, height, { fit: 'cover', position }).webp({ quality: 78 }).toFile(`${base}.webp`);
  await pipelineFactory().resize(width, height, { fit: 'cover', position }).flatten({ background: '#ffffff' })
    .jpeg({ quality: 80, mozjpeg: true, progressive: true }).toFile(`${base}.jpg`);
}

async function buildPhotos() {
  const manifest = {};
  for (const p of PHOTOS) {
    const srcPath = path.join(SRC, p.src);
    const factory = () => (p.crop ? sharp(srcPath).extract(p.crop) : sharp(srcPath));
    const meta = await factory().metadata();
    const srcW = p.crop ? p.crop.width : meta.width;
    const srcH = p.crop ? p.crop.height : meta.height;
    const variants = [];

    if (p.kind === 'card') {
      const maxSquare = Math.min(srcW, srcH);
      // Never upscale: a source smaller than CARD_SIZE is output at its own size. Every card is
      // still a 1:1 square, so CSS renders them all at the same height.
      const base = Math.min(CARD_SIZE, maxSquare);
      const sizes = [base, ...CARD_STEP_SIZES.filter(s => s <= maxSquare)];
      for (const s of sizes) {
        await writeVariants(factory, p.name, s, s);
        variants.push(s);
      }
      manifest[p.name] = { width: base, height: base, widths: variants };
    } else {
      // Largest crop of the requested aspect that fits the source, then the step widths below it.
      const cropW = Math.min(srcW, Math.floor(srcH * p.aspect));
      const cropH = Math.round(cropW / p.aspect);
      const widths = STEP_WIDTHS.filter(w => w <= cropW);
      if (!widths.includes(cropW) && (widths.length === 0 || cropW - widths[widths.length - 1] > 200)) widths.push(cropW);
      for (const w of widths) {
        await writeVariants(factory, p.name, w, Math.round(w / p.aspect), p.position);
        variants.push(w);
      }
      manifest[p.name] = { width: cropW, height: cropH, widths: variants };
    }
  }
  return manifest;
}

function writeManifest(manifest) {
  const body = Object.entries(manifest)
    .map(([k, v]) => `  '${k}': { width: ${v.width}, height: ${v.height}, widths: [${v.widths.join(', ')}] },`)
    .join('\n');
  const ts = `// Generated by scripts/optimize-images.mjs. Do not edit by hand; re-run the script instead.
// Each entry lists the widths available as /images/site/<name>-<width>.webp and .jpg.
export interface SiteImageInfo {
  width: number;
  height: number;
  widths: number[];
}

export const SITE_IMAGES = {
${body}
} satisfies Record<string, SiteImageInfo>;

export type SiteImageName = keyof typeof SITE_IMAGES;
`;
  fs.writeFileSync(MANIFEST_OUT, ts);
}

// --icons rebuilds only the icon set, leaving the logos, OG image and photos untouched.
if (process.argv.includes('--icons')) {
  await buildIcons(await buildSquareMark(await sharp(LOGO_SRC).ensureAlpha().png().toBuffer()));
  console.log('Icons done.');
} else {
  await buildBrand();
  const manifest = await buildPhotos();
  writeManifest(manifest);
  console.log('Done.');
}
