/**
 * Shared shipping and pricing rules for Neesh (shipping_v2).
 *
 * Pure TypeScript: no network, no Supabase, no Deno or browser globals. Edge
 * functions import this file directly and the Vite app re-exports it from
 * src/lib/shipping.ts, so the cart, the title page, the publisher tables and
 * create-checkout all run the same math.
 *
 * Money is in US dollars (not cents) unless a name says otherwise.
 */

// ---------------------------------------------------------------------------
// Fees
// ---------------------------------------------------------------------------

/** A space pays wholesale plus Neesh's 10%. */
export const NEESH_SPACE_MULTIPLIER = 1.10;
/** A publisher receives wholesale minus Neesh's 10%. */
export const NEESH_PUBLISHER_MULTIPLIER = 0.90;

/** Margin at or above this share of retail revenue is Healthy. */
export const HEALTHY_MARGIN_PCT = 0.25;

/** Copies in the publisher-side reference order (decision 6). */
export const REFERENCE_ORDER_COPIES = 10;

/** Default international minimum (publishers.intl_min_copies). */
export const DEFAULT_INTL_MIN_COPIES = 5;

/** Stored quotes are good for this long before create-checkout re-quotes. */
export const QUOTE_TTL_DAYS = 7;
/** Raw Shippo rate results are cached this long per origin/destination/weight. */
export const RATE_CACHE_TTL_MINUTES = 30;
/** Print Label refuses to buy when a re-rate is this much above what the space paid. */
export const LABEL_RERATE_TOLERANCE = 0.15;

/** Customs constants (decision 2). */
export const CUSTOMS_TARIFF_NUMBER = '490290';
export const CUSTOMS_DESCRIPTION = 'Printed magazines';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** What a space pays per copy (WSP x 1.10), rounded to the cent like Stripe. */
export function spaceUnitPrice(wsp: number): number {
  if (!wsp || wsp <= 0) return 0;
  return Math.round(wsp * NEESH_SPACE_MULTIPLIER * 100) / 100;
}

/** What a publisher receives per copy (WSP x 0.90). */
export function publisherUnitPayout(wsp: number): number {
  if (!wsp || wsp <= 0) return 0;
  return round2(wsp * NEESH_PUBLISHER_MULTIPLIER);
}

export interface TransferSplit {
  gross: number;
  net: number;
  platformFee: number;
}

/**
 * Goods transfer for one order line. Gross matches the Stripe charge
 * (unit price rounded to the cent, times quantity).
 */
export function goodsSplit(wsp: number, quantity: number): TransferSplit {
  const gross = round2(spaceUnitPrice(wsp) * quantity);
  const net = round2(wsp * NEESH_PUBLISHER_MULTIPLIER * quantity);
  return { gross, net, platformFee: round2(gross - net) };
}

/**
 * Shipping transfer for one parcel. No Neesh fee on shipping. When the
 * publisher bought the label through Neesh, its cost comes out of the
 * shipping the space paid. Never negative.
 */
export function shippingSplit(shippingUsd: number, labelCostUsd: number | null = null): TransferSplit {
  const gross = round2(Math.max(0, shippingUsd || 0));
  const net = round2(Math.max(0, gross - (labelCostUsd ?? 0)));
  return { gross, net, platformFee: 0 };
}

// ---------------------------------------------------------------------------
// Countries and zones
// ---------------------------------------------------------------------------

export const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
] as const;

const EU_SET = new Set<string>(EU_COUNTRIES);

export const isEU = (code: string | null | undefined): boolean => !!code && EU_SET.has(code.toUpperCase());

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia', NZ: 'New Zealand',
  FR: 'France', DE: 'Germany', IT: 'Italy', ES: 'Spain', NL: 'Netherlands', BE: 'Belgium',
  AT: 'Austria', CH: 'Switzerland', SE: 'Sweden', DK: 'Denmark', NO: 'Norway', FI: 'Finland',
  PT: 'Portugal', IE: 'Ireland', PL: 'Poland', CZ: 'Czech Republic', HU: 'Hungary', GR: 'Greece',
  RO: 'Romania', BG: 'Bulgaria', HR: 'Croatia', SI: 'Slovenia', SK: 'Slovakia', LT: 'Lithuania',
  LV: 'Latvia', EE: 'Estonia', LU: 'Luxembourg', MT: 'Malta', CY: 'Cyprus', JP: 'Japan',
  KR: 'South Korea', CN: 'China', TW: 'Taiwan', HK: 'Hong Kong', SG: 'Singapore', MX: 'Mexico',
  BR: 'Brazil', AR: 'Argentina', CL: 'Chile', TR: 'Turkey', IL: 'Israel', ZA: 'South Africa',
  IN: 'India',
};

