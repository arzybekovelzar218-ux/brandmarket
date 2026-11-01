/* Small synth and step sequencer on the Web Audio API. Works on any BaseAudioContext, so tracks can be rendered offline. */
import { type Bass, type Track, trackById, type Voice } from './tracks'

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }
const midi = (n: string) => NOTE[n.slice(0, -1)] + 12 * (Number(n.slice(-1)) + 1)
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12)

class Kit {
  private ctx: BaseAudioContext
  private out: AudioNode
  private verb: AudioNode
  private echo: AudioNode
  private drive: AudioNode
  private noise: AudioBuffer

  constructor(ctx: BaseAudioContext, out: AudioNode) {
    this.ctx = ctx
    this.out = out
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1

    // Room reverb from a decaying noise impulse.
    const len = Math.floor(ctx.sampleRate * 1.9)
    const ir = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const data = ir.getChannelData(c)
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
    }
    const conv = ctx.createConvolver()
    conv.buffer = ir
    const verbGain = ctx.createGain()
    verbGain.gain.value = 0.32
    conv.connect(verbGain).connect(out)
    this.verb = conv

    const delay = ctx.createDelay(1)
    delay.delayTime.value = 0.28
    const fb = ctx.createGain()
    fb.gain.value = 0.32
    const wet = ctx.createGain()
    wet.gain.value = 0.28
    delay.connect(fb).connect(delay)
    delay.connect(wet).connect(out)
    this.echo = delay

    const shaper = ctx.createWaveShaper()
    const curve = new Float32Array(1024)
    for (let i = 0; i < 1024; i++) {
      const x = (i / 511.5 - 1) * 9
      curve[i] = Math.tanh(x)
    }
    shaper.curve = curve
    shaper.oversample = '2x'
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 3200
    const level = ctx.createGain()
    level.gain.value = 0.24
    shaper.connect(tone).connect(level).connect(out)
    this.drive = shaper
  }

  private env(t: number, peak: number, attack: number, decay: number, dest: AudioNode = this.out) {
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
    g.connect(dest)
    return g
  }

  private osc(type: OscillatorType, f: number, t: number, dur: number, dest: AudioNode, detune = 0) {
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f, t)
    o.detune.value = detune
    o.connect(dest)
    o.start(t)
    o.stop(t + dur)
    return o
  }

  private burst(t: number, dur: number, dest: AudioNode) {
    const s = this.ctx.createBufferSource()
    s.buffer = this.noise
    s.connect(dest)
    s.start(t, Math.random() * 0.5, dur)
  }

  kick(t: number, v: number) {
    const g = this.env(t, 0.72 * v, 0.002, 0.3)
    const o = this.osc('sine', 150, t, 0.34, g)
    o.frequency.exponentialRampToValueAtTime(46, t + 0.1)
    // A click, so the kick still reads on phone speakers.
    const c = this.ctx.createBiquadFilter()
    c.type = 'highpass'
    c.frequency.value = 2200
    c.connect(this.env(t, 0.16 * v, 0.001, 0.025))
    this.burst(t, 0.03, c)
  }

  snare(t: number, v: number) {
    const f = this.ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 2100
    f.Q.value = 0.6
    const g = this.env(t, 0.42 * v, 0.001, 0.17)
    f.connect(g)
    const send = this.ctx.createGain()
    send.gain.value = 0.25
    g.connect(send).connect(this.verb)
    this.burst(t, 0.2, f)
    this.osc('triangle', 195, t, 0.1, this.env(t, 0.22 * v, 0.001, 0.08))
  }

  hat(t: number, v: number, open: boolean) {
    const f = this.ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = 7600
    f.connect(this.env(t, (open ? 0.13 : 0.16) * v, 0.001, open ? 0.2 : 0.035))
    this.burst(t, open ? 0.24 : 0.05, f)
  }

  bass(t: number, m: number, dur: number, kind: Bass) {
    const f = hz(m)
    if (kind === 'sub') {
      this.osc('sine', f, t, dur + 0.05, this.env(t, 0.42, 0.008, dur))
      return
    }
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = kind === 'funk' ? 6 : 1
    lp.frequency.setValueAtTime(kind === 'funk' ? 1500 : 620, t)
    lp.frequency.exponentialRampToValueAtTime(kind === 'funk' ? 240 : 300, t + dur)
    lp.connect(this.env(t, kind === 'funk' ? 0.34 : 0.34, 0.005, dur))
    this.osc(kind === 'funk' ? 'sawtooth' : 'triangle', f, t, dur + 0.03, lp)
    this.osc('sine', f, t, dur + 0.03, this.env(t, 0.2, 0.005, dur))
  }

  voice(v: Voice, t: number, m: number, dur: number, level: number) {
    const f = hz(m)
    const sendTo = (node: AudioNode, bus: AudioNode, amount: number) => {
      const s = this.ctx.createGain()
      s.gain.value = amount
      node.connect(s).connect(bus)
    }
    switch (v) {
      case 'pad': {
        const lp = this.ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.setValueAtTime(420, t)
        lp.frequency.linearRampToValueAtTime(1500, t + dur * 0.6)
        const g = this.ctx.createGain()
        g.gain.setValueAtTime(0.0001, t)
        g.gain.linearRampToValueAtTime(0.14 * level, t + Math.min(0.5, dur / 3))
        g.gain.setValueAtTime(0.14 * level, t + dur * 0.7)
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.25)
        lp.connect(g)
        g.connect(this.out)
        sendTo(g, this.verb, 0.7)
        for (const det of [-9, 7]) this.osc('sawtooth', f, t, dur + 0.3, lp, det)
        break
      }
      case 'keys': {
        // Electric piano: a sine with a brief bright overtone.
        const g = this.env(t, 0.3 * level, 0.006, Math.max(dur, 0.7))
        this.osc('sine', f, t, Math.max(dur, 0.7) + 0.1, g)
        this.osc('sine', f * 2, t, 0.22, this.env(t, 0.1 * level, 0.002, 0.2, g))
        sendTo(g, this.verb, 0.4)
        break
      }
      case 'pluck': {
        const lp = this.ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.setValueAtTime(3800, t)
        lp.frequency.exponentialRampToValueAtTime(700, t + 0.22)
        const g = this.env(t, 0.24 * level, 0.002, 0.3)
        lp.connect(g)
        sendTo(g, this.echo, 0.5)
        this.osc('sawtooth', f, t, 0.36, lp)
        break
      }
      case 'bell': {
        const g = this.env(t, 0.13 * level, 0.002, 2.2)
        this.osc('sine', f, t, 2.3, g)
        this.osc('sine', f * 2.76, t, 0.5, this.env(t, 0.04 * level, 0.001, 0.45))
        sendTo(g, this.verb, 0.9)
        sendTo(g, this.echo, 0.3)
        break
      }
      case 'stab': {
        const lp = this.ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.Q.value = 3
        lp.frequency.setValueAtTime(2400, t)
        lp.frequency.exponentialRampToValueAtTime(650, t + 0.16)
        const g = this.env(t, 0.17 * level, 0.002, 0.2)
        lp.connect(g)
        sendTo(g, this.verb, 0.35)
        for (const det of [-6, 6]) this.osc('sawtooth', f, t, 0.26, lp, det)
        break
      }
      case 'guitar': {
        const g = this.env(t, 0.5 * level, 0.003, Math.max(dur, 0.15), this.drive)
        for (const det of [-5, 5]) this.osc('sawtooth', f, t, Math.max(dur, 0.15) + 0.05, g, det)
        break
      }
    }
  }
}

