const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const REGISTRATION_STAGES = ['form_open','form_started','form_submitted','email_pending','profile_created'];
export const REGISTRATION_SOURCES = ['direct','header','request','company','account','unknown'];
export const REGISTRATION_DEVICES = ['mobile','tablet','desktop','unknown'];
export function validRegistrationEvent(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length >= 4 && Object.keys(value).length <= 6
    && Object.keys(value).every(key => ['eventId','sessionId','role','stage','source','device'].includes(key))
    && typeof value.eventId === 'string' && UUID.test(value.eventId)
    && typeof value.sessionId === 'string' && UUID.test(value.sessionId)
    && ['client','company'].includes(value.role) && REGISTRATION_STAGES.includes(value.stage)
    && (!Object.hasOwn(value,'source') || REGISTRATION_SOURCES.includes(value.source))
    && (!Object.hasOwn(value,'device') || REGISTRATION_DEVICES.includes(value.device));
}