const NAME_ALIASES: Record<string, string> = {
  'usa': 'US', 'u.s.': 'US', 'u.s.a.': 'US', 'united states of america': 'US', 'america': 'US',
  'uk': 'GB', 'u.k.': 'GB', 'great britain': 'GB', 'britain': 'GB', 'england': 'GB',
  'scotland': 'GB', 'wales': 'GB', 'northern ireland': 'GB', 'holland': 'NL',
  'the netherlands': 'NL', 'czechia': 'CZ', 'korea': 'KR', 'republic of korea': 'KR',
};

const NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_NAMES).map(([code, name]) => [name.toLowerCase(), code]),
);

/**
 * Normalise a country written as an ISO code or a name ("United States",
 * "us", "UK") to an ISO 3166-1 alpha-2 code. Returns null when unknown.
 * shipping_addresses.country holds either form depending on when it was saved.
 */
export function normalizeCountry(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  if (/^[A-Za-z]{2}$/.test(raw)) {
    const code = raw.toUpperCase();
    return code === 'UK' ? 'GB' : code;
  }
  const lower = raw.toLowerCase();
  return NAME_ALIASES[lower] ?? NAME_TO_CODE[lower] ?? null;
}

export const countryName = (code: string | null | undefined): string =>
  code ? (COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase()) : '';

/** Short form used in compact UI copy ("US minimum 5 copies"). */
export const countryShortName = (code: string | null | undefined): string => {
  const c = (code ?? '').toUpperCase();
  if (c === 'US') return 'US';
  if (c === 'GB') return 'UK';
  return countryName(c);
};

export type Zone = 'domestic' | 'international';

/** Domestic = same country, or both in the EU. The UK is international (decision 3). */
export function zoneFor(origin: string | null | undefined, destination: string | null | undefined): Zone {
  const o = normalizeCountry(origin);
  const d = normalizeCountry(destination);
  if (!o || !d) return 'international';
  if (o === d) return 'domestic';
  if (isEU(o) && isEU(d)) return 'domestic';
  return 'international';
}

/**
 * Customs incoterm: the sender pays duties on US-bound parcels from outside
 * the US (decision 2). A courier settles them and bills the label account; on
 * a postal parcel the sender prepays them (see dutiesPaidFor).
 */
export function incotermFor(origin: string, destination: string): 'DDP' | null {
  const o = normalizeCountry(origin);
  const d = normalizeCountry(destination);
  return d === 'US' && o !== 'US' ? 'DDP' : null;
}

/** Whether a parcel needs a customs declaration (crossing a customs border). */
export function needsCustoms(origin: string, destination: string): boolean {
  const o = normalizeCountry(origin);
  const d = normalizeCountry(destination);
  if (!o || !d || o === d) return false;
  return !(isEU(o) && isEU(d));
}

// ---------------------------------------------------------------------------
// Flat rates (publisher override, "My own flat rates")
// ---------------------------------------------------------------------------

export interface FlatRates {
  firstCopyUsd: number | null;
  additionalCopyUsd: number | null;
}

/** first + (copies - 1) x additional. Null when the publisher left the zone unset. */
export function flatShipping(rates: FlatRates, copies: number): number | null {
  if (rates.firstCopyUsd === null || rates.firstCopyUsd === undefined) return null;
  if (copies <= 0) return 0;
  const additional = rates.additionalCopyUsd ?? 0;
  return round2(rates.firstCopyUsd + (copies - 1) * additional);
}

/**
 * Flat-rate regions. Domestic follows zoneFor; everything else is matched on
 * the destination. intl_min_copies and checkMinimums still use zoneFor.
 */
export type Region = 'domestic' | 'us' | 'ca' | 'uk' | 'eu' | 'row';

