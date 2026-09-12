export const WEBSITE_URL = 'https://projectyouplus.com';
export const WEBSITE_DESCRIPTION = 'Project You+ connects your goals, schedule, health, habits and finances to show where you are, what matters today and whether you’re actually moving forward.';
export const websiteStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${WEBSITE_URL}/#organization`, name: 'Project You+', url: WEBSITE_URL, logo: { '@type': 'ImageObject', url: `${WEBSITE_URL}/website/icon.png` }, description: WEBSITE_DESCRIPTION },
    { '@type': 'WebSite', '@id': `${WEBSITE_URL}/#website`, name: 'Project You+', alternateName: ['YOU+', 'Project You Plus'], url: WEBSITE_URL, inLanguage: 'en', publisher: { '@id': `${WEBSITE_URL}/#organization` } },
    { '@type': 'WebPage', '@id': `${WEBSITE_URL}/#webpage`, url: WEBSITE_URL, name: 'Project You+ — Your AI Life Operating System', description: WEBSITE_DESCRIPTION, inLanguage: 'en', isPartOf: { '@id': `${WEBSITE_URL}/#website` }, about: { '@id': `${WEBSITE_URL}/#organization` }, primaryImageOfPage: { '@type': 'ImageObject', url: `${WEBSITE_URL}/website/social.png`, width: 1200, height: 630 } },
  ],
};
export function serializeStructuredData(value: unknown) { return JSON.stringify(value).replace(/</g,'\\u003c'); }