/** Puts one 16th-note step of a track on the timeline. Returns true if a kick landed there. */
function scheduleStep(kit: Kit, track: Track, step: number, t: number): boolean {
  const barLen = (60 / track.bpm) * 4
  const stepLen = barLen / 16
  const s = step % 16
  const bar = Math.floor(step / 16)
  const loopBar = bar % 8
  const at = t + (s % 2 ? (track.swing ?? 0) * stepLen : 0)
  const hit = (pattern: string | undefined) => pattern?.[s] === 'x' ? 1 : pattern?.[s] === 'o' ? 0.5 : 0
  const silent = track.breakBars?.includes(loopBar)
  let kicked = false
  if (!silent) {
    const k = hit(track.kick)
    if (k) {
      kit.kick(at, k)
      kicked = true
    }
    const sn = hit(track.snare)
    if (sn) kit.snare(at, sn)
    const h = hit(track.hat)
    if (h) kit.hat(at, h, false)
    if (hit(track.openHat)) kit.hat(at, 0.8, true)
  }
  const chord = track.chords[bar % track.chords.length]
  if (track.chordRhythm) {
    if (track.chordRhythm[s] === 'x') for (const n of chord) kit.voice(track.chordVoice, at, midi(n), stepLen * 2.4, 1)
  } else if (s === 0) {
    for (const n of chord) kit.voice(track.chordVoice, at, midi(n), barLen, 1)
  }
  if (track.bass.pattern[s] === 'x') {
    let next = 1
    while (next < 16 && track.bass.pattern[(s + next) % 16] !== 'x') next++
    const root = midi(chord[0]) % 12
    kit.bass(at, 36 + root, Math.min(stepLen * next, barLen / 2) * 0.92, track.bass.kind)
  }
  if (track.lead && s % 2 === 0) {
    const line = track.lead.bars[bar % track.lead.bars.length].split(' ')
    const note = line[s / 2]
    if (note && note !== '.') kit.voice(track.lead.voice, at, midi(note), stepLen * 3, 1)
  }
  return kicked
}

/** Renders the first `bars` bars of a track into any context: used for offline checks. */
export function renderInto(ctx: BaseAudioContext, track: Track, bars: number) {
  const bus = masterChain(ctx, ctx.destination, track.gain ?? 1)
  const kit = new Kit(ctx, bus)
  const stepLen = 60 / track.bpm / 4
  for (let i = 0; i < bars * 16; i++) scheduleStep(kit, track, i, 0.05 + i * stepLen)
}

