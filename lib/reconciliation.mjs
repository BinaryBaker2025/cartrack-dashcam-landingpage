import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

function phone(value) {
  if (typeof value !== 'string') return null;
  const parsed = parsePhoneNumberFromString(value, 'ZA');
  return parsed?.country === 'ZA' && parsed.isValid() ? parsed.number : null;
}
function id(value) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim() || null
    : null;
}

// Exact vendor IDs establish a match. Phone-only candidates always require review.
export function reconcile(local, vendor) {
  if (!Array.isArray(local) || !Array.isArray(vendor))
    throw new Error('Both inputs must contain lead arrays.');
  if (
    vendor.some(
      (row) =>
        !row ||
        typeof row !== 'object' ||
        Array.isArray(row) ||
        (!id(row.leadId) && !phone(row.phone1)),
    )
  )
    throw new Error('Each LeadByte row needs a leadId or a valid string phone1.');
  const byId = new Map();
  const byPhone = new Map();
  const localIdCounts = new Map();
  for (const row of local) {
    const key = id(row.leadbyte_lead_id);
    if (key) localIdCounts.set(key, (localIdCounts.get(key) || 0) + 1);
  }
  vendor.forEach((row, index) => {
    const leadId = id(row.leadId);
    const number = phone(row.phone1);
    if (leadId) byId.set(leadId, [...(byId.get(leadId) || []), index]);
    if (number) byPhone.set(number, [...(byPhone.get(number) || []), index]);
  });
  const matched = new Set();
  const results = local.map((row) => {
    const key = id(row.leadbyte_lead_id);
    const exact = key ? byId.get(key) || [] : [];
    let status;
    let candidates = exact;
    if (exact.length > 1 || (key && localIdCounts.get(key) > 1)) status = 'ambiguous_id';
    else if (exact.length === 1) {
      const upstream = vendor[exact[0]];
      matched.add(exact[0]);
      const phoneMismatch = phone(upstream.phone1) && phone(row.phone1) !== phone(upstream.phone1);
      const codeMismatch =
        upstream.code !== undefined &&
        upstream.code !== null &&
        Number(upstream.code) !== row.leadbyte_code;
      status = phoneMismatch || codeMismatch ? 'matched_id_data_mismatch' : 'matched_id';
    } else {
      candidates = byPhone.get(phone(row.phone1)) || [];
      status = candidates.length ? 'phone_candidates_review' : 'not_in_import';
    }
    return {
      requestId: row.request_id,
      leadByteId: key,
      deliveryStatus: row.delivery_status,
      status,
      vendorRowIndexes: candidates,
    };
  });
  return {
    results,
    vendorRowsWithoutExactMatch: vendor
      .map((_, index) => index)
      .filter((index) => !matched.has(index)),
    counts: results.reduce(
      (all, row) => ({ ...all, [row.status]: (all[row.status] || 0) + 1 }),
      {},
    ),
  };
}
