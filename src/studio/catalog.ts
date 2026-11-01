/* Garments, fabrics, patterns and the serialisable design model. No three.js here: the Create page imports it too. */

export type GarmentId = 'tee' | 'hoodie' | 'zip' | 'sweat' | 'long' | 'shirt' | 'shortshirt' | 'polo' | 'workjacket' | 'varsity' | 'blazer' | 'vest' | 'pants' | 'jeans' | 'slimjeans' | 'cargo' | 'shorts' | 'skirt'
export type PartKind = 'cloth' | 'thread' | 'hardware'

export interface PartDef { id: string; label: string; kind: PartKind; fabric?: string }
export interface Placement { id: string; label: string; x: number; y: number; z?: number; side: 'front' | 'back' | 'left' | 'right'; size: number }
export interface GarmentDef {
  id: GarmentId
  label: string
  file: string
  parts: PartDef[]
  placements: Placement[]
  /** Highest point (metres, model space) the length control may cut to. */
  cropY: number
  lengthLabel: string
  /** Absent on garments without sleeves. Axis runs shoulder to cuff in the XY plane, for +X. */
  sleeve?: { axis: [number, number]; travel: number; minX: number; minY: number; parts: string[] }
  defaults: { color: string; fabric: string }
  productType: string
}

const HOODIE_PARTS: PartDef[] = [
  { id: 'front', label: 'Front', kind: 'cloth' },
  { id: 'back', label: 'Back', kind: 'cloth' },
  { id: 'sleeve_l', label: 'Left sleeve', kind: 'cloth' },
  { id: 'sleeve_r', label: 'Right sleeve', kind: 'cloth' },
  { id: 'hood', label: 'Hood', kind: 'cloth' },
  { id: 'pocket', label: 'Pocket', kind: 'cloth' },
  { id: 'cuffs', label: 'Cuffs', kind: 'cloth', fabric: 'rib' },
  { id: 'hem', label: 'Waistband', kind: 'cloth', fabric: 'rib' },
]

const CREW_PARTS: PartDef[] = [
  { id: 'front', label: 'Front', kind: 'cloth' },
  { id: 'back', label: 'Back', kind: 'cloth' },
  { id: 'sleeve_l', label: 'Left sleeve', kind: 'cloth' },
  { id: 'sleeve_r', label: 'Right sleeve', kind: 'cloth' },
  { id: 'collar', label: 'Collar', kind: 'cloth', fabric: 'rib' },
  { id: 'cuffs', label: 'Cuffs', kind: 'cloth' },
  { id: 'hem', label: 'Hem', kind: 'cloth' },
  { id: 'pocket', label: 'Labels', kind: 'cloth' },
  { id: 'stitching', label: 'Stitching', kind: 'thread' },
]

const CREW_PLACEMENTS: Placement[] = [
  { id: 'center', label: 'Center chest', x: 0, y: 0.08, side: 'front', size: 0.24 },
  { id: 'left', label: 'Left chest', x: 0.09, y: 0.17, side: 'front', size: 0.08 },
  { id: 'hem', label: 'Lower hem', x: 0.1, y: -0.24, side: 'front', size: 0.1 },
  { id: 'back', label: 'Full back', x: 0, y: 0.05, side: 'back', size: 0.28 },
  { id: 'neck', label: 'Back neck', x: 0, y: 0.26, side: 'back', size: 0.09 },
  { id: 'sleeveL', label: 'Left sleeve', x: 0, y: 0.05, side: 'left', size: 0.07 },
  { id: 'sleeveR', label: 'Right sleeve', x: 0, y: 0.05, side: 'right', size: 0.07 },
]

const PART: Record<string, PartDef> = {
  front: { id: 'front', label: 'Front', kind: 'cloth' },
  back: { id: 'back', label: 'Back', kind: 'cloth' },
  sleeve_l: { id: 'sleeve_l', label: 'Left sleeve', kind: 'cloth' },
  sleeve_r: { id: 'sleeve_r', label: 'Right sleeve', kind: 'cloth' },
  collar: { id: 'collar', label: 'Collar', kind: 'cloth' },
  waistband: { id: 'waistband', label: 'Waistband', kind: 'cloth' },
  pockets: { id: 'pockets', label: 'Pockets', kind: 'cloth' },
  buttons: { id: 'buttons', label: 'Buttons', kind: 'hardware' },
  stitching: { id: 'stitching', label: 'Stitching', kind: 'thread' },
}
const parts = (...ids: string[]) => ids.map((id) => PART[id])

