/* Original tracks, written as data and synthesised live in the browser: nothing to download or license. */

export type Voice = 'keys' | 'pad' | 'pluck' | 'bell' | 'guitar' | 'stab'
export type Bass = 'sub' | 'round' | 'funk'

export interface Track {
  id: string
  title: string
  mood: string
  bpm: number
  swing?: number
  /** Drum grids: 16 steps per bar, repeated. x = hit, o = soft hit. */
  kick: string
  snare: string
  hat: string
  openHat?: string
  /** One chord per bar, note names. */
  chords: string[][]
  chordVoice: Voice
  /** Where the chord sounds within a bar, '' = held for the whole bar. */
  chordRhythm?: string
  bass: { kind: Bass; pattern: string }
  /** Melody, one string per bar: note names or '.' per 8th-note step. */
  lead?: { voice: Voice; bars: string[] }
  /** Drums drop out on these bars of the loop, so it breathes. */
  breakBars?: number[]
  gain?: number
}

export const TRACKS: Track[] = [
  {
    id: 'night-drive', title: 'Night Drive', mood: 'Trap', bpm: 140,
    kick: 'x.....x...x.....', snare: '........x.......', hat: 'x.x.x.x.x.xoxoxo', openHat: '..............x.',
    chords: [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['D3', 'F3', 'A3'], ['E3', 'G3', 'B3']], chordVoice: 'pad',
    bass: { kind: 'sub', pattern: 'x.....x...x.....' },
    lead: { voice: 'pluck', bars: ['E5 . C5 . A4 . . .', '. . A4 . C5 . E5 .', 'F5 . E5 . D5 . . .', 'B4 . . . E5 . . .'] },
  },
  {
    id: 'cold-chain', title: 'Cold Chain', mood: 'UK garage', bpm: 132, swing: 0.16,
    kick: 'x.......x.....x.', snare: '....x.......x...', hat: '..x...x...x...x.', openHat: '......x.......x.',
    chords: [['G3', 'A#3', 'D4', 'F4'], ['D#3', 'G3', 'A#3', 'D4'], ['C3', 'D#3', 'G3', 'A#3'], ['D3', 'F3', 'A3', 'C4']], chordVoice: 'stab', chordRhythm: '...x..x....x..x.',
    bass: { kind: 'round', pattern: 'x..x..x.....x...' },
    breakBars: [7],
  },
  {
    id: 'still-water', title: 'Still Water', mood: 'Ambient', bpm: 72,
    kick: '................', snare: '................', hat: '................',
    chords: [['C3', 'G3', 'D4', 'E4'], ['A2', 'E3', 'B3', 'C4'], ['F2', 'C3', 'G3', 'A3'], ['G2', 'D3', 'A3', 'B3']], chordVoice: 'pad',
    bass: { kind: 'sub', pattern: 'x...............' },
    lead: { voice: 'bell', bars: ['E5 . . . . . G5 .', '. . C5 . . . . .', 'A4 . . . C5 . . .', '. . . . D5 . . .'] },
  },
  {
    id: 'paper-moon', title: 'Paper Moon', mood: 'Piano', bpm: 88, swing: 0.1,
    kick: 'x.........x.....', snare: '................', hat: '..o...o...o...o.',
    chords: [['D3', 'F#3', 'A3', 'C#4'], ['B2', 'D3', 'F#3', 'A3'], ['G2', 'B2', 'D3', 'F#3'], ['A2', 'C#3', 'E3', 'G3']], chordVoice: 'keys', chordRhythm: 'x.....x.....x...',
    bass: { kind: 'round', pattern: 'x.......x.......' },
    lead: { voice: 'keys', bars: ['F#5 . A5 . . . E5 .', 'D5 . . . F#5 . . .', 'B4 . D5 . . . A4 .', 'C#5 . . . E5 . . .'] },
  },
  {
    id: 'sunday-loft', title: 'Sunday Loft', mood: 'Lo-fi', bpm: 84, swing: 0.2,
    kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.o.',
    chords: [['F3', 'A3', 'C4', 'E4'], ['E3', 'G3', 'B3', 'D4'], ['D3', 'F3', 'A3', 'C4'], ['G3', 'B3', 'D4', 'F4']], chordVoice: 'keys', chordRhythm: 'x.......x..x....',
    bass: { kind: 'round', pattern: 'x.......x.x.....' },
    lead: { voice: 'pluck', bars: ['. . A4 . C5 . . .', 'B4 . . . . . G4 .', '. . F4 . A4 . C5 .', 'D5 . . . . . . .'] },
  },
  {
    id: 'velvet-room', title: 'Velvet Room', mood: 'Deep house', bpm: 118,
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', openHat: '..x...x...x...x.',
    chords: [['A3', 'C4', 'E4', 'G4'], ['D3', 'F3', 'A3', 'C4'], ['G3', 'B3', 'D4', 'F4'], ['C3', 'E3', 'G3', 'B3']], chordVoice: 'keys', chordRhythm: '...x..x.....x...',
    bass: { kind: 'round', pattern: 'x..x...x..x.....' },
    breakBars: [7],
  },
  {
    id: 'red-line', title: 'Red Line', mood: 'Peak house', bpm: 128,
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', openHat: '..x...x...x...x.',
    chords: [['E3', 'G3', 'B3'], ['C3', 'E3', 'G3'], ['G3', 'B3', 'D4'], ['D3', 'F#3', 'A3']], chordVoice: 'stab', chordRhythm: 'x..x..x..x..x...',
    bass: { kind: 'funk', pattern: '..x...x...x...x.' },
    lead: { voice: 'pluck', bars: ['E5 . G5 . B5 . G5 .', 'E5 . G5 . C6 . G5 .', 'D5 . G5 . B5 . G5 .', 'D5 . F#5 . A5 . F#5 .'] },
  },
  {
    id: 'tape-73', title: 'Tape 73', mood: 'Retro funk', bpm: 100, swing: 0.12,
    kick: 'x..x....x.x.....', snare: '....x.......x..o', hat: 'x.x.x.x.x.x.x.x.',
    chords: [['A3', 'C4', 'E4', 'G4'], ['D3', 'F#3', 'A3', 'C4']], chordVoice: 'stab', chordRhythm: '..x..x....x..x..',
    bass: { kind: 'funk', pattern: 'x..x.x..x.x..x.x' },
    lead: { voice: 'pluck', bars: ['. . E5 . G5 . A5 .', '. . . . F#5 . D5 .'] },
  },
  {
    id: 'static-bloom', title: 'Static Bloom', mood: 'Grunge', bpm: 108,
    kick: 'x.x.....x.x.....', snare: '....x.......x...', hat: 'x...x...x...x...', openHat: 'x...x...x...x...',
    chords: [['E2', 'B2', 'E3'], ['G2', 'D3', 'G3'], ['A2', 'E3', 'A3'], ['C3', 'G3', 'C4']], chordVoice: 'guitar', chordRhythm: 'x..x..x...x..x..',
    bass: { kind: 'round', pattern: 'x..x..x...x..x..' },
    breakBars: [3], gain: 0.8,
  },
  {
    id: 'mall-2000', title: 'Mall 2000', mood: 'Synth pop', bpm: 124,
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx',
    chords: [['C4', 'E4', 'G4'], ['G3', 'B3', 'D4'], ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4']], chordVoice: 'pad',
    bass: { kind: 'funk', pattern: 'x.x.x.x.x.x.x.x.' },
    lead: { voice: 'pluck', bars: ['G5 . E5 . C5 . E5 .', 'D5 . B4 . G4 . B4 .', 'E5 . C5 . A4 . C5 .', 'F5 . C5 . A4 . C5 .'] },
  },
]

const BY_STYLE: Record<string, string[]> = {
  Streetwear: ['night-drive', 'cold-chain'],
  Minimalism: ['still-water', 'paper-moon'],
  Casual: ['sunday-loft', 'tape-73'],
  Luxury: ['velvet-room', 'paper-moon'],
  Sport: ['red-line', 'night-drive'],
  Vintage: ['tape-73', 'sunday-loft'],
  Grunge: ['static-bloom', 'cold-chain'],
  Y2K: ['mall-2000', 'red-line'],
}

export const trackById = (id?: string | null) => TRACKS.find((t) => t.id === id)

/** The sound a piece plays with when its brand hasn't chosen one: stable, and it fits the brand's style. */
export function trackForStyle(style: string, seed: number): Track {
  const list = BY_STYLE[style] ?? ['sunday-loft', 'velvet-room']
  return trackById(list[Math.abs(seed) % list.length])!
}
