import type { Stage } from '../api/types'

export const STAGE_META: Record<Stage | 'CANCELLED', { label: string; short: string; hint: string; color: string }> = {
  NEW: { short: 'New', label: 'New', hint: 'Order received', color: '#8b8b93' },
  MATERIALS: { short: 'Mat.', label: 'Materials', hint: 'Fabric & blanks', color: '#7c8cff' },
  PRINTING: { short: 'Print', label: 'Printing', hint: 'DTF / embroidery', color: '#b77cff' },
  SEWING: { short: 'Sew', label: 'Sewing', hint: 'Cut & sew', color: '#ff7cb7' },
  QUALITY: { short: 'QC', label: 'Quality', hint: 'QC check', color: '#ffa94d' },
  PACKAGING: { short: 'Pack', label: 'Packaging', hint: 'Fold, tag, box', color: '#e0b84c' },
  SHIPPING: { short: 'Ship', label: 'Shipping', hint: 'With courier', color: '#4dabf7' },
  DONE: { short: 'Done', label: 'Done', hint: 'Delivered', color: '#3fb67f' },
  CANCELLED: { short: 'Canc.', label: 'Cancelled', hint: '', color: '#ef6464' },
}
