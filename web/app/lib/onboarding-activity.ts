import type { Store } from './market-client';
import type { OnboardStep } from './onboarding-client';

type Event = 'view' | 'saved' | 'deferred' | 'completed' | 'validation_error';
let queue: Promise<unknown> = Promise.resolve();
/** Only step/event names go to analytics. Failure must never block setup. */
export function trackOnboarding(store: Store, step: OnboardStep, event: Event) {
  queue = queue.catch(() => {}).then(() => store.callRpc('record_onboarding_activity', { p_step: step, p_event: event })).catch(() => {});
}
