// Curated car features grouped into categories, shown in the feature picker
// popup. Admins tick what the car has; anything not here can be added custom.
export const FEATURE_CATALOG: Record<string, string[]> = {
  'Comfort & Convenience': [
    'Air Conditioning',
    'Power Windows',
    'Keyless Entry',
    'Push Button Start',
    'Cruise Control',
  ],
  Safety: ['Airbags', 'ABS', 'Parking Sensors', 'Reverse Camera'],
  'Technology & Entertainment': [
    'Touchscreen Infotainment',
    'Apple CarPlay / Android Auto',
    'Bluetooth',
    'USB Charging',
  ],
  'Exterior & Other': ['Sunroof', 'Alloy Wheels', 'LED Headlights'],
};
