export interface AddonDefinition {
  id: string;
  family: string;
  itemPriceId: string;
  displayName: string;
  price: number;
  billingPeriod: string;
  headline: string;
  bullets: string[];
  upsellMessage: string;
  retentionMessage: string;
  retentionBullets: string[];
  icon: 'travel' | 'shield' | 'speed' | 'support';
}

export const AVAILABLE_ADDONS: AddonDefinition[] = [
  {
    id: 'travel-addon',
    family: 'travel',
    itemPriceId: 'Updated-Nomad-Travel-1995-USD-Monthly',
    displayName: 'Nomad Travel Add-on',
    price: 19.95,
    billingPeriod: 'month',
    headline: 'Stay connected wherever you roam',
    bullets: [
      'Use your internet service while traveling anywhere in the US',
      'Seamless connectivity across different locations',
      'Enables subscription pause when you need a break',
      'No interruptions to your service when you move',
    ],
    upsellMessage: 'Most popular add-on! Perfect for customers who travel or plan to pause their service in the future.',
    retentionMessage: 'Are you sure? Without the Travel Add-on, you will lose the ability to pause your subscription and use your service while traveling.',
    retentionBullets: [
      'You will no longer be able to pause your subscription',
      'Traveling with your device may cause service interruptions',
      'You will need to re-purchase this add-on if you change your mind',
      'Your prorated refund for the remaining period will be applied',
    ],
    icon: 'travel',
  },
  {
    id: 'prime-upgrade',
    family: 'prime',
    itemPriceId: 'Nomad-Prime-10-USD-Monthly',
    displayName: 'Nomad Prime Upgrade',
    price: 10.00,
    billingPeriod: 'month',
    headline: 'Priority support & device protection',
    bullets: [
      'Priority customer support — skip the line and get help faster',
      'Accidental device damage coverage (~$500 MSRP value)',
      'One full device replacement per year at no extra cost',
      'Peace of mind knowing your equipment is protected',
    ],
    upsellMessage: 'Protect your investment! Prime covers accidental damage to your device and gets you priority support — most customers add this for peace of mind.',
    retentionMessage: 'Are you sure? Without Prime, you will lose priority support access and your device damage coverage. If your device is damaged, you would need to pay the full replacement cost (~$500).',
    retentionBullets: [
      'You will lose priority customer support access',
      'No more accidental device damage coverage',
      'Device replacement would cost ~$500 out of pocket',
      'You will need to re-purchase Prime if you change your mind',
      'Your prorated refund for the remaining period will be applied',
    ],
    icon: 'shield',
  },
];

export const TRAVEL_ADDON_FAMILY_MATCHERS = [
  'travel-upgrade',
  'travel-modem',
  'nomad-travel',
];

export const TRAVEL_ADDON_EXACT_IDS = [
  'Updated-Nomad-Travel-1995-USD-Monthly',
  'Nomad-Travel-Upgrade-1000-USD-Monthly',
  'Nomad-Travel-Upgrade-1000',
  'Nomad-Travel-Upgrade-10.00',
  'Travel-Pause-Service-USD-Monthly',
];

export const PRIME_ADDON_FAMILY_MATCHERS = [
  'nomad-prime',
  'prime-upgrade',
  'prime-founders',
];

export const PRIME_ADDON_EXACT_IDS = [
  'Updated-Nomad-Prime-1995-USD-Monthly',
  'Nomad-Prime-Upgrade-1000-USD-Monthly',
  'Nomad-Prime-Upgrade-1000',
  'Nomad-Prime-Upgrade-10.00',
  'Nomad-Prime-10-USD-Monthly',
  'Nomad-Prime-Full-USD-Monthly',
  'Nomad-Prime-Founders-Plan-USD-Monthly',
  'Nomad-Prime-Oasis-Upgrade-USD-Monthly',
  'Nomad-Prime-Oasis-Upgrade-USD-Yearly',
  'Oasis--Prime-yearly-999-USD-Monthly',
  'Oasis--Prime-yearly-999-USD-Yearly',
];

export function isAddonInFamily(itemPriceId: string, family: string): boolean {
  const lower = itemPriceId.toLowerCase();
  if (family === 'travel') {
    if (TRAVEL_ADDON_FAMILY_MATCHERS.some(m => lower.includes(m))) return true;
    if (TRAVEL_ADDON_EXACT_IDS.includes(itemPriceId)) return true;
    if (lower.includes('travel-pause')) return true;
  }
  if (family === 'prime') {
    if (PRIME_ADDON_FAMILY_MATCHERS.some(m => lower.includes(m))) return true;
    if (PRIME_ADDON_EXACT_IDS.includes(itemPriceId)) return true;
  }
  return false;
}

export function getAddonByFamily(family: string): AddonDefinition | null {
  return AVAILABLE_ADDONS.find(a => a.family === family) || null;
}

export function getAvailableAddonsForSubscription(
  currentItems: Array<{ itemPriceId: string; itemType: string }>
): { available: AddonDefinition[]; alreadyActive: AddonDefinition[] } {
  const available: AddonDefinition[] = [];
  const alreadyActive: AddonDefinition[] = [];

  for (const addon of AVAILABLE_ADDONS) {
    const hasIt = currentItems.some(item =>
      item.itemType === 'addon' && isAddonInFamily(item.itemPriceId, addon.family)
    );
    if (hasIt) {
      alreadyActive.push(addon);
    } else {
      available.push(addon);
    }
  }

  return { available, alreadyActive };
}
