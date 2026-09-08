// Modifiable Ruleset Configuration for Hometown Realitor
export const DEFAULT_RULES = {
  // Neighborhood Theme & Preset
  neighborhoodPreset: 'HOMETOWN_USA', // 'HOMETOWN_USA', 'BEACH_TOWN', 'METRO_HEIGHTS'
  customSpaceNames: {}, // Optional custom name overrides for space IDs (0-39)

  // Building & Development Style
  buildingStyle: 'TINY_MANSION', // 'TINY_MANSION', 'RV_RESORT', 'COTTAGE_ESTATE', 'URBAN_HIGHRISE'

  // House Rule: All taxes, court fees, and card fines go to central Town Square pot
  freeParkingJackpot: true,
  freeParkingSeed: 100, // starting pot amount

  // House Rule: Collect $400 ($200 + $200 bonus) if landing directly on PAYDAY
  doubleGoBonus: true,

  // House Rule: Players detained in City Hall cannot collect rent
  noRentInJail: false,

  // House Rule: Rolling Snake Eyes (1 + 1) awards instant cash bonus
  snakeEyesBonus: true,
  snakeEyesReward: 500,

  // House Rule: When landing on opponent property, debtor can negotiate rent (enabled by default)
  rentNegotiation: true,

  // House Rule: If player passes on unowned property, auction to highest bidder (disabled by default)
  auctionsEnabled: false,

  // Starting money
  startingCash: 1500,

  // Housing shortages enforced (32 single units, 12 top tier units)
  unlimitedHouses: false,

  // House Rule: Can build on individual properties without complete color group
  buildWithoutMonopoly: false,

  // House Rule: Fast game / Mercy rule net worth target (0 = disabled, e.g. 4000)
  mercyRuleNetWorth: 0
};

export const RULES_METADATA = [
  {
    key: 'neighborhoodPreset',
    label: 'Neighborhood Theme',
    type: 'select',
    default: 'HOMETOWN_USA',
    options: [
      { value: 'HOMETOWN_USA', label: 'Hometown USA (Suburban Streets)' },
      { value: 'BEACH_TOWN', label: 'Sunny Beach Bay (Coastal Piers & Way)' },
      { value: 'METRO_HEIGHTS', label: 'Downtown Metro Heights (Avenues & Financial)' }
    ],
    desc: 'Select the neighborhood street preset or customize individual street names.'
  },
  {
    key: 'buildingStyle',
    label: 'Building & Development Style',
    type: 'select',
    default: 'TINY_MANSION',
    options: [
      { value: 'TINY_MANSION', label: '🛖 Tiny Home ➔ 🏰 Luxury Mansion' },
      { value: 'RV_RESORT', label: '🏕️ RV Lot / Park ➔ 🏖️ Glamping Resort' },
      { value: 'COTTAGE_ESTATE', label: '🏡 Bungalow ➔ 🏛️ Grand Estate' },
      { value: 'URBAN_HIGHRISE', label: '🏢 Walkup Apartment ➔ 🏙️ Sky Penthouse' }
    ],
    desc: 'Change how properties develop from tier 1 to tier 5 (replacing traditional houses and hotels).'
  },
  {
    key: 'freeParkingJackpot',
    label: 'Town Square Jackpot (Free Parking)',
    type: 'boolean',
    default: true,
    desc: 'Taxes, permit fees, and Travel/City Council fines are collected into the central pot. Landing on Town Square wins the pot!'
  },
  {
    key: 'freeParkingSeed',
    label: 'Town Square Seed Cash',
    type: 'number',
    default: 100,
    min: 0,
    max: 1000,
    step: 50,
    desc: 'Initial money seeded in the Town Square pot at the start and after a win.'
  },
  {
    key: 'doubleGoBonus',
    label: 'Double Salary on PAYDAY ($400)',
    type: 'boolean',
    default: true,
    desc: 'Collect standard $200 when passing PAYDAY, but collect $400 if landing directly on PAYDAY!'
  },
  {
    key: 'noRentInJail',
    label: 'No Rent While Detained (City Hall)',
    type: 'boolean',
    default: false,
    desc: 'Players detained at City Hall cannot collect rent from other players.'
  },
  {
    key: 'snakeEyesBonus',
    label: 'Lucky Roller (Snake Eyes $500)',
    type: 'boolean',
    default: true,
    desc: 'Rolling double ones (1-1) awards a lucky $500 cash payout from the town treasury.'
  },
  {
    key: 'rentNegotiation',
    label: 'Rent & Debt Negotiation',
    type: 'boolean',
    default: true,
    desc: 'When landing on an opponent\'s property, the debtor can negotiate the rent (offer a cash compromise, property deed trade, or civic pass) before payment.'
  },
  {
    key: 'auctionsEnabled',
    label: 'Property Auctions (On Decline)',
    type: 'boolean',
    default: false,
    desc: 'When enabled, declining an unowned property puts it up for public auction. When disabled (default house rule), declining leaves it unowned.'
  },
  {
    key: 'startingCash',
    label: 'Starting Cash ($)',
    type: 'number',
    default: 1500,
    min: 500,
    max: 3000,
    step: 250,
    desc: 'Cash distributed to each player at the start of the game.'
  },
  {
    key: 'unlimitedHouses',
    label: 'Unlimited Development Units',
    type: 'boolean',
    default: false,
    desc: 'Disable the 32-unit / 12-top-tier scarcity limit so players can always build.'
  },
  {
    key: 'buildWithoutMonopoly',
    label: 'Build Without Full Monopolies',
    type: 'boolean',
    default: false,
    desc: 'Allows constructing units on single properties without owning the full neighborhood set.'
  },
  {
    key: 'mercyRuleNetWorth',
    label: 'Mercy Rule / Target Wealth ($)',
    type: 'number',
    default: 0,
    min: 0,
    max: 10000,
    step: 500,
    desc: 'First player to reach this net worth wins immediately (set to 0 for classic last-man-standing).'
  }
];

export function sanitizeRules(userRules = {}) {
  const sanitized = { ...DEFAULT_RULES };
  for (const meta of RULES_METADATA) {
    if (userRules[meta.key] !== undefined) {
      if (meta.type === 'boolean') {
        sanitized[meta.key] = Boolean(userRules[meta.key]);
      } else if (meta.type === 'number') {
        const num = Number(userRules[meta.key]);
        if (!isNaN(num)) {
          sanitized[meta.key] = Math.max(meta.min ?? 0, Math.min(meta.max ?? 10000, num));
        }
      } else if (meta.type === 'select') {
        const validValues = meta.options.map(o => o.value);
        if (validValues.includes(userRules[meta.key])) {
          sanitized[meta.key] = userRules[meta.key];
        }
      }
    }
  }

  // Preserve custom space names if provided as an object
  if (userRules.customSpaceNames && typeof userRules.customSpaceNames === 'object') {
    sanitized.customSpaceNames = { ...userRules.customSpaceNames };
  }

  return sanitized;
}
