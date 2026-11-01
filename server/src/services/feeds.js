export const SECTIONS = {
  national: { label: 'National', blurb: 'Polity, governance & the states' },
  world: { label: 'World', blurb: 'Diplomacy & international affairs' },
  business: { label: 'Business', blurb: 'Economy, markets & policy' },
  scitech: { label: 'Science & Tech', blurb: 'Space, research & technology' },
  environment: { label: 'Environment', blurb: 'Climate, wildlife & ecology' },
  health: { label: 'Health', blurb: 'Public health & medicine' },
  sports: { label: 'Sports', blurb: 'Cricket, Olympics & beyond' },
  education: { label: 'Education', blurb: 'Exams, campuses & policy' },
  opinion: { label: 'Opinion', blurb: 'Editorials & analysis' },
  entertainment: { label: 'Culture', blurb: 'Cinema, music & the arts' },
};

export const SOURCES = {
  pib: { name: 'Press Information Bureau', short: 'PIB', home: 'https://pib.gov.in', credit: 'Press Information Bureau (PIB), Government of India' },
  air: { name: 'News On AIR', short: 'AIR', home: 'https://www.newsonair.gov.in', credit: 'News On AIR, All India Radio (Prasar Bharati)' },
  toi: { name: 'The Times of India', short: 'TOI', home: 'https://timesofindia.indiatimes.com', credit: 'The Times of India' },
  hindu: { name: 'The Hindu', short: 'TH', home: 'https://www.thehindu.com', credit: 'The Hindu' },
  archive: { name: 'Demo Archive', short: 'ARC', home: null, credit: null },
};

export const FEEDS = [
  { id: 'pib-releases', source: 'pib', section: 'auto', url: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3' },
  { id: 'toi-top', source: 'toi', section: 'auto', url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms' },
  { id: 'hindu-national', source: 'hindu', section: 'auto', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
];

export const ALLOWED_HOSTS = [
  'pib.gov.in',
  'newsonair.gov.in',
  'timesofindia.indiatimes.com',
  'indiatimes.com',
  'thehindu.com',
  'thgim.com',
];

export function isAllowedHost(hostname) {
  const h = String(hostname).toLowerCase();
  return ALLOWED_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
}