/** Open-front tops: artwork sits either side of the placket. h = garment height. */
const openFront = (h: number): Placement[] => [
  { id: 'left', label: 'Left chest', x: 0.09, y: h * 0.2, side: 'front', size: 0.08 },
  { id: 'right', label: 'Right chest', x: -0.09, y: h * 0.2, side: 'front', size: 0.08 },
  { id: 'back', label: 'Full back', x: 0, y: h * 0.1, side: 'back', size: 0.28 },
  { id: 'neck', label: 'Back neck', x: 0, y: h * 0.35, side: 'back', size: 0.09 },
]
const SIDES: Placement[] = [
  { id: 'sleeveL', label: 'Left sleeve', x: 0, y: 0.06, side: 'left', size: 0.07 },
  { id: 'sleeveR', label: 'Right sleeve', x: 0, y: 0.06, side: 'right', size: 0.07 },
]
/** Trousers: x = centre of one leg, y = mid thigh. */
const legs = (x: number, y: number): Placement[] => [
  { id: 'thigh', label: 'Left thigh', x, y, side: 'front', size: 0.09 },
  { id: 'knee', label: 'Left knee', x, y: y - 0.2, side: 'front', size: 0.08 },
  { id: 'thighR', label: 'Right thigh', x: -x, y, side: 'front', size: 0.09 },
  { id: 'pocket', label: 'Back pocket', x, y: y + 0.14, side: 'back', size: 0.09 },
  { id: 'calf', label: 'Right calf', x: -x, y: y - 0.45, side: 'back', size: 0.08 },
]
const SHIRT_SLEEVE = { axis: [0.06, -0.99] as [number, number], travel: 0.3, minX: 0.2, minY: -1, parts: ['sleeve_l', 'sleeve_r'] }
const SHORT_SLEEVE = { axis: [0.55, -0.83] as [number, number], travel: 0.1, minX: 0.2, minY: 0, parts: ['sleeve_l', 'sleeve_r'] }
const garment = (id: GarmentId, label: string, productType: string, defaults: GarmentDef['defaults'], rest: Pick<GarmentDef, 'parts' | 'placements' | 'cropY' | 'lengthLabel'> & Partial<GarmentDef>): GarmentDef => ({ id, label, file: `models/${id}.glb`, productType, defaults, ...rest })

const LONG_SLEEVE = { axis: [0.135, -0.99] as [number, number], travel: 0.28, minX: 0.185, minY: -1, parts: ['sleeve_l', 'sleeve_r', 'cuffs'] }

