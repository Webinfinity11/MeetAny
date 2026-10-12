// One definition for the paged list, CSV export and legacy cache fallback.
// Company statuses follow verification: verified, documents to review, returned, no documents, all unverified.
const DOCUMENT_STATUSES = { pending: 'pending', returned: 'rejected', no_documents: 'not_submitted' };

export function adminUserFilterParams(status, role = '') {
 const companyOnly = status === 'unverified' || status === 'verified' || status in DOCUMENT_STATUSES;
 return {
  p_role: companyOnly ? 'company' : role || null,
  p_blocked: status === 'blocked' ? true : ['active', 'verified', 'unverified', ...Object.keys(DOCUMENT_STATUSES)].includes(status) ? false : null,
  p_verified: status === 'verified' ? true : status === 'unverified' || status in DOCUMENT_STATUSES ? false : null,
  ...(DOCUMENT_STATUSES[status] ? { p_doc_status: DOCUMENT_STATUSES[status] } : {}),
 };
}

export function adminUserMatchesStatus(user, status) {
 if (!status) return true;
 if (status === 'blocked') return !!user.blocked;
 if (status === 'verified') return user.role === 'company' && !!user.verified && !user.blocked;
 if (status === 'unverified') return user.role === 'company' && !user.verified && !user.blocked;
 if (status in DOCUMENT_STATUSES) return user.role === 'company' && !user.verified && !user.blocked
  && (user.verification_documents_status || user.verificationDocumentsStatus || 'not_submitted') === DOCUMENT_STATUSES[status];
 return !user.blocked;
}
