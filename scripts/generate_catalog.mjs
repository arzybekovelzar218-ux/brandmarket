// Renders the demo catalogue with the real 3D Studio engine: every product gets a design file and product shots.
// Run against a dev server:  npm i --no-save playwright-core && node scripts/generate_catalog.mjs http://localhost:5180
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const ORIGIN = process.argv[2] ?? 'http://localhost:5173'
const OUT = path.resolve('public/catalog')

export const BRANDS = {
  airu: { bg: '#e8e2d6', mark: '#16130e', ink: '#f5f3ee' },
  altyn: { bg: '#d9d2c3', mark: '#0f0e0c', ink: '#b8963e' },
  edelweiss: { bg: '#eef0ea', mark: '#8e9a8b', ink: '#ffffff' },
  frost: { bg: '#dde6ec', mark: '#1f3a5f', ink: '#dfe9f2' },
  kara: { bg: '#b9b6b0', mark: '#121214', ink: '#c0392b' },
  lume: { bg: '#f3e6ef', mark: '#b7a6e8', ink: '#ffffff' },
  'manas-wear': { bg: '#e6dccb', mark: '#6b2d1f', ink: '#d8cdb8' },
  'nomad-cloth': { bg: '#e9e3d7', mark: '#6f6a5c', ink: '#f5f3ee' },
  nomada: { bg: '#e4d8c4', mark: '#7a5a3c', ink: '#f2e7d5' },
  pik: { bg: '#dfe2da', mark: '#e2622b', ink: '#1d2a24' },
  raven: { bg: '#a9a8a5', mark: '#0c0c0e', ink: '#e6e6e6' },
  saadat: { bg: '#efe7dc', mark: '#5a3a3f', ink: '#efe8dc' },
  steppe: { bg: '#ece5d3', mark: '#5d6b4a', ink: '#f0ebdd' },
  sunkar: { bg: '#e2e4e6', mark: '#1f2a44', ink: '#d9a441' },
  tamga: { bg: '#e5e0d0', mark: '#2f3d2c', ink: '#e9dfc9' },
  yurt: { bg: '#f0e3d3', mark: '#c98a5e', ink: '#f2e7d5' },
}

const text = (t, font, color, place, o = {}) => ({ kind: 'text', text: t, font, color, place, weight: font === 'Playfair Display' || font === 'Space Grotesk' ? 700 : 400, ...o })
const shape = (id, color, place, o = {}) => ({ kind: 'shape', shape: id, color, place, ...o })
const pat = (kind, color, scale, angle = 0) => ({ kind, color, scale, angle })

