// One definition for the paged list, CSV export and legacy cache fallback.
export function adminUserFilterParams(status, role = '') {
 return {
  p_role: status === 'unverified' ? 'company' : role || null,
  p_blocked: status === 'blocked' ? true : ['active', 'verified', 'unverified'].includes(status) ? false : null,
  p_verified: status === 'verified' ? true : status === 'unverified' ? false : null,
 };
}

export function adminUserMatchesStatus(user, status) {
 if (!status) return true;
 if (status === 'blocked') return !!user.blocked;
 if (status === 'verified') return user.role === 'company' && !!user.verified && !user.blocked;
 if (status === 'unverified') return user.role === 'company' && !user.verified && !user.blocked;
 return !user.blocked;
}