export const GARMENTS: Record<GarmentId, GarmentDef> = {
  tee: {
    id: 'tee',
    label: 'T-Shirt',
    file: 'models/tee.glb',
    cropY: -0.14,
    lengthLabel: 'Body length',
    sleeve: { axis: [0.82, -0.57], travel: 0.13, minX: 0.2, minY: 0, parts: ['sleeve_l', 'sleeve_r'] },
    defaults: { color: '#f5f3ee', fabric: 'jersey' },
    productType: 'T-Shirt',
    parts: [
      { id: 'front', label: 'Front', kind: 'cloth' },
      { id: 'back', label: 'Back', kind: 'cloth' },
      { id: 'sleeve_l', label: 'Left sleeve', kind: 'cloth' },
      { id: 'sleeve_r', label: 'Right sleeve', kind: 'cloth' },
      { id: 'collar', label: 'Collar', kind: 'cloth', fabric: 'rib' },
      { id: 'stitching', label: 'Stitching', kind: 'thread' },
    ],
    placements: [
      { id: 'center', label: 'Center chest', x: 0, y: 0.1, side: 'front', size: 0.24 },
      { id: 'left', label: 'Left chest', x: 0.095, y: 0.15, side: 'front', size: 0.08 },
      { id: 'hem', label: 'Lower hem', x: 0.1, y: -0.24, side: 'front', size: 0.1 },
      { id: 'back', label: 'Full back', x: 0, y: 0.05, side: 'back', size: 0.3 },
      { id: 'neck', label: 'Back neck', x: 0, y: 0.2, side: 'back', size: 0.09 },
      { id: 'sleeveL', label: 'Left sleeve', x: 0.27, y: 0.14, z: 0, side: 'left', size: 0.07 },
      { id: 'sleeveR', label: 'Right sleeve', x: -0.27, y: 0.14, z: 0, side: 'right', size: 0.07 },
    ],
  },
  hoodie: {
    id: 'hoodie',
    label: 'Hoodie',
    file: 'models/hoodie.glb',
    cropY: -0.1,
    lengthLabel: 'Body length',
    sleeve: { axis: [0.32, -0.95], travel: 0.3, minX: 0.15, minY: -1, parts: ['sleeve_l', 'sleeve_r', 'cuffs'] },
    defaults: { color: '#8a8a86', fabric: 'fleece' },
    productType: 'Hoodie',
    parts: [...HOODIE_PARTS, { id: 'hood_trim', label: 'Hood edge', kind: 'cloth', fabric: 'rib' }],
    placements: [
      { id: 'center', label: 'Center chest', x: 0, y: 0.06, side: 'front', size: 0.2 },
      { id: 'left', label: 'Left chest', x: 0.07, y: 0.11, side: 'front', size: 0.07 },
      { id: 'pocket', label: 'Pocket', x: 0, y: -0.14, side: 'front', size: 0.12 },
      { id: 'back', label: 'Full back', x: 0, y: 0.03, side: 'back', size: 0.24 },
      { id: 'hood', label: 'Hood', x: 0, y: 0.23, side: 'back', size: 0.11 },
      { id: 'sleeveL', label: 'Left sleeve', x: 0, y: 0, side: 'left', size: 0.07 },
      { id: 'sleeveR', label: 'Right sleeve', x: 0, y: 0, side: 'right', size: 0.07 },
    ],
  },
  zip: {
    id: 'zip',
    label: 'Zip hoodie',
    file: 'models/zip.glb',
    cropY: -0.1,
    lengthLabel: 'Body length',
    sleeve: { axis: [0.12, -0.99], travel: 0.26, minX: 0.19, minY: -1, parts: ['sleeve_l', 'sleeve_r', 'cuffs'] },
    defaults: { color: '#1f2a44', fabric: 'fleece' },
    productType: 'Hoodie',
    parts: [...HOODIE_PARTS, { id: 'cords', label: 'Drawstrings', kind: 'thread' }, { id: 'stitching', label: 'Stitching', kind: 'thread' }, { id: 'zipper', label: 'Zipper', kind: 'hardware' }],
    placements: [
      { id: 'left', label: 'Left chest', x: 0.09, y: 0.11, side: 'front', size: 0.08 },
      { id: 'right', label: 'Right chest', x: -0.09, y: 0.11, side: 'front', size: 0.08 },
      { id: 'pocket', label: 'Left pocket', x: 0.08, y: -0.18, side: 'front', size: 0.09 },
      { id: 'back', label: 'Full back', x: 0, y: 0, side: 'back', size: 0.28 },
      { id: 'hood', label: 'Hood', x: 0, y: 0.26, side: 'back', size: 0.12 },
      { id: 'sleeveL', label: 'Left sleeve', x: 0, y: 0, side: 'left', size: 0.07 },
      { id: 'sleeveR', label: 'Right sleeve', x: 0, y: 0, side: 'right', size: 0.07 },
    ],
  },
  sweat: {
    id: 'sweat',
    label: 'Sweatshirt',
    file: 'models/long.glb',
    cropY: -0.12,
    lengthLabel: 'Body length',
    sleeve: LONG_SLEEVE,
    defaults: { color: '#d8cdb8', fabric: 'fleece' },
    productType: 'Sweatshirt',
    parts: CREW_PARTS.map((p) => (p.id === 'cuffs' || p.id === 'hem' ? { ...p, fabric: 'rib' } : p)),
    placements: CREW_PLACEMENTS,
  },
  long: {
    id: 'long',
    label: 'Longsleeve',
    file: 'models/long.glb',
    cropY: -0.12,
    lengthLabel: 'Body length',
    sleeve: LONG_SLEEVE,
    defaults: { color: '#16130e', fabric: 'heavy' },
    productType: 'Longsleeve',
    parts: CREW_PARTS,
    placements: CREW_PLACEMENTS,
  },
  shirt: garment('shirt', 'Shirt', 'Shirt', { color: '#f5f3ee', fabric: 'twill' }, { parts: parts('front', 'back', 'sleeve_l', 'sleeve_r', 'collar', 'buttons'), placements: [...openFront(0.78), ...SIDES], cropY: -0.14, lengthLabel: 'Body length', sleeve: SHIRT_SLEEVE }),
  shortshirt: garment('shortshirt', 'Short-sleeve shirt', 'Shirt', { color: '#a8d5e2', fabric: 'linen' }, { parts: parts('front', 'back', 'sleeve_l', 'sleeve_r', 'collar', 'buttons'), placements: [...openFront(0.72), { ...SIDES[0], y: 0.18 }, { ...SIDES[1], y: 0.18 }], cropY: -0.14, lengthLabel: 'Body length', sleeve: SHORT_SLEEVE }),
  polo: garment('polo', 'Polo', 'Polo', { color: '#1f2a44', fabric: 'pique' }, { parts: parts('front', 'back', 'sleeve_l', 'sleeve_r', 'collar', 'buttons'), placements: [...openFront(0.72), { ...SIDES[0], y: 0.18 }, { ...SIDES[1], y: 0.18 }], cropY: -0.14, lengthLabel: 'Body length', sleeve: SHORT_SLEEVE }),
  workjacket: garment('workjacket', 'Work jacket', 'Jacket', { color: '#5d6b4a', fabric: 'canvas' }, { parts: parts('front', 'back', 'sleeve_l', 'sleeve_r', 'collar', 'pockets'), placements: [...openFront(0.68), ...SIDES], cropY: -0.1, lengthLabel: 'Body length', sleeve: { axis: [0.39, -0.92], travel: 0.28, minX: 0.22, minY: -1, parts: ['sleeve_l', 'sleeve_r'] } }),
  varsity: garment('varsity', 'Varsity jacket', 'Jacket', { color: '#1f3a5f', fabric: 'fleece' }, { parts: parts('front', 'back', 'sleeve_l', 'sleeve_r', 'collar', 'buttons'), placements: [...openFront(0.72), ...SIDES], cropY: -0.12, lengthLabel: 'Body length', sleeve: { axis: [0.2, -0.98], travel: 0.3, minX: 0.22, minY: -1, parts: ['sleeve_l', 'sleeve_r'] } }),
  blazer: garment('blazer', 'Blazer', 'Blazer', { color: '#2b2b3d', fabric: 'twill' }, { parts: parts('front', 'back', 'sleeve_l', 'sleeve_r', 'collar', 'pockets', 'buttons'), placements: [...openFront(0.78), ...SIDES], cropY: -0.14, lengthLabel: 'Body length', sleeve: SHIRT_SLEEVE }),
  vest: garment('vest', 'Vest', 'Vest', { color: '#6f6a5c', fabric: 'canvas' }, { parts: parts('front', 'back', 'pockets', 'buttons', 'stitching'), placements: openFront(0.68), cropY: -0.1, lengthLabel: 'Body length' }),
  jeans: garment('jeans', 'Baggy jeans', 'Jeans', { color: '#1f2a44', fabric: 'denim' }, { parts: parts('front', 'back', 'waistband', 'buttons', 'stitching'), placements: legs(0.11, 0.22), cropY: -0.08, lengthLabel: 'Leg length' }),
  slimjeans: garment('slimjeans', 'Slim jeans', 'Jeans', { color: '#7c9cbf', fabric: 'denim' }, { parts: parts('front', 'back', 'waistband', 'pockets', 'buttons', 'stitching'), placements: legs(0.1, 0.2), cropY: -0.08, lengthLabel: 'Leg length' }),
  cargo: garment('cargo', 'Cargo pants', 'Pants', { color: '#5d6b4a', fabric: 'canvas' }, { parts: parts('front', 'back', 'waistband', 'buttons'), placements: legs(0.14, 0.2), cropY: -0.08, lengthLabel: 'Leg length' }),
  shorts: garment('shorts', 'Sweat shorts', 'Shorts', { color: '#8a8a86', fabric: 'fleece' }, { parts: parts('front', 'back', 'waistband', 'pockets'), placements: [{ id: 'thigh', label: 'Left leg', x: 0.13, y: -0.04, side: 'front', size: 0.09 }, { id: 'thighR', label: 'Right leg', x: -0.13, y: -0.04, side: 'front', size: 0.09 }, { id: 'pocket', label: 'Back pocket', x: 0.13, y: 0.08, side: 'back', size: 0.08 }], cropY: -0.08, lengthLabel: 'Leg length' }),
  skirt: garment('skirt', 'Pleated skirt', 'Skirt', { color: '#2b2b3d', fabric: 'twill' }, { parts: parts('front', 'back', 'waistband'), placements: [{ id: 'hemL', label: 'Left hem', x: 0.14, y: -0.14, side: 'front', size: 0.08 }, { id: 'center', label: 'Front', x: 0, y: 0.04, side: 'front', size: 0.16 }, { id: 'back', label: 'Back', x: 0, y: 0.04, side: 'back', size: 0.18 }], cropY: -0.04, lengthLabel: 'Length' }),
  pants: {
    id: 'pants',
    label: 'Pants',
    file: 'models/pants.glb',
    cropY: -0.04,
    lengthLabel: 'Leg length',
    defaults: { color: '#2f3d2c', fabric: 'twill' },
    productType: 'Pants',
    parts: [
      { id: 'front', label: 'Front panels', kind: 'cloth' },
      { id: 'back', label: 'Back panels', kind: 'cloth' },
      { id: 'pockets', label: 'Pockets', kind: 'cloth' },
      { id: 'waistband', label: 'Waistband', kind: 'cloth' },
      { id: 'loops', label: 'Belt loops', kind: 'cloth' },
      { id: 'hems', label: 'Hems', kind: 'cloth' },
      { id: 'button', label: 'Button', kind: 'hardware' },
    ],
    placements: [
      { id: 'thigh', label: 'Left thigh', x: 0.075, y: 0.06, side: 'front', size: 0.09 },
      { id: 'knee', label: 'Left knee', x: 0.075, y: -0.1, side: 'front', size: 0.08 },
      { id: 'shin', label: 'Right shin', x: -0.075, y: -0.26, side: 'front', size: 0.07 },
      { id: 'pocket', label: 'Back pocket', x: 0.075, y: 0.24, side: 'back', size: 0.09 },
      { id: 'calf', label: 'Right calf', x: -0.075, y: -0.2, side: 'back', size: 0.08 },
    ],
  },
}

