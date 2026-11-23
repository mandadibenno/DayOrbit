// Shopping helpers: split "Milk 2 L" into name + quantity, and guess an aisle.

const UNITS = '(?:kg|kgs|g|gm|gms|grams?|l|ltr|litres?|liters?|ml|pcs?|pieces?|dozen|packs?|packets?|bunch(?:es)?|bottles?|cans?|x)';
const TRAILING = new RegExp(`^(.*?)[\\s,]+(\\d+(?:[.,]\\d+)?\\s*${UNITS}?)$`, 'i');
const LEADING = new RegExp(`^(\\d+(?:[.,]\\d+)?\\s*${UNITS}?)\\s+(.+)$`, 'i');

export function parseItem(text) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  let m = t.match(TRAILING);
  if (m && m[1]) return { name: tidy(m[1]), quantity: m[2].trim() };
  m = t.match(LEADING);
  if (m) return { name: tidy(m[2]), quantity: m[1].trim() };
  return { name: tidy(t), quantity: null };
}

const tidy = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const SECTIONS = ['Fruits & veg', 'Dairy', 'Bakery', 'Pantry', 'Household', 'Other'];

const RULES = [
  { section: 'Fruits & veg', icon: 'tomato', words: ['tomato'] },
  { section: 'Fruits & veg', icon: 'banana', words: ['banana'] },
  { section: 'Fruits & veg', icon: 'apple', words: ['apple', 'mango', 'orange', 'grape', 'papaya', 'guava', 'pomegranate', 'fruit'] },
  { section: 'Fruits & veg', icon: 'onion', words: ['onion', 'garlic', 'potato', 'ginger', 'beetroot'] },
  { section: 'Fruits & veg', icon: 'leaf', words: ['coriander', 'dhania', 'mint', 'spinach', 'palak', 'methi', 'lettuce', 'cabbage', 'beans', 'peas', 'carrot', 'cucumber', 'chilli', 'okra', 'bhindi', 'veg'] },
  { section: 'Dairy', icon: 'cheese', words: ['paneer', 'cheese', 'tofu', 'butter', 'ghee'] },
  { section: 'Dairy', icon: 'milk', words: ['milk', 'curd', 'dahi', 'yogurt', 'yoghurt', 'cream', 'buttermilk', 'lassi'] },
  { section: 'Dairy', icon: 'egg', words: ['egg'] },
  { section: 'Bakery', icon: 'bread', words: ['bread', 'pav', 'bun', 'cake', 'biscuit', 'cookie', 'rusk'] },
  { section: 'Pantry', icon: 'cup', words: ['coffee', 'tea', 'chai'] },
  { section: 'Pantry', icon: 'sack', words: ['rice', 'atta', 'flour', 'maida', 'dal', 'lentil', 'sugar', 'salt', 'oats', 'pasta', 'sooji', 'rava', 'poha', 'oil', 'masala', 'spice', 'noodles'] },
  { section: 'Household', icon: 'soap', words: ['soap', 'detergent', 'cleaner', 'shampoo', 'toothpaste', 'tissue', 'bin bag', 'dishwash', 'sanitiser', 'sanitizer', 'phenyl', 'sponge', 'sunscreen'] },
];

export function classify(name) {
  const n = String(name || '').toLowerCase();
  return RULES.find((r) => r.words.some((w) => n.includes(w))) || { section: 'Other', icon: null };
}

export const guessSection = (name) => classify(name).section;
