'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { validateLead, type FieldErrors } from '@/lib/validation';
import { sessionAttribution } from '@/lib/attribution';
import { track } from '@/lib/analytics';
import { submissionKey } from '@/lib/submissionKey';
import { browserAttempt, browserReceipt, saveBrowserReceipt } from '@/lib/browserState';
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
  const locked =
    state === 'submitting' ||
    state === 'validating' ||
    state === 'success' ||
    state === 'duplicate';
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
    const raw = { ...Object.fromEntries(data), terms: data.get('terms') === 'on' };
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
      form.querySelector<HTMLElement>(`[name="${Object.keys(validation.errors)[0]}"]`)?.focus();
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
      const result = await response.json();
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
      if (next === 'success' || next === 'duplicate')
        saveBrowserReceipt(
          submission.current.id,
          { state: next, message: result.message },
          sessionAttribution(),
        );
      if (result.retryable === true)
        submission.current = { id: await submissionKey(payload, true), payload };
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
  function input(name: 'firstname' | 'lastname' | 'phone', label: string, autocomplete: string) {
    return (
      <div className="field">
        <label htmlFor={name}>{label}</label>
        <input
          id={name}
          name={name}
          type={name === 'phone' ? 'tel' : 'text'}
          inputMode={name === 'phone' ? 'tel' : 'text'}
          autoComplete={autocomplete}
          maxLength={name === 'phone' ? 30 : 80}
          required
          aria-invalid={!!errors[name]}
          aria-describedby={errors[name] ? `${name}-error` : undefined}
          placeholder={name === 'phone' ? 'e.g. 0XX XXX XXXX' : label}
        />
        {fieldError(name)}
      </div>
    );
  }
  function select(
    name: 'age' | 'vehicle' | 'employment' | 'income',
    label: string,
    options: [string, string][],
  ) {
    return (
      <div className="field">
        <label htmlFor={name}>{label}</label>
        <select
          name={name}
          id={name}
          defaultValue=""
          required
          aria-invalid={!!errors[name]}
          aria-describedby={errors[name] ? `${name}-error` : undefined}
        >
          <option value="" disabled>
            Select an option
          </option>
          {options.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
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
          <p className="form-intro">Tell us a little about yourself for a free call back.</p>
          <form onSubmit={submit} onFocus={begin} noValidate aria-busy={state === 'submitting'}>
            <fieldset disabled={locked}>
              <legend className="sr-only">Your details and eligibility</legend>
              <div className="name-fields">
                {input('firstname', 'First name', 'given-name')}
                {input('lastname', 'Last name', 'family-name')}
              </div>
              {input('phone', 'South African mobile number', 'tel')}
              <div className="qualification-fields">
                {select('age', 'Are you 18 or older?', [
                  ['18_plus', 'Yes, I am 18 or older'],
                  ['under_18', 'No, I am under 18'],
                ])}
                {select('vehicle', 'Do you have access to a vehicle?', [
                  ['yes', 'Yes'],
                  ['no', 'No'],
                ])}
                {select('employment', 'Employment status', [
                  ['employed', 'Employed'],
                  ['self_employed', 'Self-employed'],
                  ['unemployed', 'Unemployed'],
                  ['retired', 'Retired'],
                  ['student', 'Student (not employed)'],
                ])}
                {select('income', 'Monthly income', [
                  ['under_10000', 'Under R10,000'],
                  ['10000_19999', 'R10,000 – R19,999'],
                  ['20000_39999', 'R20,000 – R39,999'],
                  ['40000_plus', 'R40,000 or more'],
                ])}
              </div>
              <details className="call-time">
                <summary>
                  Choose a call time <span>(optional)</span>
                </summary>
                <div className="field">
                  <label htmlFor="preferredtimeofcall">Preferred time (South African time)</label>
                  <input
                    type="datetime-local"
                    id="preferredtimeofcall"
                    name="preferredtimeofcall"
                    aria-describedby="call-time-help preferredtimeofcall-error"
                    aria-invalid={!!errors.preferredtimeofcall}
                  />
                  <small id="call-time-help">
                    Within the next 30 days. Subject to availability.
                  </small>
                  <span id="preferredtimeofcall-error" className="field-error">
                    {errors.preferredtimeofcall}
                  </span>
                </div>
              </details>
              <div className="honeypot" aria-hidden="true">
                <label htmlFor="website">Leave this field empty</label>
                <input name="website" id="website" tabIndex={-1} autoComplete="off" />
              </div>
              <label className="consent">
                <input
                  type="checkbox"
                  name="terms"
                  required
                  aria-invalid={!!errors.terms}
                  aria-describedby={errors.terms ? 'terms-error' : undefined}
                />
                <span>
                  I accept the{' '}
                  <a href="/terms" target="_blank" rel="noopener">
                    terms
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" target="_blank" rel="noopener">
                    privacy notice
                  </a>
                  , and consent to my details being shared with CarTrack and its campaign service
                  providers so a representative may contact me about CarTrack Cameras.
                </span>
              </label>
              {fieldError('terms')}
              <button className="cta submit-button" type="submit" disabled={locked}>
                {state === 'submitting'
                  ? 'SENDING REQUEST…'
                  : state === 'validating'
                    ? 'CHECKING DETAILS…'
                    : state === 'duplicate'
                      ? 'ALREADY SUBMITTED'
                      : 'CALL ME BACK'}
              </button>
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
            <p className="form-note">18+ · Vehicle access · Employed · Income R10,000+/month</p>
          </form>
        </>
      )}
    </section>
  );
}