export const FLAT_REGIONS: { key: Region; label: string }[] = [
  { key: 'domestic', label: 'Domestic' },
  { key: 'us', label: 'United States' },
  { key: 'ca', label: 'Canada' },
  { key: 'uk', label: 'United Kingdom' },
  { key: 'eu', label: 'European Union' },
  { key: 'row', label: 'Rest of world' },
];

/** publishers.flat_rates: { "<region>": { "first": 8, "additional": 3 } }. A missing region is not shipped to. */
export type FlatRatesByRegion = Partial<Record<Region, { first: number; additional?: number | null }>>;

/** The named region a country belongs to, or null for Rest of world. */
function namedRegion(country: string | null): Region | null {
  if (country === 'US') return 'us';
  if (country === 'CA') return 'ca';
  if (country === 'GB') return 'uk';
  if (isEU(country)) return 'eu';
  return null;
}

export function regionFor(origin: string | null | undefined, destination: string | null | undefined): Region {
  if (zoneFor(origin, destination) === 'domestic') return 'domestic';
  return namedRegion(normalizeCountry(destination)) ?? 'row';
}

/**
 * The region that is the publisher's own country (always quoted as Domestic),
 * so the settings form hides it. Null for Rest-of-world origins: Rest of world
 * still covers every other country there.
 */
export function originRegion(origin: string | null | undefined): Region | null {
  return namedRegion(normalizeCountry(origin));
}

export function flatRatesFor(flatRates: FlatRatesByRegion | null | undefined, region: Region): FlatRates {
  const r = flatRates?.[region];
  if (!r || r.first === null || r.first === undefined) return { firstCopyUsd: null, additionalCopyUsd: null };
  return { firstCopyUsd: Number(r.first), additionalCopyUsd: r.additional == null ? null : Number(r.additional) };
}

// ---------------------------------------------------------------------------
// Margins (decision 6)
// ---------------------------------------------------------------------------

export type MarginBand = 'loss' | 'thin' | 'healthy';

export const MARGIN_BAND_LABEL: Record<MarginBand, string> = {
  loss: 'Loss',
  thin: 'Thin',
  healthy: 'Healthy',
};

/** Margin bands: Loss below 0, Thin 0 to 25%, Healthy 25% and up. */
export function marginBand(margin: number, marginPct: number): MarginBand {
  if (margin < 0) return 'loss';
  if (marginPct < HEALTHY_MARGIN_PCT) return 'thin';
  return 'healthy';
}

export interface LandedMarginInput {
  wsp: number;
  srp: number;
  quantity: number;
  shippingUsd: number;
}

export interface LandedMargin {
  /** quantity x WSP x 1.10 + shipping */
  cost: number;
  /** quantity x SRP */
  revenue: number;
  margin: number;
  /** margin / revenue, as a fraction. 0 when revenue is 0. */
  marginPct: number;
  /** cost / quantity */
  landedPerCopy: number;
  band: MarginBand;
}

/** Margin = (qty x SRP) - (qty x WSP x 1.10) - shipping. Negative values allowed. */
export function landedMargin({ wsp, srp, quantity, shippingUsd }: LandedMarginInput): LandedMargin {
  const q = Math.max(0, quantity);
  const cost = round2(q * wsp * NEESH_SPACE_MULTIPLIER + (shippingUsd || 0));
  const revenue = round2(q * srp);
  const margin = round2(revenue - cost);
  const marginPct = revenue > 0 ? margin / revenue : 0;
  return {
    cost,
    revenue,
    margin,
    marginPct,
    landedPerCopy: q > 0 ? round2(cost / q) : 0,
    band: marginBand(margin, marginPct),
  };
}

export interface QuotedQuantity {
  quantity: number;
  shippingUsd: number;
}

/** Smallest quoted quantity whose margin is >= 0, or null if none of them break even. */
export function breakEvenCopies(wsp: number, srp: number, quotes: QuotedQuantity[]): number | null {
  const sorted = [...quotes].sort((a, b) => a.quantity - b.quantity);
  for (const q of sorted) {
    if (landedMargin({ wsp, srp, quantity: q.quantity, shippingUsd: q.shippingUsd }).margin >= 0) {
      return q.quantity;
    }
  }
  return null;
}

