/**
 * Growth Intent catalogs — dogfood organizing principle above Campaigns.
 * Intents are durable; Campaigns are time-bound executions.
 */

import type { GrowthIntent, GrowthIntentId } from '@joallm/shared';

/** Shared intents most programs inherit */
export const BASE_GROWTH_INTENTS: GrowthIntent[] = [
  {
    id: 'awareness',
    name: 'Awareness',
    purpose: 'Let people know the program exists.',
    examples: [
      'Founder announcement',
      'What is this program?',
      'Why it matters',
      'Problem statements',
      'Success statistics',
      'Behind the scenes',
    ],
    outputChannels: ['LinkedIn', 'Instagram', 'YouTube', 'Website'],
    assetTemplates: ['Announcement', 'Explainer', 'Stat card', 'LinkedIn', 'Instagram', 'Website'],
  },
  {
    id: 'registration',
    name: 'Registration',
    purpose: 'Acquire registrations.',
    examples: [
      'Applications open',
      'Early bird',
      'Limited seats',
      'Batch announcement',
      'Registration reminder',
    ],
    cta: 'Register',
    outputChannels: ['LinkedIn', 'WhatsApp', 'Email', 'Website', 'Instagram'],
    assetTemplates: [
      'Poster',
      'Countdown',
      'Reminder',
      'FAQ',
      'WhatsApp',
      'Email',
      'Landing Hero',
    ],
  },
  {
    id: 'events',
    name: 'Events',
    purpose: 'Promote webinars and workshops.',
    examples: ['Live session', 'AMA', 'Guest speaker', 'Demo Day', 'Workshop'],
    cta: 'Reserve Seat',
    outputChannels: ['LinkedIn', 'WhatsApp', 'Email', 'Instagram', 'Website'],
    assetTemplates: ['Event poster', 'Reminder', 'Speaker card', 'WhatsApp', 'Calendar invite'],
  },
  {
    id: 'community',
    name: 'Community',
    purpose: 'Keep participants engaged.',
    examples: [
      'Weekly update',
      'Mentor spotlight',
      'Community stories',
      'Discord announcement',
      'Events',
    ],
    cta: 'Join Community',
    outputChannels: ['Discord', 'WhatsApp', 'LinkedIn', 'Email'],
    assetTemplates: ['Weekly update', 'Spotlight', 'Invite', 'WhatsApp'],
  },
  {
    id: 'success-stories',
    name: 'Success Stories',
    purpose: 'Build trust.',
    examples: [
      'Student stories',
      'Projects built',
      'Placements',
      'Testimonials',
      'Mentor stories',
    ],
    cta: 'Read Story',
    outputChannels: ['LinkedIn', 'Instagram', 'Website', 'YouTube'],
    assetTemplates: [
      'Student Photo',
      'Quote',
      'Metrics',
      'LinkedIn',
      'Instagram',
      'Website',
    ],
  },
  {
    id: 'partnerships',
    name: 'Partnerships',
    purpose: 'Acquire institutions.',
    examples: [
      'University collaboration',
      'Faculty onboarding',
      'Campus ambassadors',
      'CSR',
    ],
    cta: 'Partner',
    outputChannels: ['LinkedIn', 'Email', 'Website'],
    assetTemplates: ['One-pager', 'Deck slide', 'Email', 'LinkedIn'],
  },
];

