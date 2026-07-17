export type AppInfoAudience = 'client' | 'vendor';

export type AppInfoPageKey =
  | 'who_we_are'
  | 'privacy_policy'
  | 'terms_conditions'
  | 'contact_us';

export type AppContentPageKey = 'privacy_policy' | 'terms_conditions' | 'contact_us';

export const APP_INFO_PAGE_SLUG: Record<AppInfoPageKey, string> = {
  who_we_are: 'who-we-are',
  privacy_policy: 'privacy-policy',
  terms_conditions: 'terms-and-conditions',
  contact_us: 'contact-us',
};

export const APP_CONTENT_PAGE_SLUG: Record<AppInfoAudience, Record<AppContentPageKey, string>> = {
  client: {
    privacy_policy: 'privacy-policy',
    terms_conditions: 'terms-and-conditions',
    contact_us: 'contact-us',
  },
  vendor: {
    privacy_policy: 'privacy-policy',
    terms_conditions: 'terms-and-conditions',
    contact_us: 'contact-us',
  },
};

export interface AppContactInfo {
  company?: string;
  website?: string;
  websiteLabel?: string;
  email?: string;
  phone?: string;
  whatsappDisplay?: string;
  whatsappDial?: string;
  country?: string;
  heroTitle?: string;
  heroText?: string;
  note?: string;
}

export const DEFAULT_CLIENT_CONTACT: AppContactInfo = {
  company: 'Tandil',
  website: 'https://tandil.ae',
  websiteLabel: 'tandil.ae',
  email: 'support@tandil.com',
  phone: '+971569206959',
  whatsappDisplay: '+971 569206959',
  whatsappDial: '+971569206959',
  country: 'United Arab Emirates',
  heroTitle: 'Get in touch with Tandil',
  heroText: 'Our support team is here to help with orders, services, and account questions.',
  note: 'Our support team typically responds within 24–48 hours on business days.',
};

export const DEFAULT_VENDOR_CONTACT: AppContactInfo = {
  company: 'Tandil',
  website: 'https://tandil.ae',
  websiteLabel: 'tandil.ae',
  email: 'info@tandil.ae',
  whatsappDisplay: '+971 569206959',
  whatsappDial: '+971569206959',
  country: 'United Arab Emirates',
  heroTitle: 'Get in touch with Tandil',
  heroText:
    'For any questions regarding these Terms, please contact us using any of the options below.',
  note: 'Our support team typically responds within 24–48 hours on business days.',
};
