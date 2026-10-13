import React, { useEffect, useId, useRef, useState } from 'react';
import type { PaymentStatus, PublicPayment } from '../shared/paymentRequest';
import { formatPaymentAmount } from '../shared/paymentRequest';
import { CheckCircle2, ChevronDown, Wallet } from 'lucide-react';
import { PaymentMethodCard } from './PaymentMethodCard';
import './PaymentSection.css';

interface PaymentSectionProps {
  payment: PublicPayment;
}

// Status badge text (CONTENT.md §6.7) and tone.
const STATUS_BADGES: Record<PaymentStatus, { label: string; tone: string }> = {
  AWAITING_PAYMENT: { label: 'Awaiting payment', tone: 'awaiting' },
  UNDER_REVIEW: { label: 'Proof under review', tone: 'review' },
  PAID: { label: 'Paid', tone: 'paid' },
  CANCELLED: { label: 'Cancelled', tone: 'cancelled' },
};

/** Due dates are stored as YYYY-MM-DD; read them as calendar dates so no time zone shifts the day. */
function formatDueDate(value: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(d);
}

function formatPaidDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);
}

interface PaymentTabProps {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/** Full-width tab that opens its panel underneath. Closed until the customer opens it. */
const PaymentTab: React.FC<PaymentTabProps> = ({ icon, title, sub, open, onToggle, children }) => {
  const panelId = useId();
  return (
    <div className={`ngt-pay-tab${open ? ' is-open' : ''}`}>
      <button type="button" className="ngt-pay-tab-btn" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span className="ngt-pay-tab-icon" aria-hidden="true">{icon}</span>
        <span className="ngt-pay-tab-text">
          <strong>{title}</strong>
          {sub && <small>{sub}</small>}
        </span>
        <ChevronDown size={18} className="ngt-pay-tab-chevron" aria-hidden="true" />
      </button>
      <div id={panelId} className="ngt-pay-tab-panel" hidden={!open}>
        {children}
      </div>
    </div>
  );
};

// Below this width the accounts are an accordion (one open at a time); above it, a grid.
const NARROW_QUERY = '(max-width: 767px)';
const TOAST_MS = 2000;

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return narrow;
}

/**
 * Track Result "Payment" section (CONTENT.md §6.7): what is due, what it is for, its status,
 * and this shipment's payment accounts with copy buttons and QR codes.
 */
export const PaymentSection: React.FC<PaymentSectionProps> = ({ payment }) => {
  const status = payment.status;
  const badge = STATUS_BADGES[status] ?? STATUS_BADGES.AWAITING_PAYMENT;
  const narrow = useIsNarrow();
  const [openId, setOpenId] = useState<string | null>(payment.methods[0]?.id ?? null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  // Once paid, the accounts stay behind the same tab with a show/hide title (D.4).
  const isPaid = status === 'PAID';
  // The accounts sit behind a tab, closed until opened (D.3).
  const [showMethods, setShowMethods] = useState(false);

  const showToast = (message: string) => {
    // Clear first so the same message is announced again on a second copy.
    setToast('');
    window.clearTimeout(toastTimer.current);
    requestAnimationFrame(() => setToast(message));
    toastTimer.current = window.setTimeout(() => setToast(''), TOAST_MS);
  };

  // A cancelled request is not shown to the customer (the track page doesn't render this either).
  if (status === 'CANCELLED') return null;

  const paidDate = formatPaidDate(payment.paidAt);
  const count = payment.methods.length;

  return (
    <section className="ngt-pay-section" aria-labelledby="track-payment-title">
      <div className="ngt-pay-summary">
        <div className="ngt-pay-summary-head">
          <h3 id="track-payment-title" className="card-section-title ngt-pay-title">Payment</h3>
          <span className={`ngt-pay-badge is-${badge.tone}`}>{badge.label}</span>
        </div>

        {status === 'AWAITING_PAYMENT' && (
          <p className="ngt-pay-intro">
            A payment is due for this shipment. Pay using any one of the accounts below, then send us your proof of payment.
          </p>
        )}

        {isPaid && (
          <div className="ngt-pay-received">
            <CheckCircle2 size={20} aria-hidden="true" />
            <div>
              <strong>Payment received</strong>
              <p>{paidDate ? `Thank you. We received your payment on ${paidDate}.` : 'Thank you. We have received your payment.'}</p>
            </div>
          </div>
        )}

        <dl className="ngt-pay-facts">
          <div className="ngt-pay-fact ngt-pay-fact-amount">
            <dt>Amount due</dt>
            <dd className="ngt-pay-amount">{formatPaymentAmount(payment.amount, payment.currency)}</dd>
          </div>
          <div className="ngt-pay-fact">
            <dt>For</dt>
            <dd>{payment.chargeReason}</dd>
          </div>
          {payment.dueDate && (
            <div className="ngt-pay-fact">
              <dt>Due by</dt>
              <dd>{formatDueDate(payment.dueDate)}</dd>
            </div>
          )}
        </dl>

        {payment.customerNote && (
          <div className="ngt-pay-note">
            <strong>Note from our team</strong>
            <p>{payment.customerNote}</p>
          </div>
        )}
      </div>

      {count > 0 && (
        <div className="ngt-pay-methods">
          <PaymentTab
            icon={<Wallet size={18} />}
            title={isPaid ? (showMethods ? 'Hide payment accounts' : 'Show payment accounts') : 'How to pay'}
            sub={isPaid ? undefined : count === 1 ? '1 payment option' : `Choose one of ${count} payment options`}
            open={showMethods}
            onToggle={() => setShowMethods((v) => !v)}
          >
            {!isPaid && <p className="ngt-pay-methods-sub">Choose one account. You only need to pay once.</p>}
            <ul className={`ngt-pay-methods-list${narrow ? ' is-accordion' : ''}`}>
              {payment.methods.map((method) => (
                <li key={method.id}>
                  <PaymentMethodCard
                    view={method}
                    instructions={method.instructions}
                    collapsible={narrow}
                    expanded={openId === method.id}
                    onToggle={() => setOpenId((current) => (current === method.id ? null : method.id))}
                    onCopyMessage={showToast}
                  />
                </li>
              ))}
            </ul>
          </PaymentTab>
        </div>
      )}

      <div className={`ngt-pay-toast${toast ? ' is-visible' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </section>
  );
};