function masterChain(ctx: BaseAudioContext, dest: AudioNode, gain: number) {
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 4
  comp.attack.value = 0.004
  comp.release.value = 0.16
  const g = ctx.createGain()
  g.gain.value = 0.8 * gain
  // Final soft limiter: compressors let fast peaks through, and those click on speakers.
  const limiter = ctx.createWaveShaper()
  const curve = new Float32Array(2048)
  for (let i = 0; i < 2048; i++) {
    const x = i / 1023.5 - 1
    curve[i] = Math.tanh(x * 1.25) / Math.tanh(1.25) * 0.94
  }
  limiter.curve = curve
  g.connect(comp).connect(limiter).connect(dest)
  return g
}

interface Playing { track: Track; bus: GainNode; timer: number; step: number; start: number }

class SoundPlayer {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private now: Playing | null = null
  private kicks: number[] = []
  enabled = true
  private wanted: string | null = null

  constructor() {
    try {
      this.enabled = localStorage.getItem('bm.feed.sound') !== 'off'
    } catch { /* storage unavailable */ }
  }

  get blocked() {
    return this.enabled && !!this.wanted && this.ctx?.state !== 'running'
  }

  /** Must be called from a user gesture at least once: browsers keep audio locked until then. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext
      if (!Ctx) return
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state !== 'running') void this.ctx.resume()
    if (this.enabled && this.wanted && this.now?.track.id !== this.wanted) this.start(this.wanted)
  }

  setEnabled(on: boolean) {
    this.enabled = on
    try {
      localStorage.setItem('bm.feed.sound', on ? 'on' : 'off')
    } catch { /* storage unavailable */ }
    if (on) this.unlock()
    else this.fadeOut()
  }

  play(id: string | null) {
    this.wanted = id
    if (!id) return this.fadeOut()
    if (!this.enabled || !this.ctx || this.now?.track.id === id) return
    this.start(id)
  }

  stop() {
    this.wanted = null
    this.fadeOut()
  }

  /** Suspends everything while the tab is hidden, without losing the place. */
  setHidden(hidden: boolean) {
    if (!this.ctx) return
    if (hidden) void this.ctx.suspend()
    else if (this.enabled && this.wanted) void this.ctx.resume()
  }

  /** 0..1, jumps on every kick and decays: drives the garment's motion. */
  pulse(): number {
    if (!this.ctx || !this.now || this.ctx.state !== 'running') return 0
    const t = this.ctx.currentTime
    while (this.kicks.length > 1 && this.kicks[1] <= t) this.kicks.shift()
    const last = this.kicks[0]
    if (last === undefined || last > t) return 0
    return Math.exp(-(t - last) * 7)
  }

  /** Short interface sounds, like the tick you get on a like. */
  blip(kind: 'like' | 'cart') {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running' || !this.master) return
    const t = this.ctx.currentTime
    const notes = kind === 'like' ? [880, 1320] : [660, 880, 1320]
    notes.forEach((f, i) => {
      const at = t + i * 0.07
      const g = this.ctx!.createGain()
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(0.12, at + 0.006)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.14)
      g.connect(this.master!)
      const o = this.ctx!.createOscillator()
      o.frequency.value = f
      o.connect(g)
      o.start(at)
      o.stop(at + 0.16)
    })
  }

  private start(id: string) {
    const track = trackById(id)
    if (!track || !this.ctx || !this.master) return
    this.fadeOut()
    const ctx = this.ctx
    const bus = ctx.createGain()
    bus.gain.setValueAtTime(0.0001, ctx.currentTime)
    bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.35)
    bus.connect(this.master)
    const kit = new Kit(ctx, masterChain(ctx, bus, track.gain ?? 1))
    const stepLen = 60 / track.bpm / 4
    const playing: Playing = { track, bus, timer: 0, step: 0, start: ctx.currentTime + 0.08 }
    this.kicks = []
    const tick = () => {
      while (playing.start + playing.step * stepLen < ctx.currentTime + 0.25) {
        const at = playing.start + playing.step * stepLen
        if (scheduleStep(kit, track, playing.step, at)) this.kicks.push(at)
        playing.step++
      }
    }
    tick()
    playing.timer = window.setInterval(tick, 90)
    this.now = playing
  }

  private fadeOut() {
    const old = this.now
    if (!old || !this.ctx) return
    this.now = null
    this.kicks = []
    clearInterval(old.timer)
    const t = this.ctx.currentTime
    old.bus.gain.cancelScheduledValues(t)
    old.bus.gain.setValueAtTime(Math.max(old.bus.gain.value, 0.0001), t)
    old.bus.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    window.setTimeout(() => old.bus.disconnect(), 3500)
  }
}

export const player = new SoundPlayer()
