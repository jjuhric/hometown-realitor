// 40 Board Spaces Definition for Hometown Realitor (Original & Legal)

export const COLOR_GROUPS = {
  BROWN: { name: 'Brown', hex: '#8B4513', count: 2 },
  LIGHT_BLUE: { name: 'Light Blue', hex: '#87CEEB', count: 3 },
  PINK: { name: 'Pink', hex: '#DA70D6', count: 3 },
  ORANGE: { name: 'Orange', hex: '#FFA500', count: 3 },
  RED: { name: 'Red', hex: '#FF0000', count: 3 },
  YELLOW: { name: 'Yellow', hex: '#FFD700', count: 3 },
  GREEN: { name: 'Green', hex: '#228B22', count: 3 },
  DARK_BLUE: { name: 'Dark Blue', hex: '#00008B', count: 2 },
  RAILROAD: { name: 'Transit Line', hex: '#4A4A4A', count: 4 },
  UTILITY: { name: 'Town Service', hex: '#A0A0A0', count: 2 }
};

export const BOARD_SPACES = [
  { id: 0, name: 'PAYDAY', type: 'go', desc: 'Collect $200 Salary as you pass' },
  { id: 1, name: 'Maple Street', type: 'street', group: 'BROWN', price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50, mortgage: 30 },
  { id: 2, name: 'City Council', type: 'community_chest' },
  { id: 3, name: 'Elm Avenue', type: 'street', group: 'BROWN', price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50, mortgage: 30 },
  { id: 4, name: 'HOA Annual Dues', type: 'tax', amount: 200, desc: 'Pay $200' },
  { id: 5, name: 'Downtown Express Bus', type: 'railroad', group: 'RAILROAD', price: 200, rent: [25, 50, 100, 200], mortgage: 100 },
  { id: 6, name: 'Oak Lane', type: 'street', group: 'LIGHT_BLUE', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgage: 50 },
  { id: 7, name: 'Travel', type: 'chance' },
  { id: 8, name: 'Cedar Boulevard', type: 'street', group: 'LIGHT_BLUE', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgage: 50 },
  { id: 9, name: 'Pine Way', type: 'street', group: 'LIGHT_BLUE', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50, mortgage: 60 },
  { id: 10, name: 'City Hall / Detained', type: 'jail' },
  { id: 11, name: 'Walnut Street', type: 'street', group: 'PINK', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgage: 70 },
  { id: 12, name: 'Power & Light Co.', type: 'utility', group: 'UTILITY', price: 150, mortgage: 75 },
  { id: 13, name: 'Spruce Avenue', type: 'street', group: 'PINK', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgage: 70 },
  { id: 14, name: 'Birch Lane', type: 'street', group: 'PINK', price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100, mortgage: 80 },
  { id: 15, name: 'Crosstown Commuter Rail', type: 'railroad', group: 'RAILROAD', price: 200, rent: [25, 50, 100, 200], mortgage: 100 },
  { id: 16, name: 'Willow Court', type: 'street', group: 'ORANGE', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgage: 90 },
  { id: 17, name: 'City Council', type: 'community_chest' },
  { id: 18, name: 'Cypress Drive', type: 'street', group: 'ORANGE', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgage: 90 },
  { id: 19, name: 'Magnolia Way', type: 'street', group: 'ORANGE', price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100, mortgage: 100 },
  { id: 20, name: 'Town Square', type: 'free_parking' },
  { id: 21, name: 'Hickory Street', type: 'street', group: 'RED', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgage: 110 },
  { id: 22, name: 'Travel', type: 'chance' },
  { id: 23, name: 'Sycamore Avenue', type: 'street', group: 'RED', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgage: 110 },
  { id: 24, name: 'Chestnut Boulevard', type: 'street', group: 'RED', price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150, mortgage: 120 },
  { id: 25, name: 'North Suburban Rail', type: 'railroad', group: 'RAILROAD', price: 200, rent: [25, 50, 100, 200], mortgage: 100 },
  { id: 26, name: 'Ash Way', type: 'street', group: 'YELLOW', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgage: 130 },
  { id: 27, name: 'Beech Street', type: 'street', group: 'YELLOW', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgage: 130 },
  { id: 28, name: 'Municipal Water Works', type: 'utility', group: 'UTILITY', price: 150, mortgage: 75 },
  { id: 29, name: 'Poplar Avenue', type: 'street', group: 'YELLOW', price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150, mortgage: 140 },
  { id: 30, name: 'Report to City Hall', type: 'go_to_jail' },
  { id: 31, name: 'Alder Lane', type: 'street', group: 'GREEN', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgage: 150 },
  { id: 32, name: 'Redwood Boulevard', type: 'street', group: 'GREEN', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgage: 150 },
  { id: 33, name: 'City Council', type: 'community_chest' },
  { id: 34, name: 'Juniper Way', type: 'street', group: 'GREEN', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200, mortgage: 160 },
  { id: 35, name: 'Metro Rapid Transit', type: 'railroad', group: 'RAILROAD', price: 200, rent: [25, 50, 100, 200], mortgage: 100 },
  { id: 36, name: 'Travel', type: 'chance' },
  { id: 37, name: 'Sunset Strip', type: 'street', group: 'DARK_BLUE', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200, mortgage: 175 },
  { id: 38, name: 'City Beautification Fee', type: 'tax', amount: 100, desc: 'Pay $100' },
  { id: 39, name: 'Grand Boulevard', type: 'street', group: 'DARK_BLUE', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200, mortgage: 200 }
];

