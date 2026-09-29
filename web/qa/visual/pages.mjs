// Keep masks explicit and reviewable: these areas are excluded from pixel comparison.
export const masks = [
  'time', '.request-detail .detail-meta__line:last-child', '.company-profile-activity', '.request-card-meta',
  '.request-card-status > span:not(.request-card-offers)', '.request-detail-summary > span',
  '.request-detail-facts > div:has(dt:text-is("ვადა")) dd',
  '.request-detail-facts > div:has(dt:text-is("საჭიროა თარიღამდე")) dd',
  '.account-row__meta', '.ma-ocard .ma-meta',
  'td[data-label="მოთხოვნა"] > small', '.inbox-day',
  '.ma-chat-unread', 'button[aria-controls="notification-list"]', '.ma-tab[href*="tab=messages"]', '.inbox-dot',
  '#profile-phone', 'input[type="tel"]', 'a[href^="tel:"]',
  'td[data-label="კონტაქტი"]', '.account-idline dd', '[data-visual-private]',
];
export const viewports = [{ width: 1440, height: 1000 }, { width: 390, height: 844 }];
const page = (id, role, route, action, ready) => ({ id, role, route, action, ready });
export const pages = [
  page('guest-home', 'guest', '/'),
  page('guest-requests', 'guest', '/requests/', null, '.card-main-link'),
  page('guest-companies', 'guest', '/companies/', null, '.card-main-link'),
  page('guest-request-detail', 'guest', 'request', null, '.request-detail-facts'),
  page('guest-company-profile', 'guest', 'company', null, '.company-profile'),
  page('guest-login', 'guest', '/account/', null, '#login-email'),
  page('guest-register', 'guest', '/account/?tab=register', null, '#reg-name'),
  page('guest-terms', 'guest', '/terms/'),
  page('guest-404', 'guest', '/nosuch/'),
  page('client-account', 'hotel', '/account/', null, '.account-row__link'),
  page('client-saved', 'hotel', '/account/?tab=saved'),
  page('client-messages', 'hotel', '/account/?tab=messages', null, '.inbox-row'),
  page('client-conversation', 'hotel', '/account/?tab=messages', 'conversation', '.inbox-row'),
  page('client-profile', 'hotel', '/account/?tab=profile', null, '#profile-phone'),
  page('client-request-new', 'hotel', '/requests/new/', null, '#new-request[open] #title'),
  page('client-request-detail', 'hotel', 'ownRequest', null, '.request-detail-facts'),
  page('company-account', 'supply', '/account/'),
  page('company-profile', 'supply', '/account/?tab=profile', null, '#profile-phone'),
  page('company-offer', 'supply', 'offerRequest', 'offer', '.request-detail-facts'),
  page('company-chat', 'supply', 'chatRequest', 'chat', '.request-detail-facts'),
  ...['requests', 'users', 'audit', 'contacts'].map(tab => page(`admin-${tab}`, 'owner_admin', `/admin/?tab=${tab}${tab === 'requests' ? '&q=' + encodeURIComponent('სასტუმრო') : tab === 'users' ? '&role=client&q=demo-hotel%40meetany.ge' : tab === 'contacts' ? '&period=day&kind=call' : ''}`, null, '.ma-table')),
];