/* id, brand, name, garment, main colour, fabric, extras */
const P = [
  [1, 'airu', 'AIRU Washed Tee', 'tee', '#6b4f3a', 'heavy', { layers: [text('AIRU', 'Archivo Black', '#f5f3ee', 'center', { size: 0.26 }), text('AIRU', 'Archivo Black', '#f5f3ee', 'back', { size: 0.34 })] }],
  [2, 'airu', 'AIRU Boxy Hoodie', 'hoodie', '#16130e', 'fleece', { fit: 1.05, layers: [text('AIRU', 'Archivo Black', '#a33b32', 'center', { finish: 'puff', size: 0.24 }), text('BISHKEK', 'Archivo Black', '#f5f3ee', 'back', { size: 0.26, tracking: 0.12 })] }],
  [3, 'airu', 'AIRU Cropped Hoodie', 'hoodie', '#a33b32', 'fleece', { length: 0.42, layers: [text('AIRU', 'Archivo Black', '#f5f3ee', 'left', { finish: 'embroidery', size: 0.09 })] }],
  [4, 'nomad-cloth', 'NOMAD Thermal LS', 'long', '#d8cdb8', 'waffle', { layers: [text('NOMAD', 'Space Grotesk', '#6f6a5c', 'left', { finish: 'embroidery', size: 0.08, tracking: 0.1 })] }],
  [5, 'nomad-cloth', 'NOMAD Tapered Pants', 'pants', '#6f6a5c', 'twill', { fit: 0.95, layers: [text('NOMAD', 'Space Grotesk', '#d8cdb8', 'thigh', { size: 0.07, tracking: 0.1 })] }],
  [6, 'steppe', 'STEPPE Zip Hoodie', 'zip', '#5d6b4a', 'fleece', { layers: [text('STEPPE', 'Bebas Neue', '#f0ebdd', 'left', { finish: 'patch', size: 0.09 }), text('OPEN STEPPE', 'Bebas Neue', '#f0ebdd', 'back', { size: 0.3 })] }],
  [7, 'steppe', 'STEPPE Striped Longsleeve', 'long', '#f0ebdd', 'jersey', { parts: { sleeve_l: { pattern: pat('stripes', '#5d6b4a', 0.05) }, sleeve_r: { pattern: pat('stripes', '#5d6b4a', 0.05) } }, layers: [text('STEPPE', 'Bebas Neue', '#5d6b4a', 'center', { size: 0.24 })] }],
  [8, 'steppe', 'STEPPE Thermal LS', 'long', '#b9a37a', 'waffle', { layers: [shape('ring', '#f0ebdd', 'left', { finish: 'embroidery', size: 0.06 })] }],
  [9, 'kara', 'KARA Layer Longsleeve', 'long', '#121214', 'heavy', { layers: [text('KARA', 'Pirata One', '#c0392b', 'center', { size: 0.3 }), text('RAW', 'Pirata One', '#c0392b', 'sleeveL', { size: 0.09 })] }],
  [10, 'kara', 'KARA Wide Pants', 'pants', '#121214', 'canvas', { fit: 1.18, depth: 1.1, layers: [text('KARA', 'Pirata One', '#c0392b', 'thigh', { size: 0.1 })] }],
  [11, 'manas-wear', 'MANAS Crew Sweatshirt', 'sweat', '#6b2d1f', 'fleece', { layers: [text('MANAS', 'Bebas Neue', '#d8cdb8', 'center', { size: 0.3, tracking: 0.04 })] }],
  [12, 'manas-wear', 'MANAS Relaxed Pants', 'pants', '#1f2a44', 'corduroy', { fit: 1.1, layers: [] }],
  [13, 'manas-wear', 'MANAS Heritage Crew', 'sweat', '#d8cdb8', 'fleece', { layers: [text('MANAS WEAR', 'Bebas Neue', '#6b2d1f', 'center', { size: 0.28, curve: 0.3 }), shape('star', '#6b2d1f', 'hem', { size: 0.06, finish: 'embroidery' })] }],
  [14, 'manas-wear', 'MANAS Denim Shorts', 'pants', '#1f2a44', 'denim', { length: 0.25, parts: { button: { hardware: 'metal', color: '#b9b7b1' } }, layers: [text('MW', 'Bebas Neue', '#d8cdb8', 'pocket', { size: 0.06 })] }],
  [15, 'altyn', 'ALTYN Crew Sweat', 'sweat', '#0f0e0c', 'fleece', { layers: [text('ALTYN', 'Playfair Display', '#b8963e', 'center', { finish: 'foil', size: 0.2, tracking: 0.1 })] }],
  [16, 'altyn', 'ALTYN Tailored Pants', 'pants', '#efe6cf', 'twill', { parts: { button: { hardware: 'metal', color: '#b8963e' } }, layers: [] }],
  [17, 'frost', 'FROST Colorblock Sweat', 'sweat', '#dfe9f2', 'fleece', { parts: { sleeve_l: { color: '#1f3a5f' }, sleeve_r: { color: '#1f3a5f' }, cuffs: { color: '#1f3a5f' } }, layers: [text('FROST', 'Silkscreen', '#1f3a5f', 'center', { size: 0.2 })] }],
  [18, 'frost', 'FROST Denim Shorts', 'pants', '#7c9cbf', 'denim', { length: 0.3, parts: { button: { hardware: 'metal', color: '#b9b7b1' } }, layers: [] }],
  [19, 'frost', 'FROST Graphic Tee', 'tee', '#1f3a5f', 'jersey', { layers: [shape('spark', '#dfe9f2', 'center', { size: 0.2 }), text('FROST', 'Silkscreen', '#dfe9f2', 'back', { size: 0.24 })] }],
  [20, 'frost', 'FROST Boxy Tee', 'tee', '#dfe9f2', 'heavy', { fit: 1.08, layers: [text('FROST', 'Silkscreen', '#1f3a5f', 'left', { size: 0.09 })] }],
  [21, 'yurt', 'YURT Classic Tee', 'tee', '#c98a5e', 'jersey', { layers: [text('yurt', 'Pacifico', '#f2e7d5', 'center', { size: 0.2 })] }],
  [22, 'yurt', 'YURT Crew Sweatshirt', 'sweat', '#f2e7d5', 'fleece', { layers: [text('yurt', 'Pacifico', '#8a5a44', 'left', { finish: 'embroidery', size: 0.09 })] }],
  [23, 'yurt', 'YURT Gingham Tee', 'tee', '#f2e7d5', 'jersey', { cloth: { pattern: pat('gingham', '#8a5a44', 0.05) }, parts: { collar: { pattern: pat('solid', '#16130e', 0.1), color: '#8a5a44' } }, layers: [] }],
  [24, 'tamga', 'TAMGA Symbol Hoodie', 'hoodie', '#e9dfc9', 'fleece', { layers: [shape('cross', '#a33b32', 'left', { size: 0.06, finish: 'embroidery' }), shape('ring', '#2f3d2c', 'back', { size: 0.24, finish: 'puff' })] }],
  [25, 'tamga', 'TAMGA Camo Hoodie', 'hoodie', '#2f3d2c', 'fleece', { cloth: { pattern: pat('camo', '#6b6a4a', 0.34) }, parts: { hem: { pattern: pat('solid', '#16130e', 0.1) }, cuffs: { pattern: pat('solid', '#16130e', 0.1) }, hood_trim: { pattern: pat('solid', '#16130e', 0.1) } }, layers: [text('TAMGA', 'Bebas Neue', '#e9dfc9', 'center', { finish: 'patch', size: 0.14 })] }],
  [26, 'edelweiss', 'EDELWEISS Crew Sweatshirt', 'sweat', '#e9e6de', 'fleece', { layers: [] }],
  [27, 'edelweiss', 'EDELWEISS Boxy Hoodie', 'hoodie', '#8e9a8b', 'fleece', { fit: 1.05, layers: [shape('spark', '#e9e6de', 'left', { size: 0.045, finish: 'embroidery' })] }],
  [28, 'edelweiss', 'EDELWEISS Linen Crew', 'sweat', '#4a4a42', 'linen', { layers: [] }],
  [29, 'nomada', 'NOMADA Sweat Shorts', 'pants', '#7a5a3c', 'fleece', { length: 0.3, layers: [text('NOMADA', 'Playfair Display', '#f2e7d5', 'thigh', { size: 0.08 })] }],
  [30, 'nomada', 'NOMADA Striped Longsleeve', 'long', '#c9a27a', 'jersey', { cloth: { pattern: pat('stripes', '#7a5a3c', 0.05) }, parts: { collar: { pattern: pat('solid', '#16130e', 0.1), color: '#7a5a3c' } }, layers: [] }],
  [31, 'nomada', 'NOMADA Retro Longsleeve', 'long', '#3e4a3a', 'heavy', { layers: [text('NOMADA', 'Playfair Display', '#c9a27a', 'center', { size: 0.26, curve: 0.25 })] }],
  [32, 'pik', 'PIK Summit Tee', 'tee', '#e2622b', 'heavy', { layers: [shape('bolt', '#1d2a24', 'center', { size: 0.14 }), text('PIK', 'Archivo Black', '#1d2a24', 'back', { size: 0.2 })] }],
  [33, 'pik', 'PIK Trail Pants', 'pants', '#1d2a24', 'canvas', { parts: { waistband: { color: '#e2622b' }, loops: { color: '#e2622b' }, hems: { color: '#e2622b' } }, layers: [text('PIK', 'Archivo Black', '#e2622b', 'thigh', { size: 0.07 })] }],
  [34, 'pik', 'PIK Zip Hoodie', 'zip', '#1d2a24', 'fleece', { parts: { hood: { color: '#e2622b' }, cuffs: { color: '#e2622b' }, hem: { color: '#e2622b' }, zipper: { color: '#e2622b', hardware: 'matte' } }, layers: [text('PIK', 'Archivo Black', '#e2622b', 'left', { size: 0.07 })] }],
  [35, 'saadat', 'SAADAT Plum Crew', 'sweat', '#5a3a3f', 'fleece', { layers: [text('SAADAT', 'Playfair Display', '#efe8dc', 'left', { finish: 'embroidery', size: 0.09 })] }],
  [36, 'saadat', 'SAADAT Silk Crew', 'sweat', '#efe8dc', 'satin', { layers: [text('SAADAT', 'Playfair Display', '#b8963e', 'center', { finish: 'foil', size: 0.18, tracking: 0.08 })] }],
  [37, 'raven', 'RAVEN Fleece Crew', 'sweat', '#0c0c0e', 'fleece', { layers: [text('RAVEN', 'Pirata One', '#e6e6e6', 'center', { size: 0.3 })] }],
  [38, 'raven', 'RAVEN Dyed Tee', 'tee', '#26262b', 'heavy', { cloth: { pattern: pat('tiedye', '#55555c', 0.26) }, parts: { collar: { pattern: pat('solid', '#16130e', 0.1), color: '#0c0c0e' } }, layers: [text('RAVEN', 'Pirata One', '#e6e6e6', 'center', { size: 0.24 })] }],
  [39, 'raven', 'RAVEN Graphic Tee', 'tee', '#0c0c0e', 'heavy', { layers: [shape('cross', '#e6e6e6', 'left', { size: 0.05 }), text('NEVERMORE', 'Pirata One', '#e6e6e6', 'back', { size: 0.34 })] }],
  [40, 'raven', 'RAVEN Raw Tee', 'tee', '#e6e6e6', 'jersey', { length: 0.6, layers: [text('RAVEN', 'Pirata One', '#0c0c0e', 'center', { size: 0.2 })] }],
  [41, 'sunkar', 'SUNKAR Ribbed Longsleeve', 'long', '#1f2a44', 'rib', { layers: [text('SUNKAR', 'Permanent Marker', '#d9a441', 'center', { size: 0.24 })] }],
  [42, 'sunkar', 'SUNKAR Track Shorts', 'pants', '#f5f3ee', 'canvas', { length: 0.2, parts: { waistband: { color: '#1f2a44' }, loops: { color: '#1f2a44' }, pockets: { color: '#1f2a44' } }, layers: [] }],
  [43, 'sunkar', 'SUNKAR Falcon Longsleeve', 'long', '#f5f3ee', 'jersey', { layers: [text('FALCON', 'Permanent Marker', '#1f2a44', 'center', { size: 0.26 }), text('SUNKAR', 'Permanent Marker', '#d9a441', 'back', { size: 0.28 })] }],
  [44, 'lume', 'LUME Classic Tee', 'tee', '#e0a8c0', 'jersey', { layers: [text('lume', 'Pacifico', '#ffffff', 'center', { size: 0.2 }), shape('heart', '#ffffff', 'hem', { size: 0.05, finish: 'puff' })] }],
  [45, 'lume', 'LUME Dyed Hoodie', 'hoodie', '#b7a6e8', 'fleece', { fit: 1.06, cloth: { pattern: pat('tiedye', '#e0a8c0', 0.3) }, parts: { hem: { pattern: pat('solid', '#16130e', 0.1) }, cuffs: { pattern: pat('solid', '#16130e', 0.1) }, hood_trim: { pattern: pat('solid', '#16130e', 0.1) } }, layers: [text('lume', 'Pacifico', '#ffffff', 'center', { finish: 'puff', size: 0.18 })] }],
  [46, 'lume', 'LUME Crew Sweatshirt', 'sweat', '#7fd6c9', 'fleece', { layers: [text('LUME 2000', 'Silkscreen', '#3e2a4f', 'center', { size: 0.26 })] }],
  [47, 'lume', 'LUME Cropped Hoodie', 'hoodie', '#f4e36b', 'fleece', { length: 0.42, layers: [text('lume', 'Pacifico', '#3e2a4f', 'center', { size: 0.15 })] }],
  // New models. Trailing fields: product type and price.
  [48, 'saadat', 'SAADAT Silk Shirt', 'shirt', '#efe8dc', 'satin', { type: 'Shirt', price: 4200, parts: { buttons: { hardware: 'metal', color: '#b8963e' } }, layers: [text('S', 'Playfair Display', '#b8963e', 'left', { finish: 'foil', size: 0.035 })] }],
  [49, 'altyn', 'ALTYN Black Shirt', 'shirt', '#0f0e0c', 'twill', { type: 'Shirt', price: 3900, parts: { buttons: { hardware: 'metal', color: '#b8963e' } }, layers: [text('ALTYN', 'Playfair Display', '#b8963e', 'neck', { finish: 'foil', size: 0.07 })] }],
  [50, 'nomad-cloth', 'NOMAD Linen Shirt', 'shirt', '#d8cdb8', 'linen', { type: 'Shirt', price: 2900, layers: [] }],
  [51, 'tamga', 'TAMGA Check Overshirt', 'shirt', '#2f3d2c', 'canvas', { type: 'Shirt', price: 3400, cloth: { pattern: pat('check', '#a33b32', 0.1) }, layers: [] }],
  [52, 'yurt', 'YURT Gingham Shirt', 'shortshirt', '#f2e7d5', 'linen', { type: 'Shirt', price: 2300, cloth: { pattern: pat('gingham', '#c98a5e', 0.04) }, layers: [] }],
  [53, 'sunkar', 'SUNKAR Resort Shirt', 'shortshirt', '#1f2a44', 'satin', { type: 'Shirt', price: 3100, cloth: { pattern: pat('dots', '#d9a441', 0.05) }, layers: [] }],
  [54, 'lume', 'LUME Bowling Shirt', 'shortshirt', '#e0a8c0', 'twill', { type: 'Shirt', price: 2700, parts: { sleeve_l: { color: '#7fd6c9' }, sleeve_r: { color: '#7fd6c9' }, collar: { color: '#7fd6c9' } }, layers: [text('lume', 'Pacifico', '#ffffff', 'back', { size: 0.24 }), text('lume', 'Pacifico', '#ffffff', 'left', { finish: 'embroidery', size: 0.07 })] }],
  [55, 'frost', 'FROST Pique Polo', 'polo', '#dfe9f2', 'pique', { type: 'Polo', price: 2200, parts: { collar: { color: '#1f3a5f' } }, layers: [text('FROST', 'Silkscreen', '#1f3a5f', 'left', { size: 0.08 })] }],
  [56, 'altyn', 'ALTYN Knit Polo', 'polo', '#0f0e0c', 'waffle', { type: 'Polo', price: 3300, layers: [shape('spark', '#b8963e', 'left', { finish: 'foil', size: 0.04 })] }],
  [57, 'edelweiss', 'EDELWEISS Polo', 'polo', '#8e9a8b', 'pique', { type: 'Polo', price: 2500, layers: [shape('spark', '#e9e6de', 'left', { finish: 'embroidery', size: 0.035 })] }],
  [58, 'pik', 'PIK Field Jacket', 'workjacket', '#1d2a24', 'canvas', { type: 'Jacket', price: 5200, parts: { pockets: { color: '#e2622b' }, collar: { color: '#e2622b' } }, layers: [text('PIK', 'Archivo Black', '#e2622b', 'back', { size: 0.2 })] }],
  [59, 'steppe', 'STEPPE Chore Jacket', 'workjacket', '#b9a37a', 'canvas', { type: 'Jacket', price: 4800, parts: { collar: { color: '#5d6b4a', fabric: 'corduroy' } }, layers: [text('OPEN STEPPE', 'Bebas Neue', '#5d6b4a', 'back', { finish: 'patch', size: 0.2 })] }],
  [60, 'raven', 'RAVEN Denim Jacket', 'workjacket', '#26262b', 'denim', { type: 'Jacket', price: 5400, layers: [text('RAVEN', 'Pirata One', '#e6e6e6', 'back', { size: 0.3 })] }],
  [61, 'airu', 'AIRU Varsity', 'varsity', '#16130e', 'fleece', { type: 'Jacket', price: 6200, parts: { sleeve_l: { color: '#f5f3ee', fabric: 'leather' }, sleeve_r: { color: '#f5f3ee', fabric: 'leather' }, buttons: { hardware: 'metal', color: '#b9b7b1' } }, layers: [text('A', 'Archivo Black', '#a33b32', 'left', { finish: 'patch', size: 0.09 }), text('AIRU', 'Archivo Black', '#f5f3ee', 'back', { finish: 'patch', size: 0.28 })] }],
  [62, 'manas-wear', 'MANAS Varsity', 'varsity', '#6b2d1f', 'fleece', { type: 'Jacket', price: 5900, parts: { sleeve_l: { color: '#d8cdb8', fabric: 'leather' }, sleeve_r: { color: '#d8cdb8', fabric: 'leather' } }, layers: [text('M', 'Bebas Neue', '#d8cdb8', 'left', { finish: 'patch', size: 0.08 }), text('MANAS', 'Bebas Neue', '#d8cdb8', 'back', { finish: 'patch', size: 0.28, curve: 0.25 })] }],
  [63, 'kara', 'KARA Satin Bomber', 'varsity', '#121214', 'satin', { type: 'Jacket', price: 5600, layers: [text('KARA', 'Pirata One', '#c0392b', 'back', { finish: 'embroidery', size: 0.3 })] }],
  [64, 'saadat', 'SAADAT Plum Blazer', 'blazer', '#5a3a3f', 'twill', { type: 'Blazer', price: 7200, parts: { buttons: { hardware: 'metal', color: '#b8963e' } }, layers: [] }],
  [65, 'altyn', 'ALTYN Tuxedo Blazer', 'blazer', '#0f0e0c', 'twill', { type: 'Blazer', price: 8900, parts: { collar: { fabric: 'satin' }, buttons: { hardware: 'metal', color: '#b8963e' } }, layers: [] }],
  [66, 'nomada', 'NOMADA Corduroy Blazer', 'blazer', '#7a5a3c', 'corduroy', { type: 'Blazer', price: 6400, layers: [] }],
  [67, 'nomad-cloth', 'NOMAD Utility Vest', 'vest', '#6f6a5c', 'canvas', { type: 'Vest', price: 2800, layers: [] }],
  [68, 'yurt', 'YURT Waffle Vest', 'vest', '#c98a5e', 'waffle', { type: 'Vest', price: 2600, layers: [] }],
  [69, 'lume', 'LUME Pleated Skirt', 'skirt', '#b7a6e8', 'satin', { type: 'Skirt', price: 2900, layers: [] }],
  [70, 'kara', 'KARA Plaid Skirt', 'skirt', '#121214', 'twill', { type: 'Skirt', price: 3100, cloth: { pattern: pat('check', '#c0392b', 0.09) }, parts: { waistband: { pattern: pat('solid', '#16130e', 0.1) } }, layers: [] }],
  [71, 'edelweiss', 'EDELWEISS Pleated Skirt', 'skirt', '#e9e6de', 'linen', { type: 'Skirt', price: 2700, layers: [] }],
  [72, 'airu', 'AIRU Baggy Jeans', 'jeans', '#1f2a44', 'denim', { type: 'Jeans', price: 4100, layers: [text('AIRU', 'Archivo Black', '#f5f3ee', 'thigh', { size: 0.1 })] }],
  [73, 'raven', 'RAVEN Black Baggy Jeans', 'jeans', '#0c0c0e', 'denim', { type: 'Jeans', price: 4300, layers: [text('RAVEN', 'Pirata One', '#e6e6e6', 'calf', { size: 0.1 })] }],
  [74, 'frost', 'FROST Light Wash Jeans', 'slimjeans', '#7c9cbf', 'denim', { type: 'Jeans', price: 3600, layers: [] }],
  [75, 'sunkar', 'SUNKAR Slim Jeans', 'slimjeans', '#1f2a44', 'denim', { type: 'Jeans', price: 3700, parts: { pockets: { color: '#d9a441' } }, layers: [] }],
  [76, 'pik', 'PIK Cargo Pants', 'cargo', '#1d2a24', 'canvas', { type: 'Pants', price: 3800, layers: [text('PIK', 'Archivo Black', '#e2622b', 'knee', { size: 0.06 })] }],
  [77, 'tamga', 'TAMGA Camo Cargo', 'cargo', '#2f3d2c', 'canvas', { type: 'Pants', price: 4000, cloth: { pattern: pat('camo', '#6b6a4a', 0.34) }, parts: { waistband: { pattern: pat('solid', '#16130e', 0.1) } }, layers: [] }],
  [78, 'kara', 'KARA Cargo Pants', 'cargo', '#121214', 'canvas', { type: 'Pants', price: 3900, layers: [text('KARA', 'Pirata One', '#c0392b', 'thigh', { size: 0.1 })] }],
  [79, 'steppe', 'STEPPE Sweat Shorts', 'shorts', '#5d6b4a', 'fleece', { type: 'Shorts', price: 1900, layers: [text('STEPPE', 'Bebas Neue', '#f0ebdd', 'thigh', { size: 0.09 })] }],
  [80, 'lume', 'LUME Terry Shorts', 'shorts', '#f4e36b', 'fleece', { type: 'Shorts', price: 2100, layers: [text('lume', 'Pacifico', '#3e2a4f', 'thigh', { size: 0.09 })] }],
  [81, 'manas-wear', 'MANAS Fleece Shorts', 'shorts', '#6b2d1f', 'fleece', { type: 'Shorts', price: 2000, layers: [] }],
]

