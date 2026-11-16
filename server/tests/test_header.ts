// Tests de la règle « les valeurs lues dans la fiche MoteurImmo priment sur l'IA ».
// Lance : npm test
import assert from 'node:assert/strict';

process.env.ANTHROPIC_API_KEY ||= 'test'; // le client IA est créé à l'import, jamais appelé ici
const { applyHeader } = await import('../extract.ts');
const { listingProblems } = await import('../../src/lib/validate.ts');

const base = {
  id: 'x', title: 'Annonce', city: '', postalCode: '', surface: 0, rooms: 0, bedrooms: 0,
  description: 'Belle maison.', features: [], netSellerPrice: 0, mandateType: 'simple' as const,
  notaryRate: 8.5, notaryOverride: 0, isNewBuild: false, advisorComment: '', photos: [],
};
const header = {
  title: 'Maison T5 avec vue mer St-Paul.', city: 'Saint-Paul', postalCode: '97460',
  price: 330000, pricePerM2: 2870, rooms: 5, bedrooms: 4, surface: 115, landSurface: 533,
};

let n = 0;
const test = (name: string, fn: () => void) => { fn(); n++; console.log(`✓ ${name}`); };

test("IA en échec : la fiche suffit à rendre l'annonce exportable (hors description)", () => {
  const l = applyHeader({ ...base }, header);
  assert.equal(l.title, 'Maison T5 avec vue mer St-Paul.');
  assert.equal(l.city, 'Saint-Paul');
  assert.equal(l.postalCode, '97460');
  assert.equal(l.netSellerPrice, 330000);
  assert.equal(l.notaryOverride, Math.round(330000 * 0.085));
  assert.deepEqual(listingProblems(l), []);
});

test("le prix de la fiche remplace un prix IA erroné (ex. loyer lu comme prix)", () => {
  const l = applyHeader({ ...base, title: 'Maison vue mer', city: 'St Paul', netSellerPrice: 1895 }, header);
  assert.equal(l.netSellerPrice, 330000);
  assert.equal(l.city, 'Saint-Paul');
  assert.equal(l.title, 'Maison vue mer'); // titre IA lisible : conservé
});

test("fiche sans prix : le prix IA est gardé", () => {
  const l = applyHeader({ ...base, netSellerPrice: 250000 }, { ...header, price: null });
  assert.equal(l.netSellerPrice, 250000);
});

test("sans fiche reconnue : rien ne change", () => {
  const l = { ...base, netSellerPrice: 1 };
  assert.deepEqual(applyHeader(l, undefined), l);
});

test("description vide : export bloqué", () => {
  const l = applyHeader({ ...base, description: '' }, header);
  assert.ok(listingProblems(l).some((p) => p.includes('description')));
});

console.log(`\n${n}/${n} OK`);
