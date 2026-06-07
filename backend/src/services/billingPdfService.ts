import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export type ReceiptLayout = 'a4' | 'thermal-58' | 'thermal-80';

interface ReceiptRenderOptions {
  layout?: ReceiptLayout;
}

interface BillingParty {
  firstName?: string;
  lastName?: string;
  email?: string;
  name?: string;
  species?: string;
  breed?: string;
}

interface ClinicLike {
  name?: string;
  legalBusinessName?: string;
  address?: string;
  phone?: string;
  email?: string;
  businessTaxId?: string;
  businessRegistrationNo?: string;
  receiptFooterNote?: string;
  logo?: string | null;
}

interface BranchLike {
  name?: string;
  address?: string;
  city?: string;
  province?: string;
  phone?: string;
  email?: string;
}

interface BillingItemLike {
  name: string;
  quantity?: number;
  unitPrice?: number;
  dispenseFee?: number;
  injectionFee?: number;
}

interface BillingLike {
  invoiceNumber: string;
  issueDateTime?: Date | string;
  dueDate?: Date | string;
  status: 'pending_payment' | 'paid';
  paymentMethod?: 'cash' | 'card' | 'qr' | null;
  paidAt?: Date | string | null;
  subtotal: number;
  discount: number;
  totalAmountDue: number;
  serviceLabel?: string;
  birNumber?: string | null;
  items: BillingItemLike[];
  ownerId?: BillingParty;
  petId?: BillingParty;
  vetId?: BillingParty;
  clinicId?: ClinicLike;
  clinicBranchId?: BranchLike;
}

