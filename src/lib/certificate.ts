/**
 * Official certificate generator — bilingual A4 landscape PDF under the
 * Center's mark, with a QR that resolves to the PUBLIC verification page
 * (/verify/[partnerId]). The scan is the power move: the network becomes a
 * verification authority.
 */

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

const TEAL_950 = '#07272D';
const TEAL_700 = '#124E57';
const GOLD = '#B08A3E';
const GOLD_L = '#D5B672';
const SAND = '#F4F1EA';
const MUTED = '#6E7A78';

const TIER_TITLES: Record<string, { en: string; ar: string }> = {
  ACTIVE: { en: 'Active Member', ar: 'عضو نشط' },
  CERTIFIED: { en: 'Certified Partner', ar: 'شريك معتمد' },
  ELITE: { en: 'Elite Partner', ar: 'شريك نخبة' },
  REGISTERED: { en: 'Registered Member', ar: 'عضو مسجّل' },
};

function logoBuffer(name: string): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'public', name));
  } catch {
    return null;
  }
}

/**
 * Arabic-capable fonts, vendored in public/fonts (Noto Naskh Arabic, OFL).
 * pdfkit's built-in Helvetica has NO Arabic glyphs — without these the
 * Arabic lines are skipped rather than rendered as garbage.
 */
function fontPath(name: string): string | null {
  const p = path.join(process.cwd(), 'public', 'fonts', name);
  return fs.existsSync(p) ? p : null;
}

export interface CertificateInput {
  partnerId: string;
  registryNo: string;
  nameEn: string;
  nameAr: string | null;
  tier: string;
  region: string;
  foundingMember: boolean;
  issuedAt: Date;
  baseUrl: string;
}

export async function generateCertificate(input: CertificateInput): Promise<Buffer> {
  const verifyUrl = `${input.baseUrl}/verify/${input.partnerId}`;
  const qrPng = await QRCode.toBuffer(verifyUrl, {
    width: 220,
    margin: 1,
    color: { dark: TEAL_700, light: '#FFFFFF' },
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width; // 841.89
    const H = doc.page.height; // 595.28

    const naskh = fontPath('NotoNaskhArabic-400.woff');
    const naskhBold = fontPath('NotoNaskhArabic-700.woff');
    if (naskh) doc.registerFont('Naskh', naskh);
    if (naskhBold) doc.registerFont('NaskhBold', naskhBold);
    // NOTE: keep Arabic runs pure-Arabic (no '·', no Latin) — mixed runs
    // break RTL layout and the middle dot is missing from Naskh.
    const AR = { features: ['rtla' as const] };

    // Canvas
    doc.rect(0, 0, W, H).fill('#FFFFFF');
    // Border frame — double rule, gold inside teal
    doc.lineWidth(3).strokeColor(TEAL_950).rect(24, 24, W - 48, H - 48).stroke();
    doc.lineWidth(1.2).strokeColor(GOLD).rect(34, 34, W - 68, H - 68).stroke();

    // Header band
    doc.rect(35, 35, W - 70, 110).fill(TEAL_950);
    const logo = logoBuffer('upn-logo-white.png');
    if (logo) doc.image(logo, W / 2 - 110, 55, { width: 220 });

    // Title
    const tier = TIER_TITLES[input.tier] ?? TIER_TITLES.REGISTERED;
    doc.fillColor(GOLD).font('Helvetica').fontSize(12).text('THE NATIONAL CENTER FOR PALMS AND DATES HEREBY RECOGNIZES', 0, 175, {
      width: W, align: 'center', characterSpacing: 2,
    });

    doc.fillColor(TEAL_950).font('Helvetica-Bold').fontSize(34).text(input.nameEn, 0, 205, { width: W, align: 'center' });
    if (input.nameAr && naskh) {
      doc.fillColor(TEAL_700).font('Naskh').fontSize(18).text(input.nameAr, 0, 248, { width: W, align: 'center', ...AR });
    }

    doc.fillColor(MUTED).font('Helvetica').fontSize(12).text(`Registry No. ${input.registryNo} · Region: ${input.region}${input.foundingMember ? ' · Founding Member' : ''}`, 0, 285, {
      width: W, align: 'center',
    });

    // Tier ribbon — English + Arabic as separate runs (never mixed)
    const ribbonW = 360;
    doc.roundedRect(W / 2 - ribbonW / 2, 320, ribbonW, 70, 10).fill(input.tier === 'ELITE' ? GOLD : TEAL_700);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(21).text(tier.en, W / 2 - ribbonW / 2, 330, {
      width: ribbonW, align: 'center',
    });
    if (naskhBold) {
      doc.fillColor('#FFFFFF').font('NaskhBold').fontSize(14).text(tier.ar, W / 2 - ribbonW / 2, 356, {
        width: ribbonW, align: 'center', ...AR,
      });
    }

    doc.fillColor(MUTED).font('Helvetica').fontSize(11).text(
      'as a partner in good standing of the UAE Palm Network, in recognition of verified quarterly reporting\nand contribution to the Emirates’ agricultural goals and food-security map.',
      0, 405, { width: W, align: 'center', lineGap: 3 },
    );

    // Footer row: date + signature line + annual seal + QR
    const footY = H - 140;
    const year = input.issuedAt.getUTCFullYear();
    doc.fillColor(TEAL_950).font('Helvetica').fontSize(11)
      .text(`Issued: ${input.issuedAt.toISOString().slice(0, 10)}`, 90, footY + 32);
    doc.fillColor(MUTED).font('Helvetica').fontSize(9)
      .text(`Valid through 31 Dec ${year} — renewed by quarterly reporting`, 90, footY + 48);
    doc.moveTo(90, footY + 80).lineTo(300, footY + 80).lineWidth(1).strokeColor(MUTED).stroke();
    doc.fillColor(MUTED).fontSize(9).text('UAE Palm Network — Authorized Signatory', 90, footY + 86);

    doc.image(qrPng, W - 188, footY - 8, { width: 90 });
    doc.fillColor(MUTED).fontSize(8.5).text('Verify this certificate:', W - 205, footY + 88, { width: 125, align: 'center' });
    doc.fillColor(TEAL_700).fontSize(8).text(
      new URL(input.baseUrl).host,
      W - 205, footY + 99, { width: 125, align: 'center' },
    );

    // Annual seal — the year stamp that makes each certificate credibly current
    const sx = W / 2, sy = footY + 52, sr = 36;
    doc.circle(sx, sy, sr).fill(SAND);
    doc.lineWidth(2).strokeColor(GOLD).circle(sx, sy, sr).stroke();
    doc.lineWidth(0.8).strokeColor(GOLD_L).circle(sx, sy, sr - 5).stroke();
    doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(19)
      .text(String(year), sx - sr, sy - 16, { width: sr * 2, align: 'center' });
    doc.fillColor(MUTED).font('Helvetica').fontSize(6)
      .text('ANNUAL SEAL', sx - sr - 10, sy + 6, { width: sr * 2 + 20, align: 'center', characterSpacing: 0.8 });
    if (naskh) {
      doc.fillColor(MUTED).font('Naskh').fontSize(6.5)
        .text('الختم السنوي', sx - sr - 10, sy + 14, { width: sr * 2 + 20, align: 'center', ...AR });
    }

    doc.end();
  });
}
