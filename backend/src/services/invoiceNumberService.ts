import mongoose from 'mongoose';
import InvoiceCounter from '../models/InvoiceCounter';

const INVOICE_PAD_WIDTH = 6;

function formatInvoiceNumber(sequence: number): string {
  // Single monotonic number per clinic; sample receipt shows this as "No.".
  return sequence.toString().padStart(INVOICE_PAD_WIDTH, '0');
}

export async function generateNextInvoiceNumber(
  clinicId: mongoose.Types.ObjectId | string,
): Promise<string> {
  const clinicObjectId = new mongoose.Types.ObjectId(clinicId);

  const counter = await InvoiceCounter.findOneAndUpdate(
    { clinicId: clinicObjectId },
    { $inc: { sequence: 1 }, $setOnInsert: { clinicId: clinicObjectId } },
    { new: true, upsert: true },
  );

  return formatInvoiceNumber(counter.sequence);
}
