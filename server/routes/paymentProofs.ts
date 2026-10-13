import { db } from '../db.js';
import { deleteUpload, recoverStagedUploads } from '../uploads.js';
import type { ProofStatus, PublicProofStatus } from '../../src/shared/paymentProof.js';

// Proofs of payment (docs/update.md Phase E). The screenshots are private: no public route
// serves UPLOADS_DIR. The admin Payments routes (list, file, approve/reject) come in Phase F.

/** The latest proof of a payment request as the track page shows it (E.4), or null. */
export function latestPublicProof(paymentId: string): PublicProofStatus | null {
  const row = db.prepare('SELECT status, created_at, admin_note FROM payment_proofs WHERE payment_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(paymentId) as { status: ProofStatus; created_at: string; admin_note: string | null } | undefined;
  if (!row) return null;
  return {
    status: row.status,
    submittedAt: row.created_at,
    // The admin's note is only shown to the customer as a rejection reason.
    rejectionReason: row.status === 'REJECTED' ? row.admin_note : null,
  };
}

/**
 * Removes every proof sent for a shipment, rows and files. A shipment has at most one payment
 * request, so this runs whenever that request is deleted (and on permanent shipment delete).
 */
export function deleteProofsForShipment(tracking: string) {
  const rows = db.prepare('SELECT file_name FROM payment_proofs WHERE tracking_number = ?').all(tracking) as { file_name: string }[];
  db.prepare('DELETE FROM payment_proofs WHERE tracking_number = ?').run(tracking);
  for (const row of rows) deleteUpload('proofs', row.file_name);
}

/** On start: completes or removes proof uploads left half-way by a crash or restart (server/uploads.ts). */
export function recoverProofUploads() {
  const known = db.prepare('SELECT 1 FROM payment_proofs WHERE file_name = ?');
  const result = recoverStagedUploads('proofs', (fileName) => !!known.get(fileName));
  if (result.finished || result.removed) {
    console.log(`[uploads] Proof uploads recovered: ${result.finished} finished, ${result.removed} unused removed.`);
  }
}