/* A studio colour of its own for every product, chosen to stand apart from the garment. */
function hsl(h, s, l) {
  const f = (n) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
function toHsl(hex) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: h * 60, s: d === 0 ? 0 : d / (1 - Math.abs(max + min - 1)), l: (max + min) / 2 }
}
const POOL = []
for (let h = 0; h < 360; h += 15) for (const [s, l] of [[0.62, 0.74], [0.5, 0.58], [0.72, 0.84], [0.42, 0.38]]) POOL.push(hsl(h, s, l))
const BACKDROP = {}
{
  const pool = [...POOL]
  let seed = 7
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  for (const [id, , , , color] of P) {
    const g = toHsl(color)
    const at = pool.findIndex((c) => {
      const b = toHsl(c)
      const hue = Math.min(Math.abs(b.h - g.h), 360 - Math.abs(b.h - g.h))
      return Math.abs(b.l - g.l) > 0.22 && (g.s < 0.2 || hue > 45)
    })
    BACKDROP[id] = pool.splice(at < 0 ? 0 : at, 1)[0]
  }
}

fs.mkdirSync(path.join(OUT, 'designs'), { recursive: true })
fs.mkdirSync(path.join(OUT, 'brands'), { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } })
page.on('pageerror', (e) => console.error('PAGE', e.message))
await page.goto(`${ORIGIN}/login`)
await page.evaluate(async () => {
  const [{ StudioEngine }, cat] = await Promise.all([import('/src/studio/engine.ts'), import('/src/studio/catalog.ts')])
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = cat.FONT_CSS
  document.head.appendChild(link)
  await new Promise((r) => (link.onload = r))
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#fff'
  document.body.appendChild(host)
  let resolveLoad = () => {}
  const engine = new StudioEngine(host, {
    onPick() {}, onMoveLayer() {}, onMoveEnd() {}, onOverlay() {}, onOrbit() {}, onError: (m) => console.error(m),
    onLoading: (on) => { if (!on) resolveLoad() },
  }, { interactive: false })
  const toB64 = async (blob) => {
    const buf = new Uint8Array(await blob.arrayBuffer())
    let s = ''
    for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode(...buf.subarray(i, i + 32768))
    return btoa(s)
  }
  window.renderThumb = async (garment) => {
    const loaded = new Promise((r) => (resolveLoad = r))
    const fresh = !window.seen?.has(garment)
    ;(window.seen ??= new Set()).add(garment)
    engine.apply(cat.defaultDesign(garment), null)
    if (fresh) await loaded
    await new Promise((r) => setTimeout(r, 250))
    return toB64(await engine.snapshot('three', 320, 320, cat.DEFAULT_BACKDROP, 'image/jpeg', 0.8))
  }
  window.renderProduct = async (spec, bg, banner) => {
    const [id, , , garment, color, fabric, x] = spec
    const def = cat.GARMENTS[garment]
    const d = cat.defaultDesign(garment)
    for (const p of def.parts) {
      if (p.kind === 'hardware') continue
      d.parts[p.id] = { ...d.parts[p.id], color, ...(p.kind === 'cloth' ? { fabric: p.fabric && fabric !== 'denim' ? p.fabric : fabric, ...(x.cloth ?? {}) } : {}) }
      if (p.kind === 'cloth' && p.fabric === 'rib' && garment === 'long' && fabric === 'rib') d.parts[p.id].fabric = 'rib'
    }
    for (const [pid, o] of Object.entries(x.parts ?? {})) if (d.parts[pid]) d.parts[pid] = { ...d.parts[pid], ...o }
    d.fit = x.fit ?? 1
    d.depth = x.depth ?? 1
    d.length = x.length ?? 1
    d.backdrop = bg
    const loaded = new Promise((r) => (resolveLoad = r))
    const fresh = !window.seen?.has(garment)
    ;(window.seen ??= new Set()).add(garment)
    engine.apply(d, null)
    if (fresh) await loaded
    await new Promise((r) => setTimeout(r, 120))
    d.layers = (x.layers ?? []).map((l, i) => {
      const place = def.placements.find((p) => p.id === l.place)
      if (!place) throw new Error(`${id}: no placement ${l.place} on ${garment}`)
      const at = engine.locate(place)
      if (!at) throw new Error(`${id}: ${l.place} missed the garment`)
      const { place: _drop, ...rest } = l
      return { id: `l${i}`, name: l.text ?? l.shape, visible: true, rotation: 0, opacity: 1, finish: 'print', tracking: 0, curve: 0, outline: 0, outlineColor: '#ffffff', size: place.size, ...at, ...rest }
    })
    engine.apply(d, null)
    await document.fonts.ready
    await new Promise((r) => setTimeout(r, d.layers.length ? 900 : 300))
    const shots = {}
    for (const v of ['front', 'three', 'back']) shots[v] = await toB64(await engine.snapshot(v, 900, 1200, bg, 'image/webp', 0.82))
    if (banner) shots.banner = await toB64(await engine.snapshot('three', 1600, 600, bg, 'image/webp', 0.8))
    return { design: d, shots }
  }
})