/** Smallest quoted quantity that is Healthy, or null. */
export function healthyCopies(wsp: number, srp: number, quotes: QuotedQuantity[]): number | null {
  const sorted = [...quotes].sort((a, b) => a.quantity - b.quantity);
  for (const q of sorted) {
    if (landedMargin({ wsp, srp, quantity: q.quantity, shippingUsd: q.shippingUsd }).band === 'healthy') {
      return q.quantity;
    }
  }
  return null;
}

/**
 * The retail price that makes an order Healthy, rounded up to the next 0.50.
 * Returns null when the order is already Healthy. Only ever moves retail up;
 * Neesh never suggests lowering wholesale (decision 6).
 */
export function suggestHealthyRetail(input: { wsp: number; quantity: number; shippingUsd: number; srp: number }): number | null {
  const current = landedMargin(input);
  if (current.band === 'healthy' || input.quantity <= 0) return null;
  const needed = current.cost / (input.quantity * (1 - HEALTHY_MARGIN_PCT));
  // Avoid 34.5000001 rounding up to 35.00 from float noise.
  const suggestion = Math.ceil(round2(needed) * 2 - 1e-9) / 2;
  return Math.max(suggestion, input.srp);
}

// ---------------------------------------------------------------------------
// Minimums (decision 4)
// ---------------------------------------------------------------------------

export interface MinimumLine {
  magazineId: string;
  title: string;
  quantity: number;
  /** magazines.minimum_order_quantity; null or < 1 means 1. */
  minimumOrderQuantity: number | null;
}

export interface TitleShortfall {
  magazineId: string;
  title: string;
  minimum: number;
  short: number;
}

export interface MinimumCheck {
  ok: boolean;
  titleShortfalls: TitleShortfall[];
  /** Copies across the publisher group (international only). */
  copies: number;
  /** The international minimum that applies, or null for domestic orders. */
  intlMinimum: number | null;
  /** Copies to add to reach the international minimum. 0 when met or domestic. */
  intlShort: number;
}

/**
 * Per-title minimums always apply. On international orders the publisher's
 * intl_min_copies also applies, counted across all of that publisher's titles
 * in the order. Neither overrides the other.
 */
export function checkMinimums(zone: Zone, intlMinCopies: number | null | undefined, lines: MinimumLine[]): MinimumCheck {
  const titleShortfalls: TitleShortfall[] = [];
  let copies = 0;
  for (const line of lines) {
    copies += line.quantity;
    const minimum = Math.max(1, line.minimumOrderQuantity ?? 1);
    if (line.quantity < minimum) {
      titleShortfalls.push({ magazineId: line.magazineId, title: line.title, minimum, short: minimum - line.quantity });
    }
  }
  const intlMinimum = zone === 'international' ? Math.max(1, intlMinCopies ?? DEFAULT_INTL_MIN_COPIES) : null;
  const intlShort = intlMinimum !== null ? Math.max(0, intlMinimum - copies) : 0;
  return { ok: titleShortfalls.length === 0 && intlShort === 0, titleShortfalls, copies, intlMinimum, intlShort };
}

/**
 * Lowest quantity a space can pick for one title on its page: the title's own
 * minimum, and on international orders whatever is still needed to reach the
 * publisher minimum given copies already in the cart from that publisher.
 */
export function minimumSelectableQuantity(opts: {
  zone: Zone;
  minimumOrderQuantity: number | null;
  intlMinCopies: number | null | undefined;
  otherCopiesFromPublisher: number;
}): number {
  const titleMin = Math.max(1, opts.minimumOrderQuantity ?? 1);
  if (opts.zone !== 'international') return titleMin;
  const intlMin = Math.max(1, opts.intlMinCopies ?? DEFAULT_INTL_MIN_COPIES);
  return Math.max(titleMin, intlMin - Math.max(0, opts.otherCopiesFromPublisher));
}

// ---------------------------------------------------------------------------
// Parcels
// ---------------------------------------------------------------------------

export type PackagingPreset = 'auto' | 'envelope' | 'padded_mailer' | 'box';

export const PACKAGING_OPTIONS: { value: PackagingPreset; label: string }[] = [
  { value: 'auto', label: 'Padded mailer up to 5 copies, box above' },
  { value: 'envelope', label: 'Envelope' },
  { value: 'padded_mailer', label: 'Padded mailer' },
  { value: 'box', label: 'Box' },
];