export interface FabricDef {
  id: string
  label: string
  note: string
  /** Physical size of one texture tile, metres. */
  tile: number
  roughness: number
  sheen: number
  sheenRoughness: number
  normal: number
}

export const FABRICS: FabricDef[] = [
  { id: 'jersey', label: 'Cotton jersey', note: '180 gsm · soft knit', tile: 0.028, roughness: 0.88, sheen: 0.35, sheenRoughness: 0.75, normal: 0.45 },
  { id: 'heavy', label: 'Heavy jersey', note: '280 gsm · boxy drape', tile: 0.036, roughness: 0.92, sheen: 0.4, sheenRoughness: 0.8, normal: 0.6 },
  { id: 'fleece', label: 'Brushed fleece', note: '420 gsm · peached face', tile: 0.08, roughness: 0.98, sheen: 0.9, sheenRoughness: 0.9, normal: 0.35 },
  { id: 'pique', label: 'Piqué', note: '220 gsm · honeycomb', tile: 0.032, roughness: 0.85, sheen: 0.3, sheenRoughness: 0.7, normal: 0.7 },
  { id: 'rib', label: 'Rib 2×2', note: '468 gsm · trims', tile: 0.04, roughness: 0.9, sheen: 0.35, sheenRoughness: 0.8, normal: 1.2 },
  { id: 'waffle', label: 'Waffle', note: '260 gsm · thermal', tile: 0.06, roughness: 0.9, sheen: 0.3, sheenRoughness: 0.8, normal: 1.3 },
  { id: 'twill', label: 'Cotton twill', note: '260 gsm · chino', tile: 0.032, roughness: 0.78, sheen: 0.2, sheenRoughness: 0.6, normal: 0.8 },
  { id: 'denim', label: 'Raw denim', note: '14 oz · indigo slub', tile: 0.04, roughness: 0.82, sheen: 0.15, sheenRoughness: 0.6, normal: 1.1 },
  { id: 'canvas', label: 'Canvas', note: '340 gsm · plain weave', tile: 0.03, roughness: 0.86, sheen: 0.1, sheenRoughness: 0.7, normal: 0.7 },
  { id: 'linen', label: 'Washed linen', note: '190 gsm · slubby', tile: 0.08, roughness: 0.9, sheen: 0.15, sheenRoughness: 0.8, normal: 1 },
  { id: 'corduroy', label: 'Corduroy', note: '8 wale · plush', tile: 0.06, roughness: 0.85, sheen: 1, sheenRoughness: 0.55, normal: 1.6 },
  { id: 'satin', label: 'Silk satin', note: '90 gsm · liquid', tile: 0.05, roughness: 0.32, sheen: 0.6, sheenRoughness: 0.3, normal: 0.12 },
  { id: 'leather', label: 'Nappa leather', note: '1.1 mm · full grain', tile: 0.1, roughness: 0.46, sheen: 0, sheenRoughness: 0.5, normal: 0.9 },
]