const bannerDone = new Set()
const thumbsOnly = process.argv[3] === 'thumbs'
for (const spec of thumbsOnly ? [] : P) {
  const [id, brand, name, garment, color, fabric, x] = spec
  const b = BRANDS[brand]
  const banner = !bannerDone.has(brand) && garment !== 'pants'
  const { design, shots } = await page.evaluate(([s, bg, bn]) => window.renderProduct(s, bg, bn), [spec, BACKDROP[id], banner])
  fs.writeFileSync(path.join(OUT, 'designs', `${id}.json`), JSON.stringify(design))
  for (const v of ['front', 'three', 'back']) fs.writeFileSync(path.join(OUT, `${id}-${v}.webp`), Buffer.from(shots[v], 'base64'))
  if (banner) {
    bannerDone.add(brand)
    fs.writeFileSync(path.join(OUT, 'brands', `${brand}-banner.webp`), Buffer.from(shots.banner, 'base64'))
  }
  console.log(id, name)
}
// Model picker thumbnails in the Studio.
const thumbs = await page.evaluate(async () => {
  const [{ GARMENTS, defaultDesign }] = await Promise.all([import('/src/studio/catalog.ts')])
  return Object.keys(GARMENTS).map((id) => [id, defaultDesign(id)])
})
// Written only after every render: Vite reloads the page when public/studio changes.
const shots = []
for (const [id] of thumbs) shots.push([id, await page.evaluate(([g]) => window.renderThumb(g), [id])])
for (const [id, shot] of shots) fs.writeFileSync(path.resolve('public/studio', `thumb-${id}.jpg`), Buffer.from(shot, 'base64'))
for (const [slug, b] of Object.entries(BRANDS)) {
  const letter = slug.replace('nomad-cloth', 'N').replace('manas-wear', 'M')[0].toUpperCase()
  fs.writeFileSync(path.join(OUT, 'brands', `${slug}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${b.mark}"/><text x="100" y="138" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="112" fill="${b.ink}">${letter}</text></svg>`)
}
const index = P.map(([id, brand, name, garment, color, fabric, x]) => ({ id, brand, name, garment, color, fabric, length: x.length ?? 1, type: x.type, price: x.price, layers: (x.layers ?? []).map((l) => ({ what: l.text ?? l.shape, finish: l.finish ?? 'print' })) }))
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ products: index }, null, 1))
await browser.close()
console.log('done', P.length)