/** Amplify with AI dogfood (Hiring stays in HRMS) */
export const AMPLIFY_GROWTH_INTENTS: GrowthIntent[] = [
  {
    id: 'awareness',
    name: 'Awareness',
    purpose: 'Let people know the program exists.',
    examples: [
      'Founder announcement',
      'What is Amplify?',
      'Why AI builders matter',
      'Student problem statements',
      'Success statistics',
      'Behind the scenes',
    ],
    outputChannels: ['LinkedIn', 'Instagram', 'YouTube', 'Website'],
    assetTemplates: ['Announcement', 'Explainer', 'Stat card', 'LinkedIn', 'Instagram', 'Website'],
  },
  {
    id: 'registration',
    name: 'Registration',
    purpose: 'Acquire registrations.',
    examples: [
      'Applications open',
      'Early bird',
      'Limited seats',
      'Batch announcement',
      'Registration reminder',
    ],
    cta: 'Register',
    outputChannels: ['LinkedIn', 'WhatsApp', 'Email', 'Website', 'Instagram'],
    assetTemplates: [
      'Poster',
      'Countdown',
      'Reminder',
      'FAQ',
      'WhatsApp',
      'Email',
      'Landing Hero',
    ],
  },
  {
    id: 'builder-challenge',
    name: 'Builder Challenge',
    purpose: 'Get people to start the Builder Challenge.',
    examples: ['Day 1', 'New challenge released', 'Leaderboard', 'Submission deadline'],
    cta: 'Start Challenge',
    outputChannels: ['WhatsApp', 'Discord', 'LinkedIn', 'Email', 'Website'],
    assetTemplates: ['Challenge card', 'Day brief', 'Leaderboard', 'Reminder', 'WhatsApp'],
  },
  {
    id: 'cohort-conversion',
    name: 'Cohort Conversion',
    purpose: 'Move qualified builders into the cohort.',
    examples: [
      'Interview invitation',
      'Cohort announcement',
      'Welcome messages',
      'Orientation',
    ],
    cta: 'Join Cohort',
    outputChannels: ['Email', 'WhatsApp', 'Website'],
    assetTemplates: ['Invite', 'Welcome', 'Orientation', 'Email', 'WhatsApp'],
  },
  {
    id: 'community',
    name: 'Community',
    purpose: 'Keep builders engaged.',
    examples: [
      'Weekly update',
      'Mentor spotlight',
      'Community stories',
      'Discord announcement',
      'Events',
    ],
    cta: 'Join Community',
    outputChannels: ['Discord', 'WhatsApp', 'LinkedIn', 'Email'],
    assetTemplates: ['Weekly update', 'Spotlight', 'Invite', 'WhatsApp'],
  },
  {
    id: 'events',
    name: 'Events',
    purpose: 'Promote webinars and workshops.',
    examples: ['Live session', 'AMA', 'Guest speaker', 'Demo Day', 'AI Saturday'],
    cta: 'Reserve Seat',
    outputChannels: ['LinkedIn', 'WhatsApp', 'Email', 'Instagram', 'Website'],
    assetTemplates: ['Event poster', 'Reminder', 'Speaker card', 'WhatsApp', 'Calendar invite'],
  },
  {
    id: 'success-stories',
    name: 'Success Stories',
    purpose: 'Build trust.',
    examples: [
      'Student stories',
      'Projects built',
      'Placements',
      'Testimonials',
      'Mentor stories',
    ],
    cta: 'Read Story',
    outputChannels: ['LinkedIn', 'Instagram', 'Website', 'YouTube'],
    assetTemplates: [
      'Student Photo',
      'Quote',
      'Metrics',
      'LinkedIn',
      'Instagram',
      'Website',
    ],
  },
  {
    id: 'partnerships',
    name: 'Partnerships',
    purpose: 'Acquire institutions.',
    examples: [
      'University collaboration',
      'Faculty onboarding',
      'Campus ambassadors',
      'CSR',
    ],
    cta: 'Partner',
    outputChannels: ['LinkedIn', 'Email', 'Website'],
    assetTemplates: ['One-pager', 'Deck slide', 'Email', 'LinkedIn'],
  },
];

export function getIntentsForProgram(programId: string): GrowthIntent[] {
  if (programId === 'amplify-with-ai') {
    return AMPLIFY_GROWTH_INTENTS;
  }
  return BASE_GROWTH_INTENTS;
}

export function getIntentById(
  programId: string,
  intentId: string,
): GrowthIntent | undefined {
  return getIntentsForProgram(programId).find((intent) => intent.id === intentId);
}

export function isGrowthIntentId(value: string): value is GrowthIntentId {
  return (
    value === 'awareness' ||
    value === 'registration' ||
    value === 'builder-challenge' ||
    value === 'cohort-conversion' ||
    value === 'community' ||
    value === 'events' ||
    value === 'success-stories' ||
    value === 'partnerships'
  );
}