/** Packaging weight allowance in grams. */
export const PACKAGING_GRAMS: Record<Exclude<PackagingPreset, 'auto'>, number> = {
  envelope: 40,
  padded_mailer: 90,
  box: 300,
};

const DEFAULT_WIDTH_MM = 230;
const DEFAULT_HEIGHT_MM = 300;
const COPY_THICKNESS_MM = 8;

export interface ParcelLine {
  quantity: number;
  weightGrams: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
}

export interface Parcel {
  packaging: Exclude<PackagingPreset, 'auto'>;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export function resolvePackaging(preset: PackagingPreset | null | undefined, copies: number): Exclude<PackagingPreset, 'auto'> {
  if (!preset || preset === 'auto') return copies <= 5 ? 'padded_mailer' : 'box';
  return preset;
}

/**
 * One parcel per publisher group: sum of title weight x qty plus the packaging
 * allowance. Returns null when any title is missing its weight (no guessing).
 */
export function buildParcel(lines: ParcelLine[], preset: PackagingPreset | null | undefined): Parcel | null {
  const copies = lines.reduce((s, l) => s + Math.max(0, l.quantity), 0);
  if (copies <= 0) return null;
  let grams = 0;
  let maxW = 0;
  let maxH = 0;
  for (const l of lines) {
    if (!l.weightGrams || l.weightGrams <= 0) return null;
    grams += l.weightGrams * l.quantity;
    maxW = Math.max(maxW, l.widthMm || DEFAULT_WIDTH_MM);
    maxH = Math.max(maxH, l.heightMm || DEFAULT_HEIGHT_MM);
  }
  const packaging = resolvePackaging(preset, copies);
  const weightGrams = Math.ceil(grams + PACKAGING_GRAMS[packaging]);
  const pad = packaging === 'box' ? 30 : 20;
  const stack = copies * COPY_THICKNESS_MM + (packaging === 'box' ? 40 : 10);
  return {
    packaging,
    weightGrams,
    lengthCm: Math.ceil((maxH + pad) / 10),
    widthCm: Math.ceil((maxW + pad) / 10),
    heightCm: Math.max(1, Math.ceil(stack / 10)),
  };
}

// ---------------------------------------------------------------------------
// Carrier rates
// ---------------------------------------------------------------------------

/** The subset of a Shippo rate object this module reads. */
export interface CarrierRate {
  object_id: string;
  amount: string;
  currency: string;
  amount_local?: string | null;
  currency_local?: string | null;
  provider: string;
  servicelevel?: { name?: string | null; token?: string | null } | null;
  estimated_days?: number | null;
  attributes?: string[] | null;
}

const UNTRACKED = /untracked|lettre|letter|flat_rate_envelope|first_class_international|economy_untracked/i;

/** Whether a rate is a tracked service. Shippo has no flag, so known untracked services are excluded. */
export function isTrackedRate(rate: CarrierRate): boolean {
  const text = `${rate.servicelevel?.token ?? ''} ${rate.servicelevel?.name ?? ''}`;
  return !UNTRACKED.test(text);
}

/**
 * A rate's price in USD, or null when Shippo gave none. Shippo prices `amount`
 * in the origin country's currency and `amount_local` in the destination's,
 * or in whatever currency the rates were re-requested in (shippo.ts
 * withUsdPrices). A Toronto rate is CAD in `amount`, USD in `amount_local`.
 */
export function usdAmount(rate: CarrierRate): number | null {
  const pick = (amount: string | null | undefined, currency: string | null | undefined) => {
    if ((currency || '').toUpperCase() !== 'USD') return null;
    const n = parseFloat(amount ?? '');
    return Number.isFinite(n) && n > 0 ? round2(n) : null;
  };
  return pick(rate.amount, rate.currency) ?? pick(rate.amount_local, rate.currency_local);
}

/**
 * Cheapest tracked rate by its USD price (decision 2). Rates are charged in
 * USD, so a rate with no USD price is skipped rather than guessed.
 */
export function pickCheapestTrackedRate(rates: CarrierRate[] | null | undefined): CarrierRate | null {
  let best: CarrierRate | null = null;
  let bestUsd = Infinity;
  for (const r of rates ?? []) {
    const usd = usdAmount(r);
    if (usd === null || !isTrackedRate(r)) continue;
    if (usd < bestUsd) {
      best = r;
      bestUsd = usd;
    }
  }
  return best;
}

/**
 * Couriers that clear US customs and bill the duties back to the label's
 * account when the declaration says DDP. Postal services don't: since the
 * US ended de minimis (Aug 29, 2025) the sender must prepay duties before a
 * postal parcel is accepted (Canada Post through Zonos, for example).
 */
const DUTY_PREPAYING_CARRIERS = /^(ups|fedex|dhl_express)(_|$)/;

export function carrierPrepaysDuties(rate: Pick<CarrierRate, 'provider' | 'servicelevel'>): boolean {
  const token = (rate.servicelevel?.token ?? '').toLowerCase();
  if (DUTY_PREPAYING_CARRIERS.test(token)) return true;
  return /^(ups|fedex|dhl express)$/i.test((rate.provider ?? '').trim());
}

/** "Duties paid" is only true when the parcel needs it and the carrier actually does it. */
export function dutiesPaidFor(origin: string | null | undefined, destination: string | null | undefined, rate: Pick<CarrierRate, 'provider' | 'servicelevel'>): boolean {
  if (!origin || !destination || !incotermFor(origin, destination)) return false;
  return carrierPrepaysDuties(rate);
}

/**
 * The publisher prepays US duties themselves: a US-bound parcel from outside
 * the US that no duty-paying courier is carrying (a postal label, or their
 * own postage).
 */
export function senderPrepaysDuties(origin: string | null | undefined, destination: string | null | undefined, dutiesPaid: boolean): boolean {
  return !!origin && !!destination && !!incotermFor(origin, destination) && !dutiesPaid;
}

/** Human label for a rate, e.g. "Colissimo, duties paid". */
export function rateLabel(provider: string | null | undefined, service: string | null | undefined, dutiesPaid: boolean): string {
  const base = [provider, service].filter(Boolean).join(' ');
  return dutiesPaid ? `${base}, duties paid` : base;
}

// ---------------------------------------------------------------------------
// Customs (decision 2)
// ---------------------------------------------------------------------------

export interface CustomsLine {
  quantity: number;
  weightGrams: number;
  /** Declared value per copy: the wholesale price. */
  wsp: number;
}

export interface CustomsDeclaration {
  contents_type: 'MERCHANDISE';
  contents_explanation: string;
  non_delivery_option: 'RETURN';
  certify: true;
  certify_signer: string;
  incoterm?: 'DDP';
  eel_pfc?: string;
  invoice?: string;
  items: {
    description: string;
    quantity: number;
    net_weight: string;
    mass_unit: 'g';
    value_amount: string;
    value_currency: 'USD';
    origin_country: string;
    tariff_number: string;
  }[];
}

/** Inline Shippo customs declaration, or null when the parcel stays inside a customs area. */
export function buildCustomsDeclaration(opts: {
  origin: string;
  destination: string;
  signer: string;
  lines: CustomsLine[];
  reference?: string;
}): CustomsDeclaration | null {
  const origin = normalizeCountry(opts.origin);
  const destination = normalizeCountry(opts.destination);
  if (!origin || !destination || !needsCustoms(origin, destination)) return null;
  const incoterm = incotermFor(origin, destination);
  const decl: CustomsDeclaration = {
    contents_type: 'MERCHANDISE',
    contents_explanation: CUSTOMS_DESCRIPTION,
    non_delivery_option: 'RETURN',
    certify: true,
    certify_signer: opts.signer || 'Neesh',
    items: opts.lines.map((l) => ({
      description: CUSTOMS_DESCRIPTION,
      quantity: l.quantity,
      net_weight: String(Math.ceil(l.weightGrams * l.quantity)),
      mass_unit: 'g',
      value_amount: (l.wsp * l.quantity).toFixed(2),
      value_currency: 'USD',
      origin_country: origin,
      tariff_number: CUSTOMS_TARIFF_NUMBER,
    })),
  };
  if (incoterm) decl.incoterm = incoterm;
  // US exports under 2,500 USD per HS code need the no-EEI exemption.
  if (origin === 'US') decl.eel_pfc = 'NOEEI_30_37_a';
  if (opts.reference) decl.invoice = opts.reference;
  return decl;
}

// ---------------------------------------------------------------------------
// Addresses, keys and reference destinations
// ---------------------------------------------------------------------------

export interface ShipAddress {
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postal_code: string;
  /** ISO alpha-2 */
  country: string;
}

/** Whether an address has what a live rate needs. */
export function isQuotableAddress(a: Partial<ShipAddress> | null | undefined): a is ShipAddress {
  return !!a && !!a.line1 && !!a.city && !!a.postal_code && !!normalizeCountry(a.country ?? null);
}

/** Whether a ships-from address is complete enough to buy a label (needs a phone for customs). */
export function isLabelReadyAddress(a: Partial<ShipAddress> | null | undefined): boolean {
  return isQuotableAddress(a) && !!a?.phone && !!a?.name;
}

const normPostal = (p: string | null | undefined) => (p ?? '').replace(/\s+/g, '').toUpperCase();

/** Cache key for a raw carrier rate lookup (decision 2). */
export function rateCacheKey(origin: Pick<ShipAddress, 'postal_code' | 'country'>, destination: Pick<ShipAddress, 'postal_code' | 'country'>, weightGrams: number, packaging: string): string {
  return [
    normalizeCountry(origin.country), normPostal(origin.postal_code),
    normalizeCountry(destination.country), normPostal(destination.postal_code),
    Math.ceil(weightGrams), packaging,
  ].join('|');
}

/** Stable key for a publisher group's items, so a stored quote can be matched to the cart. */
export function itemsKey(items: { magazine_id: string; quantity: number }[]): string {
  return [...items]
    .filter((i) => i.quantity > 0)
    .sort((a, b) => a.magazine_id.localeCompare(b.magazine_id))
    .map((i) => `${i.magazine_id}:${i.quantity}`)
    .join(',');
}

/** Stable key for a destination address. */
export function destinationKey(a: Pick<ShipAddress, 'line1' | 'postal_code' | 'country'>): string {
  return [normalizeCountry(a.country), normPostal(a.postal_code), (a.line1 ?? '').trim().toLowerCase()].join('|');
}

/** Reference New York space used for publisher-side tables and banners (decision 6). */
export const REFERENCE_US_ADDRESS: ShipAddress = {
  name: 'Neesh reference space',
  line1: '2350 Adam Clayton Powell Jr Blvd',
  city: 'New York',
  state: 'NY',
  postal_code: '10030',
  country: 'US',
};

/** Domestic reference spaces for the publisher preview, by ships-from country. */
export const REFERENCE_DOMESTIC_ADDRESSES: Record<string, ShipAddress> = {
  US: { name: 'Neesh reference space', line1: '350 S Grand Ave', city: 'Los Angeles', state: 'CA', postal_code: '90071', country: 'US' },
  CA: { name: 'Neesh reference space', line1: '100 Queen St W', city: 'Toronto', state: 'ON', postal_code: 'M5H 2N2', country: 'CA' },
  GB: { name: 'Neesh reference space', line1: '1 Piccadilly Gardens', city: 'Manchester', postal_code: 'M1 1RG', country: 'GB' },
  FR: { name: 'Neesh reference space', line1: '20 Place Bellecour', city: 'Lyon', postal_code: '69002', country: 'FR' },
  DE: { name: 'Neesh reference space', line1: 'Alexanderplatz 1', city: 'Berlin', postal_code: '10178', country: 'DE' },
  NL: { name: 'Neesh reference space', line1: 'Dam 1', city: 'Amsterdam', postal_code: '1012 JS', country: 'NL' },
};

/**
 * Indicative Shippo quotes to New York from Oct 22, 2026, one 350 g copy each.
 * Only used for the sign-up note before a publisher has an address (T18);
 * never charged. Countries without an entry show "often 40 USD or more".
 */
export const SIGNUP_ESTIMATES_TO_NY: Record<string, { one: number; five: number }> = {
  CA: { one: 10.96, five: 17.97 },
  GB: { one: 23.05, five: 36.93 },
  FR: { one: 39.97, five: 57.69 },
};

/** Countries where Shippo's own carrier accounts have quoted from (verified Oct 22, 2026). */
export const LABEL_VERIFIED_COUNTRIES = ['US', 'CA', 'GB', 'FR'];