export const HARDWARE = [
  { id: 'horn', label: 'Horn', roughness: 0.35, metalness: 0 },
  { id: 'metal', label: 'Metal', roughness: 0.28, metalness: 1 },
  { id: 'matte', label: 'Matte', roughness: 0.75, metalness: 0 },
]

export type PatternKind = 'solid' | 'stripes' | 'pinstripe' | 'check' | 'gingham' | 'dots' | 'camo' | 'tiedye' | 'image'
export const PATTERNS: { id: PatternKind; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'stripes', label: 'Stripes' },
  { id: 'pinstripe', label: 'Pinstripe' },
  { id: 'check', label: 'Check' },
  { id: 'gingham', label: 'Gingham' },
  { id: 'dots', label: 'Dots' },
  { id: 'camo', label: 'Camo' },
  { id: 'tiedye', label: 'Tie-dye' },
  { id: 'image', label: 'Your image' },
]

export const SWATCHES = ['#16130e', '#f5f3ee', '#8a8a86', '#6b4f3a', '#2f3d2c', '#1f2a44', '#b8963e', '#a33b32', '#d8cdb8', '#7c8c9e', '#e0a8a0', '#3e2a4f']

export const FONTS = [
  { id: 'Space Grotesk', label: 'Grotesk' },
  { id: 'Archivo Black', label: 'Heavy' },
  { id: 'Bebas Neue', label: 'Poster' },
  { id: 'Playfair Display', label: 'Editorial' },
  { id: 'Pirata One', label: 'Blackletter' },
  { id: 'Permanent Marker', label: 'Marker' },
  { id: 'Pacifico', label: 'Script' },
  { id: 'Silkscreen', label: 'Pixel' },
]
export const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&family=Pacifico&family=Permanent+Marker&family=Pirata+One&family=Playfair+Display:wght@700&family=Silkscreen&display=swap'

