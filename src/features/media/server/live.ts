import { liveTopic, publish, type Topic } from '../../../shared/realtime';
import { MEDIA_CHANGED_EVENT, type MediaAccess } from '../contract';

/** Media's live topic, for whoever may browse the library. */
export function mediaChangedTopic(access: MediaAccess): Topic {
  return liveTopic(MEDIA_CHANGED_EVENT, { rule: access.view });
}

export function announceMediaChanged(access: MediaAccess): void {
  publish(mediaChangedTopic(access));
}
