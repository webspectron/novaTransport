import React, { useId, useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import type { PublicPayment } from '../shared/paymentRequest';
import { validateProofSubmission } from '../shared/paymentProof';
import { compressImage, ImageCompressError } from '../services/imageCompress';
import { api } from '../services/api';

interface PaymentProofFormProps {
  trackingNumber: string;
  payment: PublicPayment;
  /** Called with the submission time once the server has accepted the proof. */
  onSent: (submittedAt: string) => void;
  /** Inside the "Send proof of payment" tab (E.3): the tab shows the title, so no heading or card frame here. */
  embedded?: boolean;
}

// Customer-facing text (CONTENT.md §6.7).
const MSG = {
  noImage: 'Add a screenshot of the payment.',
  notImage: 'This file isn\'t an image. Upload a JPG, PNG, WebP or HEIC.',
  unreadable: 'This image could not be read. Try another file or take a new screenshot.',
  tooLarge: 'This image is too large. Try a smaller image or take a new screenshot.',
  network: 'We couldn\'t send your proof. Check your connection and try again.',
};

// Same check as the compressor: some browsers give HEIC photos an empty type.
const IMAGE_FILE = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i;

type Field = 'methodId' | 'payerName' | 'amountSent' | 'reference' | 'image';
const FIELD_ORDER: Field[] = ['methodId', 'payerName', 'amountSent', 'reference', 'image'];

/**
 * "Send proof of payment" form (docs/update.md E.3): the account used (this shipment's accounts
 * only), payer name, amount sent, optional reference and a screenshot that is compressed and
 * stripped of EXIF data in the browser before upload, with a preview.
 */
export const PaymentProofForm: React.FC<PaymentProofFormProps> = ({ trackingNumber, payment, onSent, embedded = false }) => {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [methodId, setMethodId] = useState(payment.methods.length === 1 ? payment.methods[0].id : '');
  const [payerName, setPayerName] = useState('');
  const [amountSent, setAmountSent] = useState(String(payment.amount));
  const [reference, setReference] = useState('');
  const [image, setImage] = useState<{ dataUrl: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState('');

  const fieldId = (f: Field) => `${id}-${f}`;
  // Editing a field clears its own error; the rest stay until the next submit.
  const edit = (f: Field, set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    set(e.target.value);
    if (errors[f]) setErrors((prev) => ({ ...prev, [f]: undefined }));
  };
  const errorId = (f: Field) => `${id}-${f}-error`;

  const focusFirstError = (errs: Partial<Record<Field, string>>) => {
    const first = FIELD_ORDER.find((f) => errs[f]);
    if (!first) return;
    const target = first === 'image' ? document.getElementById(`${id}-image-button`) : document.getElementById(fieldId(first));
    target?.focus();
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setErrors((e) => ({ ...e, image: undefined }));
    if (!file.type.startsWith('image/') && !IMAGE_FILE.test(file.name)) {
      setErrors((e) => ({ ...e, image: MSG.notImage }));
      return;
    }
    setPreparing(true);
    try {
      const compressed = await compressImage(file);
      setImage({ dataUrl: `data:${compressed.mimeType};base64,${compressed.base64}` });
    } catch (err) {
      setImage(null);
      const tooLarge = err instanceof ImageCompressError && /too large/i.test(err.message);
      setErrors((e) => ({ ...e, image: tooLarge ? MSG.tooLarge : MSG.unreadable }));
    } finally {
      setPreparing(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending || preparing) return;
    setFormError('');
    const body = { methodId, payerName, amountSent, reference };
    const checked = validateProofSubmission(body, payment.methods.map((m) => m.id));
    const errs: Partial<Record<Field, string>> = checked.ok ? {} : { ...checked.errors };
    if (!image) errs.image = MSG.noImage;
    setErrors(errs);
    if (!checked.ok || !image) {
      focusFirstError(errs);
      return;
    }

    setSending(true);
    try {
      const result = await api.submitPaymentProof(trackingNumber, { ...checked.value, reference: checked.value.reference ?? undefined, image: image.dataUrl });
      onSent(result.submittedAt);
    } catch (err: any) {
      if (err?.status === 413) {
        // Over the server's request limit (should not happen after compression): ask for a smaller image.
        const errs = { image: MSG.tooLarge };
        setErrors(errs);
        focusFirstError(errs);
      } else if (err?.fieldErrors) {
        setErrors(err.fieldErrors);
        focusFirstError(err.fieldErrors);
      } else if (err?.status === 409 || err?.status === 429) {
        // The server's own text: no longer awaiting, too many open proofs, or too many attempts.
        setFormError(err.message);
      } else {
        setFormError(MSG.network);
      }
    } finally {
      setSending(false);
    }
  };

  const describedBy = (f: Field, hint?: string) => [hint, errors[f] ? errorId(f) : null].filter(Boolean).join(' ') || undefined;
  const errorText = (f: Field) => errors[f] && <p id={errorId(f)} className="ngt-proof-error">{errors[f]}</p>;

  return (
    <form
      className={`ngt-proof-form${embedded ? ' is-embedded' : ''}`}
      onSubmit={submit}
      noValidate
      {...(embedded ? { 'aria-label': 'Send proof of payment' } : { 'aria-labelledby': `${id}-title` })}
    >
      {!embedded && <h4 id={`${id}-title`} className="ngt-pay-methods-title">Send proof of payment</h4>}
      <p className="ngt-pay-methods-sub">After paying, upload a screenshot or photo of the receipt so our team can confirm it.</p>

      <div className="ngt-proof-grid">
        <div className="ngt-proof-field">
          <label htmlFor={fieldId('methodId')}>Account you paid to</label>
          <select
            id={fieldId('methodId')}
            value={methodId}
            onChange={edit('methodId', setMethodId)}
            aria-invalid={!!errors.methodId}
            aria-describedby={describedBy('methodId')}
          >
            <option value="">Choose an account</option>
            {payment.methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          {errorText('methodId')}
        </div>

        <div className="ngt-proof-field">
          <label htmlFor={fieldId('payerName')}>Your name</label>
          <input
            id={fieldId('payerName')}
            type="text"
            autoComplete="name"
            maxLength={100}
            value={payerName}
            onChange={edit('payerName', setPayerName)}
            aria-invalid={!!errors.payerName}
            aria-describedby={describedBy('payerName', `${id}-payerName-hint`)}
          />
          <p id={`${id}-payerName-hint`} className="ngt-proof-hint">The name the payment was sent from</p>
          {errorText('payerName')}
        </div>

        <div className="ngt-proof-field">
          <label htmlFor={fieldId('amountSent')}>Amount sent</label>
          <div className="ngt-proof-amount">
            <input
              id={fieldId('amountSent')}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amountSent}
              onChange={edit('amountSent', setAmountSent)}
              aria-invalid={!!errors.amountSent}
              aria-describedby={describedBy('amountSent')}
            />
            <span aria-hidden="true">{payment.currency}</span>
          </div>
          {errorText('amountSent')}
        </div>

        <div className="ngt-proof-field">
          <label htmlFor={fieldId('reference')}>Payment reference (optional)</label>
          <input
            id={fieldId('reference')}
            type="text"
            maxLength={120}
            value={reference}
            onChange={edit('reference', setReference)}
            aria-invalid={!!errors.reference}
            aria-describedby={describedBy('reference', `${id}-reference-hint`)}
          />
          <p id={`${id}-reference-hint`} className="ngt-proof-hint">Transaction ID, MTCN or reference number</p>
          {errorText('reference')}
        </div>
      </div>

      <div className="ngt-proof-field ngt-proof-image">
        <span className="ngt-proof-label" id={`${id}-image-label`}>Screenshot of the payment</span>
        <p id={`${id}-image-hint`} className="ngt-proof-hint">JPG, PNG, WebP or HEIC. Only our team can see it.</p>
        <input
          ref={fileInput}
          id={fieldId('image')}
          type="file"
          accept="image/*,.heic,.heif"
          className="ngt-sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => chooseFile(e.target.files?.[0])}
        />
        {image && <img className="ngt-proof-preview" src={image.dataUrl} alt="Your payment screenshot" />}
        <div className="ngt-proof-image-actions">
          <button
            id={`${id}-image-button`}
            type="button"
            className="ngt-proof-secondary"
            onClick={() => fileInput.current?.click()}
            disabled={preparing}
            aria-describedby={describedBy('image', `${id}-image-label ${id}-image-hint`)}
          >
            {preparing ? <Loader2 size={15} className="ngt-proof-spin" aria-hidden="true" /> : <ImagePlus size={15} aria-hidden="true" />}
            <span>{image ? 'Change image' : 'Choose image'}</span>
          </button>
          {image && (
            <button type="button" className="ngt-proof-link" onClick={() => setImage(null)}>Remove image</button>
          )}
        </div>
        {errorText('image')}
      </div>

      {formError && <p className="ngt-proof-form-error" role="alert">{formError}</p>}

      <button type="submit" className="ngt-btn-primary ngt-proof-submit" disabled={sending || preparing}>
        {sending && <Loader2 size={16} className="ngt-proof-spin" aria-hidden="true" />}
        <span>{sending ? 'Sending…' : 'Send proof'}</span>
      </button>
    </form>
  );
};
