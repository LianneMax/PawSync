import PDFDocument from 'pdfkit';

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

  let y = doc.page.margins.top;

  const logoBuffer = parseDataUrlImage(clinic.logo || null);
  if (logoBuffer && !page.thermal) {
    try {
      doc.image(logoBuffer, left, y, { fit: [60, 60] });
    } catch {
      // Ignore invalid image payloads and continue with text layout.
    }
  }

  const headerX = logoBuffer && !page.thermal ? left + 68 : left;
  doc.font('Helvetica-Bold').fontSize(page.thermal ? 11 : 18);
  doc.text(clinic.name || 'Clinic', headerX, y, { width: contentWidth - (headerX - left) - 120 });

  doc.font('Helvetica').fontSize(page.thermal ? 8 : 10);
  y = doc.y + 2;

  if (branch.name) {
    y = drawWrapped(doc, `Branch: ${branch.name}`, headerX, y, contentWidth - (headerX - left) - 120);
    y += 2;
  }

  const legalName = clinic.legalBusinessName || clinic.name || '-';
  y = drawWrapped(doc, `Business Name: ${legalName}`, headerX, y, contentWidth - (headerX - left) - 120);
  y = drawWrapped(doc, `Address: ${displayAddress}`, headerX, y + 2, contentWidth - (headerX - left) - 120);
  y = drawWrapped(doc, `Contact: ${displayPhone}${displayEmail ? ` | ${displayEmail}` : ''}`, headerX, y + 2, contentWidth - (headerX - left) - 120);
  y = drawWrapped(doc, `TIN: ${clinic.businessTaxId || '-'}${clinic.businessRegistrationNo ? ` | Reg No: ${clinic.businessRegistrationNo}` : ''}`, headerX, y + 2, contentWidth - (headerX - left) - 120);

  doc.font('Helvetica-Bold').fontSize(page.thermal ? 10 : 13);
  doc.text(`No.: ${billing.invoiceNumber}`, right - 120, doc.page.margins.top, { width: 120, align: 'right' });

  y = Math.max(y + 8, doc.page.margins.top + (page.thermal ? 68 : 78));
  doc.moveTo(left, y).lineTo(right, y).strokeColor('#cccccc').stroke();

  y += 10;
  doc.font('Helvetica-Bold').fontSize(page.thermal ? 9 : 12).text('Consult Details', left, y);
  y = doc.y + 4;
  doc.font('Helvetica').fontSize(page.thermal ? 7.8 : 10);

  y = drawWrapped(doc, `Issue Date/Time: ${toDateTimeLabel(billing.issueDateTime)}`, left, y, contentWidth / 2 - 8);
  doc.text(`Due Date: ${toDateLabel(billing.dueDate)}`, left + contentWidth / 2 + 8, y - 13, { width: contentWidth / 2 - 8, align: 'right' });

  y = drawWrapped(
    doc,
    `Owner: ${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'Owner: -',
    left,
    y + 4,
    contentWidth,
  );

  y = drawWrapped(
    doc,
    `Pet: ${pet.name || '-'}${pet.species ? ` (${pet.species}${pet.breed ? `, ${pet.breed}` : ''})` : ''}`,
    left,
    y + 2,
    contentWidth,
  );

  y = drawWrapped(doc, `Service: ${billing.serviceLabel || '-'}`, left, y + 2, contentWidth);

  const vetName = vet.firstName ? `Dr. ${vet.firstName} ${vet.lastName || ''}`.trim() : null;
  if (vetName) {
    y = drawWrapped(doc, `Attending Veterinarian: ${vetName}`, left, y + 2, contentWidth);
  }

  const tableTop = y + 10;
  const tableCols = page.thermal
    ? [0.46, 0.18, 0.12, 0.24]
    : [0.54, 0.16, 0.10, 0.20];

  const colWidths = tableCols.map((r) => contentWidth * r);
  const colXs = colWidths.reduce<number[]>((acc, _width, i) => {
    if (i === 0) acc.push(left);
    else acc.push(acc[i - 1] + colWidths[i - 1]);
    return acc;
  }, []);

  const headers = ['Item', 'Unit Price', 'Qty', 'Total'];

  let rowY = tableTop;
  const rowHeight = page.thermal ? 16 : 18;

  doc.rect(left, rowY, contentWidth, rowHeight).strokeColor('#777777').lineWidth(0.6).stroke();
  doc.font('Helvetica-Bold').fontSize(page.thermal ? 7.2 : 9);

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

  doc.font('Helvetica').fontSize(page.thermal ? 7.4 : 9);

  const ensureSpace = (needed: number) => {
    if (rowY + needed <= doc.page.height - doc.page.margins.bottom - 64) return;
    doc.addPage();
    rowY = doc.page.margins.top;
    doc.font('Helvetica-Bold').fontSize(page.thermal ? 9 : 11).text(`No.: ${billing.invoiceNumber} (cont.)`, left, rowY);
    rowY = doc.y + 8;
  };

  for (const item of billing.items || []) {
    const qty = item.quantity ?? 1;
    const unitPrice = item.unitPrice ?? 0;
    const rowTotal = unitPrice * qty + (item.dispenseFee ?? 0) + (item.injectionFee ?? 0);

    ensureSpace(rowHeight);

    doc.rect(left, rowY, contentWidth, rowHeight).strokeColor('#d0d0d0').lineWidth(0.5).stroke();

    doc.text(item.name || '-', colXs[0] + 4, rowY + 4, {
      width: colWidths[0] - 8,
      align: 'left',
      lineBreak: false,
      ellipsis: true,
    });
    doc.text(toMoney(unitPrice), colXs[1] + 4, rowY + 4, { width: colWidths[1] - 8, align: 'right', lineBreak: false, ellipsis: true });
    doc.text(String(qty), colXs[2] + 4, rowY + 4, { width: colWidths[2] - 8, align: 'right', lineBreak: false, ellipsis: true });
    doc.text(toMoney(rowTotal), colXs[3] + 4, rowY + 4, { width: colWidths[3] - 8, align: 'right', lineBreak: false, ellipsis: true });

    rowY += rowHeight;
  }

  ensureSpace(90);
  rowY += 8;

  doc.font('Helvetica').fontSize(page.thermal ? 8 : 10);
  doc.text(`Subtotal: ${toPhp(billing.subtotal)}`, left, rowY, { width: contentWidth, align: 'right' });
  rowY = doc.y + 2;
  doc.text(`Discount: ${toPhp(billing.discount)}`, left, rowY, { width: contentWidth, align: 'right' });
  rowY = doc.y + 2;
  const taxesAndFees = Math.max(0, billing.totalAmountDue - (billing.subtotal - billing.discount));
  doc.text(`Taxes/Fees: ${toPhp(taxesAndFees)}`, left, rowY, { width: contentWidth, align: 'right' });
  rowY = doc.y + 6;

  doc.rect(left, rowY, contentWidth, page.thermal ? 18 : 22).fillAndStroke('#111111', '#111111');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(page.thermal ? 9 : 11);
  doc.text(`Total: ${toPhp(billing.totalAmountDue)}`, left + 8, rowY + (page.thermal ? 5 : 6), {
    width: contentWidth - 16,
    align: 'right',
  });
  doc.fillColor('#000000');
  rowY += page.thermal ? 26 : 30;

  doc.font('Helvetica').fontSize(page.thermal ? 7.8 : 10);
  doc.text(`Payment Method: ${(billing.paymentMethod || '-').toUpperCase()}`, left, rowY, {
    width: contentWidth,
    align: 'left',
  });
  rowY = doc.y + 2;
  doc.text(`Payment Status: ${billing.status === 'paid' ? 'PAID' : 'PENDING PAYMENT'}`, left, rowY, {
    width: contentWidth,
    align: 'left',
  });

  if (billing.status === 'paid') {
    rowY = doc.y + 2;
    doc.text(`Paid On: ${toDateTimeLabel(billing.paidAt || null)}`, left, rowY, {
      width: contentWidth,
      align: 'left',
    });
  }

  if (billing.status === 'paid' && !page.thermal) {
    doc.save();
    doc.rotate(-22, { origin: [right - 130, doc.page.height / 2] });
    doc.fontSize(52).fillOpacity(0.08).font('Helvetica-Bold').fillColor('#0f5132');
    doc.text('PAID', right - 230, doc.page.height / 2 - 20);
    doc.restore();
    doc.fillOpacity(1).fillColor('#000000');
  }

  const footerY = Math.max(doc.y + 12, doc.page.height - doc.page.margins.bottom - 42);
  doc.font('Helvetica').fontSize(page.thermal ? 7 : 8.6);
  doc.text(clinic.receiptFooterNote || 'This receipt is system-generated and valid without signature.', left, footerY, {
    width: contentWidth,
    align: page.thermal ? 'left' : 'center',
  });

  doc.end();
  return done;
}
