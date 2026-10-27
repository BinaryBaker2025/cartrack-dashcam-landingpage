'use client';
import { useContext, useEffect, useRef, useState, type FormEvent } from 'react';
import { validateLead, type FieldErrors } from '@/lib/validation';
import { sessionAttribution } from '@/lib/attribution';
import { track } from '@/lib/analytics';
import { trackMicrosoftLead } from '@/lib/uet';
import { trackGoogleAdsLeadConversion } from '@/lib/googleTag';
import { submissionKey } from '@/lib/submissionKey';
import { browserAttempt, browserReceipt, saveBrowserReceipt } from '@/lib/browserState';
import { reportDiagnostic } from '@/lib/diagnostics';
import { QuoteSuccessContext } from '@/components/QuoteExperience';
type State =
  | 'idle'
  | 'validating'
  | 'submitting'
  | 'success'
  | 'qualification_failed'
  | 'duplicate'
  | 'api_rejected'
  | 'temporary_error';
export default function LeadForm() {
  const [state, setState] = useState<State>('idle');
  const onSuccess = useContext(QuoteSuccessContext);
  useEffect(() => {
    if (state === 'success') onSuccess?.();
  }, [state, onSuccess]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');
  const busy = useRef(false);
  const started = useRef(false);
  const viewed = useRef(false);
  const submission = useRef({ id: '', payload: '' });
  const status = useRef<HTMLDivElement>(null);
  useEffect(() => {
    sessionAttribution();
    if (!viewed.current) {
      track('landing_page_view');
      viewed.current = true;
    }
  }, []);
  const locked = state === 'submitting' || state === 'validating';
  function begin() {
    if (!started.current) {
      started.current = true;
      track('form_started');
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || locked) return;
    busy.current = true;
    setState('validating');
    setMessage('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const raw = {
      ...Object.fromEntries(data),
      terms: true,
      eligibilityConfirmed: true,
    };
    const validation = validateLead(raw);
    setErrors(validation.errors);
    if (!validation.valid) {
      setState(validation.reasons.length ? 'qualification_failed' : 'idle');
      setMessage(
        validation.reasons.length
          ? 'Unfortunately, you don’t meet the requirements for this offer.'
          : 'Please check the highlighted fields.',
      );
      track(validation.reasons.length ? 'qualification_failed' : 'form_validation_failed', {
        reasons: validation.reasons,
        fields: Object.keys(validation.errors),
      });
      busy.current = false;
      const firstError = Object.keys(validation.errors)[0];
      requestAnimationFrame(() =>
        form.querySelector<HTMLElement>(`[name="${firstError}"]`)?.focus(),
      );
      return;
    }
    const payload = JSON.stringify(validation.input);
    // Reuse the same key after uncertain network outcomes. Changed data gets a new key.
    setState('submitting');
    try {
      if (submission.current.payload !== payload)
        submission.current = { id: await submissionKey(payload), payload };
      const saved = browserReceipt(submission.current.id);
      if (saved) {
        setState(saved.state);
        setMessage(saved.message);
        requestAnimationFrame(() => status.current?.focus());
        return;
      }
      const attempt = browserAttempt();
      if (!attempt.allowed) {
        setState('temporary_error');
        setMessage(
          `Please wait ${Math.ceil(attempt.retryAfter / 60)} minute(s) before trying again.`,
        );
        return;
      }
      track('lead_submit_started');
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validation.input,
          submissionId: submission.current.id,
          attribution: sessionAttribution(),
        }),
      });
      let result;
      try {
        result = await response.json();
      } catch {
        reportDiagnostic({ code: 'API_NON_JSON_RESPONSE' }, response.status);
        setState('temporary_error');
        setMessage('We could not read the server response. Please try again shortly.');
        track('lead_submit_error');
        return;
      }
      reportDiagnostic(result?.diagnostics, response.status);
      const states: State[] = [
        'success',
        'qualification_failed',
        'duplicate',
        'api_rejected',
        'temporary_error',
      ];
      const next: State =
        states.includes(result.state) && (result.state !== 'success' || response.ok)
          ? result.state
          : 'api_rejected';
      setState(next);
      setMessage(
        typeof result.message === 'string'
          ? result.message
          : 'Please check your information and try again.',
      );
      if (result.errors) setErrors(result.errors);
      if (next === 'duplicate') {
        const duplicateFields = Array.isArray(result.duplicateFields)
          ? result.duplicateFields.filter((field: unknown): field is keyof FieldErrors =>
              ['name', 'phone'].includes(String(field)),
            )
          : ['phone'];
        setErrors((current) => ({
          ...current,
          ...Object.fromEntries(
            duplicateFields.map((field: keyof FieldErrors) => [
              field,
              'This detail has already been submitted.',
            ]),
          ),
        }));
      }
      if (next === 'success' || next === 'duplicate')
        saveBrowserReceipt(
          submission.current.id,
          { state: next, message: result.message },
          sessionAttribution(),
        );
      if (result.retryable === true)
        submission.current = { id: await submissionKey(payload, true), payload };
      if (next === 'success') {
        trackGoogleAdsLeadConversion();
        trackMicrosoftLead(validation.input.email, validation.input.phone);
      }
      track(
        next === 'success'
          ? 'lead_submit_success'
          : next === 'temporary_error'
            ? 'lead_submit_error'
            : next === 'qualification_failed'
              ? 'qualification_failed'
              : 'lead_submit_rejected',
        { state: next },
      );
      requestAnimationFrame(() => status.current?.focus());
    } catch {
      reportDiagnostic({ code: 'BROWSER_REQUEST_FAILED' });
      setState('temporary_error');
      setMessage('We couldn’t confirm your request. Check your connection, then try again.');
      track('lead_submit_error');
    } finally {
      busy.current = false;
    }
  }
  function fieldError(name: keyof FieldErrors) {
    return errors[name] ? (
      <span className="field-error" id={`${name}-error`}>
        {errors[name]}
      </span>
    ) : null;
  }
  function input(name: 'name' | 'phone', label: string, autocomplete: string) {
    return (
      <div className="field contact-field">
        <label className="sr-only" htmlFor={name}>
          {label}
        </label>
        <div className={name === 'phone' ? 'phone-input' : undefined}>
          {name === 'phone' && (
            <span className="phone-prefix" aria-hidden="true">
              <svg width="20" height="14" viewBox="0 0 30 20" focusable="false">
                <path fill="#de3831" d="M0 0h30v10H0z" />
                <path fill="#002395" d="M0 10h30v10H0z" />
                <path fill="#fff" d="m0 0 12 7h18v6H12L0 20z" />
                <path fill="#007a4d" d="m0 0 13 8h17v4H13L0 20z" />
                <path fill="#ffb612" d="m0 3 11 7L0 17z" />
                <path fill="#141414" d="m0 5 8 5-8 5z" />
              </svg>
              <span>+27</span>
            </span>
          )}
          <input
            id={name}
            name={name}
            type={name === 'phone' ? 'tel' : 'text'}
            inputMode={name === 'phone' ? 'tel' : 'text'}
            autoComplete={autocomplete}
            maxLength={name === 'phone' ? 30 : 161}
            required
            aria-invalid={!!errors[name]}
            aria-describedby={errors[name] ? `${name}-error` : undefined}
            placeholder={name === 'phone' ? 'Phone *' : 'Name *'}
            onChange={() => {
              if (errors[name])
                setErrors((current) => {
                  const next = { ...current };
                  delete next[name];
                  return next;
                });
              if (message) setMessage('');
            }}
          />
        </div>
        {fieldError(name)}
      </div>
    );
  }
  return (
    <section className="quote-panel" id="quote" aria-labelledby="quote-title">
      <h2 id="quote-title">{state === 'success' ? 'Thank you!' : 'Get a Quote'}</h2>
      {state === 'success' ? (
        <div className="success-panel" tabIndex={-1} ref={status} role="status">
          <span className="success-mark" aria-hidden="true">
            ✓
          </span>
          <h3>Your request is in.</h3>
          <p>{message}</p>
          <p className="muted">Keep your phone nearby. There’s nothing else you need to submit.</p>
        </div>
      ) : (
        <>
          <form onSubmit={submit} onFocus={begin} noValidate aria-busy={state === 'submitting'}>
            <fieldset disabled={locked}>
              <legend className="sr-only">Your details and eligibility</legend>
              <div className="contact-fields">
                {input('name', 'Name', 'name')}
                {input('phone', 'South African mobile number', 'tel')}
              </div>
              <div className="quote-confirmations">
                <div className="honeypot" aria-hidden="true">
                  <label htmlFor="website">Leave this field empty</label>
                  <input name="website" id="website" tabIndex={-1} autoComplete="off" />
                </div>
              </div>
              <button className="cta submit-button" type="submit" disabled={locked}>
                {state === 'submitting'
                  ? 'SENDING REQUEST…'
                  : state === 'validating'
                    ? 'CHECKING DETAILS…'
                    : 'Get Quote & Qualify'}
              </button>
              <p className="form-note">
                By submitting this form, I confirm that I am 18 or older, have access to a vehicle
                and am employed. I accept the <a href="/terms">terms</a> and{' '}
                <a href="/privacy">privacy notice</a>, and consent to my details being shared with
                the service provider and its authorized partners so that a representative may
                contact me regarding the requested or future products and services.
              </p>
            </fieldset>
            <div
              className={`form-status ${message ? 'has-message' : ''}`}
              role="status"
              aria-live="polite"
              tabIndex={-1}
              ref={status}
            >
              {message}
            </div>
          </form>
        </>
      )}
    </section>
  );
}