export const FINISHES = [
  { id: 'print', label: 'Screen print' },
  { id: 'puff', label: 'Puff print' },
  { id: 'embroidery', label: 'Embroidery' },
  { id: 'foil', label: 'Metallic foil' },
  { id: 'patch', label: 'Woven patch' },
] as const
export type Finish = (typeof FINISHES)[number]['id']

export const SHAPES: { id: string; label: string; path: string }[] = [
  { id: 'star', label: 'Star', path: 'M50 4l14 31 34 4-25 23 7 34-30-17-30 17 7-34L2 39l34-4z' },
  { id: 'spark', label: 'Spark', path: 'M50 2c4 30 16 42 48 48-32 6-44 18-48 48-4-30-16-42-48-48 32-6 44-18 48-48z' },
  { id: 'bolt', label: 'Bolt', path: 'M60 2L14 56h28l-8 42 52-58H56z' },
  { id: 'heart', label: 'Heart', path: 'M50 92C14 64 2 46 2 28 2 12 15 4 27 4c10 0 18 6 23 15C55 10 63 4 73 4c12 0 25 8 25 24 0 18-12 36-48 64z' },
  { id: 'ring', label: 'Ring', path: 'M50 2a48 48 0 100 96 48 48 0 000-96zm0 16a32 32 0 110 64 32 32 0 010-64z' },
  { id: 'cross', label: 'Cross', path: 'M36 2h28v34h34v28H64v34H36V64H2V36h34z' },
]

export interface PatternStyle { kind: PatternKind; color: string; scale: number; angle: number; image?: string }
export interface PartStyle { color: string; fabric: string; pattern: PatternStyle; hardware?: string }

export interface Layer {
  id: string
  kind: 'text' | 'image' | 'shape'
  name: string
  visible: boolean
  // placement, model space
  p: [number, number, number]
  n: [number, number, number]
  size: number
  rotation: number
  opacity: number
  finish: Finish
  color: string
  // text
  text?: string
  font?: string
  weight?: number
  tracking?: number
  curve?: number
  outline?: number
  outlineColor?: string
  // image / shape
  src?: string
  knockout?: boolean
  shape?: string
}