function toPhp(value: number): string {
  return `PHP ${new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;
}

function toMoney(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function toDateTimeLabel(value?: string | Date | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateLabel(value?: string | Date | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

// Groups PH phone numbers for readability (e.g. "+639688833195" -> "+63 968 883 3195").
function formatPhoneDisplay(value: string | null | undefined): string {
  if (!value) return '-';
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-') return '-';
  const digits = trimmed.replace(/[^\d+]/g, '');
  let match = digits.match(/^\+63(\d{3})(\d{3})(\d{4})$/);
  if (match) return `+63 ${match[1]} ${match[2]} ${match[3]}`;
  match = digits.match(/^0(\d{3})(\d{3})(\d{4})$/);
  if (match) return `0${match[1]} ${match[2]} ${match[3]}`;
  return trimmed;
}

function getPageConfig(layout: ReceiptLayout) {
  if (layout === 'thermal-58') {
    return { size: [164.4, 841.89] as [number, number], margin: 14, thermal: true };
  }
  if (layout === 'thermal-80') {
    return { size: [226.8, 841.89] as [number, number], margin: 14, thermal: true };
  }
  return { size: 'A4' as const, margin: 36, thermal: false };
}

function drawWrapped(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  options: PDFKit.Mixins.TextOptions = {},
): number {
  doc.text(text, x, y, { width, ...options });
  return doc.y;
}

function parseDataUrlImage(dataUrl: string | null | undefined): Buffer | null {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
  const idx = dataUrl.indexOf(',');
  if (idx === -1) return null;
  const base64 = dataUrl.slice(idx + 1);
  try {
    return Buffer.from(base64, 'base64');
  } catch {
    return null;
  }
}

// Fallback brand mark used when a clinic hasn't uploaded its own logo —
// mirrors the static logo shown on the shared diagnostic report page.
let cachedFallbackLogo: Buffer | null | undefined;
function getFallbackLogoBuffer(): Buffer | null {
  if (cachedFallbackLogo !== undefined) return cachedFallbackLogo;
  const candidates = [
    path.join(__dirname, '../assets/baivet-logo.jpg'),
    path.join(__dirname, '../../src/assets/baivet-logo.jpg'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  try {
    cachedFallbackLogo = found ? fs.readFileSync(found) : null;
  } catch {
    cachedFallbackLogo = null;
  }
  return cachedFallbackLogo;
}

// Palette mirrors the veterinary diagnostic report (frontend/app/reports/[id]/page.tsx)
// so receipts and reports share one visual identity.
const PALETTE = {
  teal: '#476B6B',
  tealAccent: '#5A7C7A',
  cream: '#F8F6F2',
  text: '#4F4F4F',
  subtext: '#6B7280',
  lightTeal: '#F0F7F7',
  border: '#E5E7EB',
  white: '#FFFFFF',
};

const STAT_CARD_PADDING = { x: 10, top: 8, bottom: 8, gap: 3 };
const STAT_CARD_MIN_HEIGHT = 34;

// Measures the height a stat card needs so its (possibly wrapped) value never overflows.
function measureStatCardHeight(doc: PDFKit.PDFDocument, width: number, label: string, value: string): number {
  const innerWidth = width - STAT_CARD_PADDING.x * 2;
  doc.font('Helvetica').fontSize(7);
  const labelHeight = doc.heightOfString(label.toUpperCase(), { width: innerWidth });
  doc.font('Helvetica-Bold').fontSize(9.5);
  const valueHeight = doc.heightOfString(value, { width: innerWidth });
  return Math.max(
    STAT_CARD_MIN_HEIGHT,
    STAT_CARD_PADDING.top + labelHeight + STAT_CARD_PADDING.gap + valueHeight + STAT_CARD_PADDING.bottom,
  );
}

function drawStatCard(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
): void {
  const innerWidth = width - STAT_CARD_PADDING.x * 2;
  doc.roundedRect(x, y, width, height, 6).fillColor(PALETTE.cream).fill();
  doc.fillColor(PALETTE.subtext).font('Helvetica').fontSize(7);
  const labelHeight = doc.heightOfString(label.toUpperCase(), { width: innerWidth });
  doc.text(label.toUpperCase(), x + STAT_CARD_PADDING.x, y + STAT_CARD_PADDING.top, { width: innerWidth });
  doc.fillColor(PALETTE.text).font('Helvetica-Bold').fontSize(9.5);
  doc.text(value, x + STAT_CARD_PADDING.x, y + STAT_CARD_PADDING.top + labelHeight + STAT_CARD_PADDING.gap, { width: innerWidth });
  doc.fillColor('#000000');
}

export async function generateBillingReceiptPdf(
  billing: BillingLike,
  options: ReceiptRenderOptions = {},
): Promise<Buffer> {
  const layout = options.layout ?? 'a4';
  const page = getPageConfig(layout);

  const doc = new PDFDocument({
    size: page.size,
    margin: page.margin,
    bufferPages: true,
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const contentWidth = right - left;

  const clinic = (billing.clinicId ?? {}) as ClinicLike;
  const branch = (billing.clinicBranchId ?? {}) as BranchLike;
  const owner = (billing.ownerId ?? {}) as BillingParty;
  const pet = (billing.petId ?? {}) as BillingParty;
  const vet = (billing.vetId ?? {}) as BillingParty;

  // Branch-level address/contact with fallback to clinic-level
  const branchAddressParts = [branch.address, branch.city, branch.province].filter(Boolean);
  const displayAddress = branchAddressParts.length > 0 ? branchAddressParts.join(', ') : (clinic.address || '-');
  const displayPhone = branch.phone || clinic.phone || '-';
  const displayEmail = branch.email || clinic.email || null;
  const legalName = clinic.legalBusinessName || clinic.name || '-';
  const logoBuffer = parseDataUrlImage(clinic.logo || null) || getFallbackLogoBuffer();
  const vetName = vet.firstName ? `Dr. ${vet.firstName} ${vet.lastName || ''}`.trim() : null;

  if (page.thermal) {
    renderThermalReceipt(doc, billing, page, {
      left, right, contentWidth, clinic, branch, owner, pet, vet, vetName,
      displayAddress, displayPhone, displayEmail, legalName, logoBuffer,
    });
  } else {
    renderA4Receipt(doc, billing, page, {
      left, right, contentWidth, clinic, branch, owner, pet, vet, vetName,
      displayAddress, displayPhone, displayEmail, legalName, logoBuffer,
    });
  }

  doc.end();
  return done;
}

interface ReceiptContext {
  left: number;
  right: number;
  contentWidth: number;
  clinic: ClinicLike;
  branch: BranchLike;
  owner: BillingParty;
  pet: BillingParty;
  vet: BillingParty;
  vetName: string | null;
  displayAddress: string;
  displayPhone: string;
  displayEmail: string | null;
  legalName: string;
  logoBuffer: Buffer | null;
}

function renderA4Receipt(
  doc: PDFKit.PDFDocument,
  billing: BillingLike,
  page: ReturnType<typeof getPageConfig>,
  ctx: ReceiptContext,
): void {
  const { left, right, contentWidth, clinic, branch, owner, pet, vet, vetName,
    displayAddress, displayPhone, displayEmail, legalName, logoBuffer } = ctx;

  const metaWidth = 170;
  const metaX = right - metaWidth;
  const headerX = logoBuffer ? left + 60 : left;
  const headerGap = 16;
  const headerWidth = metaX - headerX - headerGap;

  let y = doc.page.margins.top;

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, left, y, { fit: [50, 50] });
    } catch {
      // Ignore invalid image payloads and continue with text layout.
    }
  }

  // Lead with the clinic's full legal/registered name (matches official letterhead style);
  // fall back to the short brand name only when no legal name is on file.
  const clinicShortName = clinic.name || 'Clinic';
  const headerTitle = legalName && legalName !== '-' ? legalName : clinicShortName;

  doc.font('Helvetica-Bold').fontSize(14.5).fillColor(PALETTE.text);
  doc.text(headerTitle, headerX, y, { width: headerWidth });

  doc.font('Helvetica').fontSize(8.5).fillColor(PALETTE.subtext);
  let leftY = doc.y + 3;
  // Branch + address share a single line (e.g. "Branch: Parañaque — Merville, Paranaque, Metro Manila").
  const branchLine = branch.name ? `Branch: ${branch.name}${displayAddress ? ` — ${displayAddress}` : ''}` : displayAddress;
  leftY = drawWrapped(doc, branchLine, headerX, leftY, headerWidth);
  if (displayPhone && displayPhone !== '-') {
    const contactLine = `Tel No.: ${formatPhoneDisplay(displayPhone)}${displayEmail ? `   ·   ${displayEmail}` : ''}`;
    leftY = drawWrapped(doc, contactLine, headerX, leftY + 1, headerWidth);
  } else if (displayEmail) {
    leftY = drawWrapped(doc, displayEmail, headerX, leftY + 1, headerWidth);
  }
  // Only print TIN / registration once the clinic has set them (avoids a bare "TIN: -" placeholder).
  if (clinic.businessTaxId || clinic.businessRegistrationNo) {
    const taxLine = [
      clinic.businessTaxId ? `TIN: ${clinic.businessTaxId}` : null,
      clinic.businessRegistrationNo ? `Reg. No.: ${clinic.businessRegistrationNo}` : null,
    ].filter(Boolean).join('   ·   ');
    leftY = drawWrapped(doc, taxLine, headerX, leftY + 1, headerWidth);
  }

  doc.font('Helvetica-Bold').fontSize(11).fillColor(PALETTE.teal);
  doc.text('SERVICE INVOICE', metaX, doc.page.margins.top, { width: metaWidth, align: 'right' });
  doc.font('Helvetica').fontSize(8.5).fillColor(PALETTE.text);
  doc.text(`No.: ${billing.invoiceNumber}`, metaX, doc.y + 4, { width: metaWidth, align: 'right' });
  doc.fillColor(PALETTE.subtext);
  doc.text(`Date Issued: ${toDateLabel(billing.issueDateTime)}`, metaX, doc.y + 1, { width: metaWidth, align: 'right' });
  if (billing.birNumber) {
    doc.fillColor(PALETTE.text).font('Helvetica-Bold');
    doc.text(`BIR Acknowledgement No.: ${billing.birNumber}`, metaX, doc.y + 3, { width: metaWidth, align: 'right' });
  }
  doc.fillColor('#000000');

  const rightY = doc.y;
  y = Math.max(leftY, rightY) + 12;
  doc.moveTo(left, y).lineTo(right, y).strokeColor(PALETTE.teal).lineWidth(1.4).stroke();
  y += 16;

  // Quick-glance stat cards (mirrors the on-screen receipt detail grid).
  // Heights are measured from the actual (wrapped) text so long values never overlap the next section.
  const cardGap = 10;
  const cardWidth = (contentWidth - cardGap) / 2;

  const issueLabel = 'Issue Date / Time';
  const issueValue = toDateTimeLabel(billing.issueDateTime);
  const dueLabel = 'Due Date';
  const dueValue = toDateLabel(billing.dueDate);
  const row1Height = Math.max(
    measureStatCardHeight(doc, cardWidth, issueLabel, issueValue),
    measureStatCardHeight(doc, cardWidth, dueLabel, dueValue),
  );
  drawStatCard(doc, left, y, cardWidth, row1Height, issueLabel, issueValue);
  drawStatCard(doc, left + cardWidth + cardGap, y, cardWidth, row1Height, dueLabel, dueValue);
  y += row1Height + cardGap;

  const serviceLabel = 'Service';
  const serviceValue = billing.serviceLabel || '-';
  const statusLabel = 'Payment Status';
  const statusValue = billing.status === 'paid' ? 'Paid' : 'Pending Payment';
  const row2Height = Math.max(
    measureStatCardHeight(doc, cardWidth, serviceLabel, serviceValue),
    measureStatCardHeight(doc, cardWidth, statusLabel, statusValue),
  );
  drawStatCard(doc, left, y, cardWidth, row2Height, serviceLabel, serviceValue);
  drawStatCard(doc, left + cardWidth + cardGap, y, cardWidth, row2Height, statusLabel, statusValue);
  y += row2Height + cardGap + 4;

  // Billed-to / patient block
  doc.font('Helvetica-Bold').fontSize(9).fillColor(PALETTE.tealAccent);
  doc.text('BILLED TO', left, y);
  doc.text('PATIENT', left + contentWidth / 2 + 8, y);
  y = doc.y + 4;

  doc.font('Helvetica').fontSize(9).fillColor(PALETTE.text);
  const colW = contentWidth / 2 - 8;
  const ownerName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || '-';
  const petLine = `${pet.name || '-'}${pet.species ? ` (${pet.species}${pet.breed ? `, ${pet.breed}` : ''})` : ''}`;

  const ownerStartY = y;
  let ownerEndY = drawWrapped(doc, ownerName, left, ownerStartY, colW);
  if (owner.email) {
    ownerEndY = drawWrapped(doc, owner.email, left, ownerEndY + 2, colW, { fontSize: 8 } as any);
  }

  let petEndY = drawWrapped(doc, petLine, left + contentWidth / 2 + 8, ownerStartY, colW);
  if (vetName) {
    doc.fillColor(PALETTE.subtext).fontSize(8);
    petEndY = drawWrapped(doc, `Attending: ${vetName}`, left + contentWidth / 2 + 8, petEndY + 2, colW);
    doc.fillColor(PALETTE.text).fontSize(9);
  }

  y = Math.max(ownerEndY, petEndY) + 16;

  // Itemized grid
  const tableCols = [0.46, 0.16, 0.10, 0.13, 0.15];
  const colWidths = tableCols.map((r) => contentWidth * r);
  const colXs = colWidths.reduce<number[]>((acc, _width, i) => {
    if (i === 0) acc.push(left);
    else acc.push(acc[i - 1] + colWidths[i - 1]);
    return acc;
  }, []);
  const headers = ['Description of Goods / Services', 'Unit Price', 'Qty', 'VAT', 'Amount'];

  let rowY = y;
  const rowHeight = 20;

  const drawTableHeader = () => {
    doc.roundedRect(left, rowY, contentWidth, rowHeight, 4).fillColor(PALETTE.cream).fill();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(PALETTE.tealAccent);
    headers.forEach((h, idx) => {
      const align = idx === 0 ? 'left' : 'right';
      doc.text(h.toUpperCase(), colXs[idx] + 8, rowY + 6, {
        width: colWidths[idx] - (idx === 0 ? 16 : 16),
        align,
        lineBreak: false,
        ellipsis: true,
      });
    });
    doc.fillColor('#000000');
    rowY += rowHeight;
  };

  drawTableHeader();
  doc.font('Helvetica').fontSize(8.6);

  const ensureSpace = (needed: number) => {
    if (rowY + needed <= doc.page.height - doc.page.margins.bottom - 64) return;
    doc.addPage();
    rowY = doc.page.margins.top;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(PALETTE.teal).text(`SERVICE INVOICE No.: ${billing.invoiceNumber} (cont.)`, left, rowY);
    doc.fillColor('#000000');
    rowY = doc.y + 12;
    drawTableHeader();
    doc.font('Helvetica').fontSize(8.6);
  };

  for (const item of billing.items || []) {
    const qty = item.quantity ?? 1;
    const unitPrice = item.unitPrice ?? 0;
    const rowTotal = unitPrice * qty + (item.dispenseFee ?? 0) + (item.injectionFee ?? 0);

    ensureSpace(rowHeight);

    doc.moveTo(left, rowY + rowHeight).lineTo(right, rowY + rowHeight).strokeColor(PALETTE.border).lineWidth(0.6).stroke();

    doc.fillColor(PALETTE.text);
    doc.text(item.name || '-', colXs[0] + 8, rowY + 6, { width: colWidths[0] - 16, align: 'left', lineBreak: false, ellipsis: true });
    doc.text(toMoney(unitPrice), colXs[1] + 8, rowY + 6, { width: colWidths[1] - 16, align: 'right', lineBreak: false, ellipsis: true });
    doc.text(String(qty), colXs[2] + 8, rowY + 6, { width: colWidths[2] - 16, align: 'right', lineBreak: false, ellipsis: true });
    doc.fillColor(PALETTE.subtext);
    doc.text('VATable', colXs[3] + 8, rowY + 6, { width: colWidths[3] - 16, align: 'right', lineBreak: false, ellipsis: true });
    doc.fillColor(PALETTE.text);
    doc.text(toMoney(rowTotal), colXs[4] + 8, rowY + 6, { width: colWidths[4] - 16, align: 'right', lineBreak: false, ellipsis: true });

    rowY += rowHeight;
  }

  ensureSpace(170);
  rowY += 14;

  // BIR-mandated VAT breakdown (computed against the grand total; assumes a single 12% VATable rate)
  const grandTotal = billing.totalAmountDue;
  const vatableSales = grandTotal / 1.12;
  const vatAmount = grandTotal - vatableSales;

  const summaryWidth = 230;
  const summaryX = right - summaryWidth;
  const summaryRows: Array<[string, string, boolean?]> = [
    ['Subtotal', toPhp(billing.subtotal)],
    ['Discount', `-${toPhp(billing.discount)}`],
    ['VATable Sales', toPhp(vatableSales)],
    ['VAT-Exempt Sales', toPhp(0)],
    ['Zero-Rated Sales', toPhp(0)],
    ['12% Value-Added Tax (VAT)', toPhp(vatAmount)],
  ];

  const summaryRowH = 15;
  const summaryTotalH = 26;
  const summaryBoxH = summaryRows.length * summaryRowH + summaryTotalH + 16;

  doc.roundedRect(summaryX, rowY, summaryWidth, summaryBoxH, 6).fillColor(PALETTE.cream).fill();

  let summaryY = rowY + 10;
  doc.font('Helvetica').fontSize(8.4);
  summaryRows.forEach(([label, value]) => {
    doc.fillColor(PALETTE.subtext).text(label, summaryX + 12, summaryY, { width: summaryWidth - 24, continued: false });
    doc.fillColor(PALETTE.text).font('Helvetica-Bold').text(value, summaryX + 12, summaryY, { width: summaryWidth - 24, align: 'right' });
    doc.font('Helvetica');
    summaryY += summaryRowH;
  });

  summaryY += 4;
  doc.roundedRect(summaryX + 8, summaryY, summaryWidth - 16, summaryTotalH, 5).fillColor(PALETTE.teal).fill();
  doc.fillColor(PALETTE.white).font('Helvetica-Bold').fontSize(10.5);
  doc.text('TOTAL AMOUNT DUE', summaryX + 18, summaryY + 8, { width: summaryWidth - 36, lineBreak: false });
  doc.text(toPhp(grandTotal), summaryX + 18, summaryY + 8, { width: summaryWidth - 36, align: 'right', lineBreak: false });
  doc.fillColor('#000000');

  // Payment info — light teal panel beside the VAT summary
  const paymentBoxW = contentWidth - summaryWidth - 16;
  const paymentBoxH = summaryBoxH;
  doc.roundedRect(left, rowY, paymentBoxW, paymentBoxH, 6).fillColor(PALETTE.lightTeal).fill();
  doc.fillColor(PALETTE.tealAccent).font('Helvetica-Bold').fontSize(8.6);
  doc.text('PAYMENT INFORMATION', left + 14, rowY + 14, { width: paymentBoxW - 28 });
  doc.fillColor(PALETTE.text).font('Helvetica').fontSize(8.6);
  let payY = doc.y + 8;
  payY = drawWrapped(doc, `Payment Method: ${(billing.paymentMethod || '-').toUpperCase()}`, left + 14, payY, paymentBoxW - 28);
  payY = drawWrapped(doc, `Payment Status: ${billing.status === 'paid' ? 'PAID' : 'PENDING PAYMENT'}`, left + 14, payY + 4, paymentBoxW - 28);
  if (billing.status === 'paid') {
    drawWrapped(doc, `Paid On: ${toDateTimeLabel(billing.paidAt || null)}`, left + 14, payY + 4, paymentBoxW - 28);
  }
  doc.fillColor('#000000');

  rowY += summaryBoxH + 18;

  if (billing.status === 'paid') {
    doc.save();
    doc.rotate(-22, { origin: [right - 130, doc.page.height / 2] });
    doc.fontSize(52).fillOpacity(0.07).font('Helvetica-Bold').fillColor(PALETTE.teal);
    doc.text('PAID', right - 230, doc.page.height / 2 - 20);
    doc.restore();
    doc.fillOpacity(1).fillColor('#000000');
  }

  // Footer — disclaimer + software attribution (BIR audits check for this)
  const footerTop = Math.max(rowY, doc.page.height - doc.page.margins.bottom - 78);
  doc.moveTo(left, footerTop).lineTo(right, footerTop).strokeColor(PALETTE.border).dash(2, { space: 2 }).lineWidth(1).stroke();
  doc.undash();

  doc.font('Helvetica').fontSize(7.4).fillColor(PALETTE.subtext);
  doc.text(
    clinic.receiptFooterNote ||
      'This invoice is electronically generated and serves as an official record of the goods and/or services rendered. It is system-generated and valid without a physical signature.',
    left,
    footerTop + 8,
    { width: contentWidth, align: 'center' },
  );
  doc.text(
    'Generated via PawSync — a clinic management platform for veterinary practices.',
    left,
    doc.y + 3,
    { width: contentWidth, align: 'center' },
  );
  doc.fillColor('#000000');
}

function renderThermalReceipt(
  doc: PDFKit.PDFDocument,
  billing: BillingLike,
  page: ReturnType<typeof getPageConfig>,
  ctx: ReceiptContext,
): void {
  const { left, right, contentWidth, branch, owner, pet, vetName,
    displayAddress, displayPhone, displayEmail, legalName, clinic } = ctx;

  let y = doc.page.margins.top;

  doc.font('Helvetica-Bold').fontSize(11);
  doc.text(clinic.name || 'Clinic', left, y, { width: contentWidth });

  doc.font('Helvetica').fontSize(8);
  y = doc.y + 2;

  if (branch.name) {
    y = drawWrapped(doc, `Branch: ${branch.name}`, left, y, contentWidth);
  }
  y = drawWrapped(doc, `Business Name: ${legalName}`, left, y + 2, contentWidth);
  y = drawWrapped(doc, `Address: ${displayAddress}`, left, y + 2, contentWidth);
  y = drawWrapped(doc, `Contact: ${displayPhone}${displayEmail ? ` | ${displayEmail}` : ''}`, left, y + 2, contentWidth);
  y = drawWrapped(doc, `TIN: ${clinic.businessTaxId || '-'}${clinic.businessRegistrationNo ? ` | Reg No: ${clinic.businessRegistrationNo}` : ''}`, left, y + 2, contentWidth);
  if (billing.birNumber) {
    y = drawWrapped(doc, `BIR Acknowledgement No.: ${billing.birNumber}`, left, y + 2, contentWidth);
  }

  doc.font('Helvetica-Bold').fontSize(10);
  y = drawWrapped(doc, `SERVICE INVOICE No.: ${billing.invoiceNumber}`, left, y + 4, contentWidth);

  y += 6;
  doc.moveTo(left, y).lineTo(right, y).strokeColor('#cccccc').stroke();

  y += 8;
  doc.font('Helvetica-Bold').fontSize(9).text('Consult Details', left, y);
  y = doc.y + 4;
  doc.font('Helvetica').fontSize(7.8);

  y = drawWrapped(doc, `Issue Date/Time: ${toDateTimeLabel(billing.issueDateTime)}`, left, y, contentWidth);
  y = drawWrapped(doc, `Due Date: ${toDateLabel(billing.dueDate)}`, left, y + 2, contentWidth);
  y = drawWrapped(doc, `Owner: ${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'Owner: -', left, y + 4, contentWidth);
  y = drawWrapped(
    doc,
    `Pet: ${pet.name || '-'}${pet.species ? ` (${pet.species}${pet.breed ? `, ${pet.breed}` : ''})` : ''}`,
    left,
    y + 2,
    contentWidth,
  );
  y = drawWrapped(doc, `Service: ${billing.serviceLabel || '-'}`, left, y + 2, contentWidth);
  if (vetName) {
    y = drawWrapped(doc, `Attending Veterinarian: ${vetName}`, left, y + 2, contentWidth);
  }

  const tableTop = y + 10;
  const tableCols = [0.46, 0.18, 0.12, 0.24];
  const colWidths = tableCols.map((r) => contentWidth * r);
  const colXs = colWidths.reduce<number[]>((acc, _width, i) => {
    if (i === 0) acc.push(left);
    else acc.push(acc[i - 1] + colWidths[i - 1]);
    return acc;
  }, []);

  const headers = ['Item', 'Unit Price', 'Qty', 'Total'];

  let rowY = tableTop;
  const rowHeight = 16;

  doc.rect(left, rowY, contentWidth, rowHeight).strokeColor('#777777').lineWidth(0.6).stroke();
  doc.font('Helvetica-Bold').fontSize(7.2);

  headers.forEach((h, idx) => {
    const align = idx === 0 ? 'left' : 'right';
    doc.text(h, colXs[idx] + 4, rowY + 4, {
      width: colWidths[idx] - 8,
      align,
      lineBreak: false,
      ellipsis: true,
    });
  });

  rowY += rowHeight;

  doc.font('Helvetica').fontSize(7.4);

  const ensureSpace = (needed: number) => {
    if (rowY + needed <= doc.page.height - doc.page.margins.bottom - 64) return;
    doc.addPage();
    rowY = doc.page.margins.top;
    doc.font('Helvetica-Bold').fontSize(9).text(`No.: ${billing.invoiceNumber} (cont.)`, left, rowY);
    rowY = doc.y + 8;
  };

  for (const item of billing.items || []) {
    const qty = item.quantity ?? 1;
    const unitPrice = item.unitPrice ?? 0;
    const rowTotal = unitPrice * qty + (item.dispenseFee ?? 0) + (item.injectionFee ?? 0);

    ensureSpace(rowHeight);

    doc.rect(left, rowY, contentWidth, rowHeight).strokeColor('#d0d0d0').lineWidth(0.5).stroke();

    doc.text(item.name || '-', colXs[0] + 4, rowY + 4, { width: colWidths[0] - 8, align: 'left', lineBreak: false, ellipsis: true });
    doc.text(toMoney(unitPrice), colXs[1] + 4, rowY + 4, { width: colWidths[1] - 8, align: 'right', lineBreak: false, ellipsis: true });
    doc.text(String(qty), colXs[2] + 4, rowY + 4, { width: colWidths[2] - 8, align: 'right', lineBreak: false, ellipsis: true });
    doc.text(toMoney(rowTotal), colXs[3] + 4, rowY + 4, { width: colWidths[3] - 8, align: 'right', lineBreak: false, ellipsis: true });

    rowY += rowHeight;
  }

  ensureSpace(90);
  rowY += 8;

  doc.font('Helvetica').fontSize(8);
  doc.text(`Subtotal: ${toPhp(billing.subtotal)}`, left, rowY, { width: contentWidth, align: 'right' });
  rowY = doc.y + 2;
  doc.text(`Discount: ${toPhp(billing.discount)}`, left, rowY, { width: contentWidth, align: 'right' });
  rowY = doc.y + 2;
  const taxesAndFees = Math.max(0, billing.totalAmountDue - (billing.subtotal - billing.discount));
  doc.text(`Taxes/Fees: ${toPhp(taxesAndFees)}`, left, rowY, { width: contentWidth, align: 'right' });
  rowY = doc.y + 6;

  doc.rect(left, rowY, contentWidth, 18).fillAndStroke('#111111', '#111111');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
  doc.text(`Total: ${toPhp(billing.totalAmountDue)}`, left + 8, rowY + 5, { width: contentWidth - 16, align: 'right' });
  doc.fillColor('#000000');
  rowY += 26;

  doc.font('Helvetica').fontSize(7.8);
  doc.text(`Payment Method: ${(billing.paymentMethod || '-').toUpperCase()}`, left, rowY, { width: contentWidth, align: 'left' });
  rowY = doc.y + 2;
  doc.text(`Payment Status: ${billing.status === 'paid' ? 'PAID' : 'PENDING PAYMENT'}`, left, rowY, { width: contentWidth, align: 'left' });

  if (billing.status === 'paid') {
    rowY = doc.y + 2;
    doc.text(`Paid On: ${toDateTimeLabel(billing.paidAt || null)}`, left, rowY, { width: contentWidth, align: 'left' });
  }

  const footerY = Math.max(doc.y + 12, doc.page.height - doc.page.margins.bottom - 42);
  doc.font('Helvetica').fontSize(7);
  doc.text(clinic.receiptFooterNote || 'This receipt is system-generated and valid without signature.', left, footerY, {
    width: contentWidth,
    align: 'left',
  });
}
