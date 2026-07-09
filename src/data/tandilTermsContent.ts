export interface LegalSection {
  number?: number;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

export const TANDIL_TERMS_META = {
  title: 'Terms & Conditions',
  effectiveDate: 'July 9, 2026',
};

export const TANDIL_TERMS_INTRO: string[] = [
  'Welcome to Tandil.',
  'These Terms and Conditions (“Terms”) govern your access to and use of the Tandil website, mobile application, and all related services (collectively, the “Platform”).',
  'By accessing or using Tandil, you confirm that you have read, understood, and agree to be legally bound by these Terms. If you do not agree with any part of these Terms, you must not use the Platform.',
];

export const TANDIL_TERMS_SECTIONS: LegalSection[] = [
  {
    number: 1,
    title: 'About Tandil',
    paragraphs: [
      'Tandil is a technology platform that connects customers with qualified agricultural professionals and service providers for residential, commercial, and agricultural properties across the United Arab Emirates.',
      'Services may include, but are not limited to:',
      'Availability of services depends on location, technician availability, weather conditions, and operational capacity.',
    ],
    bullets: [
      'Agricultural inspections',
      'Landscape maintenance',
      'Palm tree maintenance',
      'Tree pruning',
      'Irrigation services',
      'Fertilization',
      'Pest and disease control',
      'Waste removal',
      'Garden cleaning',
      'Agricultural consultations',
      'Sale of agricultural products where available',
    ],
  },
  {
    number: 2,
    title: 'Eligibility',
    paragraphs: ['To use the Platform you must:', 'Tandil reserves the right to suspend or terminate accounts that provide false information.'],
    bullets: [
      'Be at least 18 years old.',
      'Have legal capacity under UAE law.',
      'Provide accurate and complete information.',
      'Use the Platform only for lawful purposes.',
    ],
  },
  {
    number: 3,
    title: 'User Account',
    paragraphs: ['You are responsible for:', 'You must notify Tandil immediately if you suspect unauthorized access.'],
    bullets: [
      'Maintaining the confidentiality of your account.',
      'Keeping your password secure.',
      'All activities performed under your account.',
    ],
  },
  {
    number: 4,
    title: 'Booking Services',
    paragraphs: [
      'When requesting a service:',
      'Submission of a booking request does not guarantee acceptance.',
      'Tandil reserves the right to reject or cancel bookings when necessary.',
    ],
    bullets: [
      'You must provide accurate location details.',
      'You must provide a reachable phone number.',
      'You must ensure safe access to the property.',
      'You must disclose any hazards that may affect technicians.',
    ],
  },
  {
    number: 5,
    title: 'Agricultural Inspection',
    paragraphs: [
      'Inspection services are based on a visual assessment conducted during the scheduled visit.',
      'Inspection findings are professional opinions based on observable conditions at the time of inspection.',
      'The inspection does not guarantee future plant health or future agricultural performance.',
    ],
  },
  {
    number: 6,
    title: 'Pricing',
    paragraphs: [
      'Prices displayed on the Platform include only the services specified.',
      'Additional work requested after inspection may require additional charges.',
      'Tandil reserves the right to update pricing at any time before booking confirmation.',
    ],
  },
  {
    number: 7,
    title: 'Payments',
    paragraphs: [
      'Payments are processed securely through Stripe and other approved payment providers.',
      'Accepted payment methods may include:',
      'Tandil does not store your payment card information.',
      'Payment must be completed before services are confirmed unless otherwise agreed.',
    ],
    bullets: ['Visa', 'Mastercard', 'Apple Pay', 'Other supported payment methods'],
  },
  {
    number: 8,
    title: 'Cancellation',
    paragraphs: [
      'Customers may cancel a booking before technician dispatch.',
      'Late cancellations or cancellations after technician arrival may incur cancellation fees.',
      'If Tandil cancels a booking, the customer will be notified and any eligible refund will be processed.',
    ],
  },
  {
    number: 9,
    title: 'Rescheduling',
    paragraphs: [
      'Customers may request rescheduling based on technician availability.',
      'Tandil cannot guarantee the requested replacement date or time.',
    ],
  },
  {
    number: 10,
    title: 'Refund Policy',
    paragraphs: [
      'Refund eligibility depends on the circumstances.',
      'Refunds may be approved if:',
      'Refunds are not normally available after services have been completed unless required by applicable law.',
      'Approved refunds will be processed using the original payment method.',
      'Processing times depend on the customer’s bank.',
    ],
    bullets: [
      'Payment was duplicated.',
      'Service could not be delivered.',
      'Tandil cancels the service.',
      'Technical payment errors occurred.',
    ],
  },
  {
    number: 11,
    title: 'Customer Responsibilities',
    paragraphs: ['Customers agree to:', 'Failure to do so may result in cancellation.'],
    bullets: [
      'Provide accurate information.',
      'Maintain a safe work environment.',
      'Allow reasonable access.',
      'Follow technician instructions where appropriate.',
      'Ensure pets or animals do not interfere with work.',
      'Inform Tandil of known hazards.',
    ],
  },
  {
    number: 12,
    title: 'Technician Responsibilities',
    paragraphs: ['Technicians are expected to:'],
    bullets: [
      'Arrive professionally.',
      'Perform services according to industry standards.',
      'Respect customer property.',
      'Follow safety procedures.',
      'Complete services within reasonable timeframes.',
    ],
  },
  {
    number: 13,
    title: 'Service Warranty',
    paragraphs: [
      'Warranty applies only to services specifically covered by the selected package.',
      'Warranty does not cover:',
    ],
    bullets: [
      'Natural weather conditions.',
      'Storms.',
      'Floods.',
      'Drought.',
      'Pest reinfestation from neighboring properties.',
      'Customer negligence.',
      'Failure to follow maintenance advice.',
    ],
  },
  {
    number: 14,
    title: 'Agricultural Results',
    paragraphs: [
      'Agriculture depends on many variables including:',
      'Accordingly, Tandil cannot guarantee specific agricultural results.',
    ],
    bullets: ['Weather', 'Soil', 'Irrigation', 'Plant condition', 'Fertilization', 'Previous maintenance', 'Diseases'],
  },
  {
    number: 15,
    title: 'Third-Party Services',
    paragraphs: [
      'Some services may be performed by approved contractors or partners.',
      'Tandil works with qualified providers but is not responsible for delays caused by external parties beyond its reasonable control.',
    ],
  },
  {
    number: 16,
    title: 'Intellectual Property',
    paragraphs: [
      'All content on the Platform including:',
      'is owned by Tandil or licensed to Tandil.',
      'No content may be copied or reproduced without prior written permission.',
    ],
    bullets: ['Logos', 'Text', 'Images', 'Graphics', 'Software', 'Videos', 'Design', 'Branding'],
  },
  {
    number: 17,
    title: 'Prohibited Use',
    paragraphs: ['Users must not:', 'Violations may result in permanent suspension.'],
    bullets: [
      'Submit false bookings.',
      'Abuse technicians.',
      'Upload harmful content.',
      'Attempt unauthorized access.',
      'Reverse engineer the Platform.',
      'Use the Platform for unlawful activities.',
    ],
  },
  {
    number: 18,
    title: 'Limitation of Liability',
    paragraphs: [
      'To the fullest extent permitted by UAE law, Tandil shall not be liable for:',
      'Total liability shall not exceed the amount paid for the relevant service.',
    ],
    bullets: [
      'Indirect damages.',
      'Loss of profits.',
      'Crop losses.',
      'Business interruption.',
      'Delays caused by weather.',
      'Force majeure events.',
      'Government restrictions.',
      'Internet outages.',
    ],
  },
  {
    number: 19,
    title: 'Force Majeure',
    paragraphs: [
      'Tandil shall not be responsible for delays or failures caused by events beyond its reasonable control including:',
    ],
    bullets: [
      'Natural disasters',
      'Floods',
      'Extreme heat',
      'Sandstorms',
      'War',
      'Government actions',
      'Pandemics',
      'Utility failures',
    ],
  },
  {
    number: 20,
    title: 'Privacy',
    paragraphs: ['Use of the Platform is also governed by the Tandil Privacy Policy.'],
  },
  {
    number: 21,
    title: 'Amendments',
    paragraphs: [
      'Tandil may update these Terms at any time.',
      'Updated Terms become effective once published on the Platform.',
      'Continued use constitutes acceptance of the updated Terms.',
    ],
  },
  {
    number: 22,
    title: 'Governing Law',
    paragraphs: [
      'These Terms shall be governed by the laws of the United Arab Emirates.',
      'Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the competent courts of the United Arab Emirates.',
    ],
  },
];