export interface Design {
  garment: GarmentId
  parts: Record<string, PartStyle>
  layers: Layer[]
  fit: number
  depth: number
  length: number
  sleeve: number
  /** Studio backdrop behind the garment: used for product shots and the shop's 3D view. */
  backdrop?: string
  /** Track id from feed/tracks.ts: plays with this piece in the feed. */
  sound?: string
  /** How the garment moves on the runway. */
  motion?: 'spin' | 'sway' | 'float'
}

export const DEFAULT_BACKDROP = '#e9e3d7'
export const BACKDROPS = ['#e9e3d7', '#f2c9b8', '#e8a48f', '#d96f5a', '#f4d35e', '#e9b44c', '#b7d3a8', '#6f9f7a', '#2f5d50', '#a8d5e2', '#5b8fb9', '#1f3a5f', '#c9b6e4', '#7b5ea7', '#f2b5d4', '#8a8a86', '#2b2925']

/** A soft studio sweep: lighter behind the garment, the backdrop colour at the edges. */
export function backdropStops(hex: string): [string, string] {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number, t: number, k: number) => Math.round(c + (t - c) * k)
  const light = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c, 255, 0.32))
  return [`rgb(${light.join(',')})`, hex]
}

export const backdropCss = (hex: string) => {
  const [inner, outer] = backdropStops(hex)
  return `radial-gradient(85% 75% at 50% 40%, ${inner} 0%, ${outer} 100%)`
}

const SOLID = (color = '#16130e'): PatternStyle => ({ kind: 'solid', color, scale: 0.12, angle: 0 })

export function defaultDesign(garment: GarmentId): Design {
  const def = GARMENTS[garment]
  const parts: Record<string, PartStyle> = {}
  for (const p of def.parts) {
    parts[p.id] = {
      color: p.kind === 'hardware' ? (p.id === 'zipper' || (p.id === 'buttons' && def.defaults.fabric === 'denim') ? '#b9b7b1' : '#3a2a1e') : def.defaults.color,
      fabric: p.fabric ?? def.defaults.fabric,
      pattern: SOLID(),
      ...(p.kind === 'hardware' ? { hardware: p.id === 'zipper' || def.defaults.fabric === 'denim' ? 'metal' : 'horn' } : {}),
    }
  }
  return { garment, parts, layers: [], fit: 1, depth: 1, length: 1, sleeve: 1 }
}

export const fabricById = (id: string) => FABRICS.find((f) => f.id === id) ?? FABRICS[0]

/** The product type the drop form should use for this design. */
export function productType(d: Design) {
  if (d.garment === 'pants' && d.length < 0.55) return 'Shorts'
  return GARMENTS[d.garment].productType
}

/** Human-readable spec: goes in the product description and on the factory sheet. */
export function specLines(d: Design): string[] {
  const def = GARMENTS[d.garment]
  const lines: string[] = []
  for (const p of def.parts) {
    const s = d.parts[p.id]
    if (p.kind === 'thread') lines.push(`${p.label}: thread ${s.color}`)
    else if (p.kind === 'hardware') lines.push(`${p.label}: ${s.hardware} ${s.color}`)
    else {
      const f = fabricById(s.fabric)
      const pat = s.pattern.kind === 'solid' ? '' : ` · ${s.pattern.kind} ${s.pattern.color}`
      lines.push(`${p.label}: ${f.label} (${f.note}) ${s.color}${pat}`)
    }
  }
  lines.push(`Fit: ${Math.round(d.fit * 100)}% width, ${Math.round(d.depth * 100)}% depth`)
  if (d.length < 1) lines.push(`${def.lengthLabel}: ${Math.round(d.length * 100)}% (cut + hem)`)
  if (def.sleeve && d.sleeve < 1) lines.push(`Sleeve length: ${Math.round(d.sleeve * 100)}%`)
  d.layers.filter((l) => l.visible).forEach((l, i) => {
    const what = l.kind === 'text' ? `"${l.text}" in ${l.font}` : l.name
    lines.push(`Artwork ${i + 1}: ${what}, ${Math.round(l.size * 100)} cm wide, ${l.finish}, ${l.kind === 'image' ? 'artwork colours' : l.color}`)
  })
  return lines
}