// Travel Cards (formerly Chance)
export const CHANCE_CARDS = [
  { id: 'tr_payday', text: 'Road trip across town! Advance to PAYDAY (Collect $200).', action: 'advance', target: 0 },
  { id: 'tr_chestnut', text: 'Catch the local shuttle to Chestnut Boulevard.', action: 'advance', target: 24 },
  { id: 'tr_walnut', text: 'Head over to Walnut Street.', action: 'advance', target: 11 },
  { id: 'tr_utility', text: 'Take a service call to nearest Town Utility. If unowned, you may buy it. If owned, pay owner 10x dice roll.', action: 'advance_nearest_utility' },
  { id: 'tr_transit', text: 'Hop on the nearest Transit Line. If unowned, you may buy it. If owned, pay owner twice normal fare.', action: 'advance_nearest_railroad' },
  { id: 'tr_solar_rebate', text: 'State green solar energy rebate: Collect $50.', action: 'collect', amount: 50 },
  { id: 'tr_detained_free', text: 'Civic Pass: Get Out of City Hall Detained free. Keep until needed.', action: 'jail_free' },
  { id: 'tr_detour', text: 'Construction detour! Move back 3 spaces.', action: 'back', count: 3 },
  { id: 'tr_code_citation', text: 'Municipal Code Violation! Report directly to City Hall. Do not pass Payday, do not collect $200.', action: 'go_jail' },
  { id: 'tr_roof_repairs', text: 'Neighborhood storm cleanup: For each tiny home/unit pay $25, for each mansion/resort pay $100.', action: 'repairs', house: 25, hotel: 100 },
  { id: 'tr_speeding', text: 'School zone speed camera ticket! Pay $15.', action: 'pay', amount: 15 },
  { id: 'tr_downtown_bus', text: 'Take the Downtown Express Bus route.', action: 'advance', target: 5 },
  { id: 'tr_block_party', text: 'You organized the annual Neighborhood Block Party! Pay each neighbor $50.', action: 'pay_players', amount: 50 },
  { id: 'tr_home_appraisal', text: 'Home appraisal came in high! Collect $150 equity payout.', action: 'collect', amount: 150 },
  { id: 'tr_grand_blvd', text: 'Take an evening stroll down Grand Boulevard. Advance to Grand Boulevard.', action: 'advance', target: 39 }
];

// City Council Cards (formerly Community Chest)
export const COMMUNITY_CHEST_CARDS = [
  { id: 'cc_payday', text: 'Direct deposit cleared! Advance to PAYDAY (Collect $200).', action: 'advance', target: 0 },
  { id: 'cc_grant', text: 'City Council approves your historic neighborhood preservation grant: Collect $200.', action: 'collect', amount: 200 },
  { id: 'cc_permit_fee', text: 'Building inspector zoning fee: Pay $50.', action: 'pay', amount: 50 },
  { id: 'cc_yard_sale', text: 'Neighborhood yard sale success! Collect $50.', action: 'collect', amount: 50 },
  { id: 'cc_detained_free', text: 'City Council pardon: Get Out of City Hall Detained free. Keep until needed.', action: 'jail_free' },
  { id: 'cc_detained', text: 'Summoned to City Council for code violation hearings! Report to City Hall.', action: 'go_jail' },
  { id: 'cc_farmers_market', text: 'Local Farmers Market vendor earnings: Collect $100.', action: 'collect', amount: 100 },
  { id: 'cc_property_tax_refund', text: 'Annual property tax assessment refund: Collect $20.', action: 'collect', amount: 20 },
  { id: 'cc_block_birthday', text: 'Neighborhood block milestone celebration! Collect $10 gift from every neighbor.', action: 'collect_players', amount: 10 },
  { id: 'cc_home_insurance', text: 'Roof warranty claim pays out: Collect $100.', action: 'collect', amount: 100 },
  { id: 'cc_sidewalk_paving', text: 'Assessed for community sidewalk replacement: Pay $100.', action: 'pay', amount: 100 },
  { id: 'cc_school_donation', text: 'Donation to local high school marching band: Pay $50.', action: 'pay', amount: 50 },
  { id: 'cc_consulting', text: 'Local architectural consultation fee: Collect $25.', action: 'collect', amount: 25 },
  { id: 'cc_street_paving', text: 'City street resurfacing assessment: Pay $40 per unit, $115 per mansion/resort.', action: 'repairs', house: 40, hotel: 115 },
  { id: 'cc_garden_show', text: 'Won 1st Prize in the Town Garden & Lawn Contest! Collect $10.', action: 'collect', amount: 10 },
  { id: 'cc_estate_inheritance', text: 'Family estate trust matures: Collect $100.', action: 'collect', amount: 100 }
];
