import type { ReactNode } from 'react'

/**
 * Original soft "clay" role illustrations, hand-drawn as SVG.
 *
 * Look: rounded forms, a diagonal gradient on every surface (light top-left,
 * darker bottom-right), a soft gloss patch, and a blurred contact shadow.
 * Palette: lime greens, warm neutrals, one blue, one orange. No text.
 * All art is drawn in a 120 x 120 box.
 */

type Fill = (key: string) => string

const STOPS: Record<string, [string, string, string]> = {
  lime: ['#d9f99d', '#84cc16', '#4d7c0f'],
  sand: ['#ffffff', '#f1eee5', '#cdc7b6'],
  dune: ['#ebe6d8', '#cbc4b0', '#9d9684'],
  ink: ['#7a786f', '#43413c', '#26251f'],
  blue: ['#c7defe', '#5b9cf5', '#2f63d8'],
  orange: ['#ffdcb8', '#fb8f3c', '#e0560c'],
}

function gradient(p: string, key: string): ReactNode {
  const id = `${p}${key}`
  if (key === 'hi') {
    return (
      <linearGradient key={key} id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity=".85" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    )
  }
  if (key === 'sh') {
    return (
      <radialGradient key={key} id={id}>
        <stop offset="0" stopColor="#3a3524" stopOpacity=".34" />
        <stop offset="1" stopColor="#3a3524" stopOpacity="0" />
      </radialGradient>
    )
  }
  if (key === 'blur') {
    return (
      <filter key={key} id={id} x="-30%" y="-30%" width="160%" height="170%">
        <feGaussianBlur stdDeviation="3.2" />
      </filter>
    )
  }
  // name + optional suffix: V vertical, H horizontal, R sphere, I inverted (recessed)
  const m = /^([a-z]+)([VHRI]?)$/.exec(key)
  const stops = m ? STOPS[m[1]] : undefined
  if (!m || !stops) return null
  const [a, b, c] = m[2] === 'I' ? [stops[2], stops[1], stops[0]] : stops
  const stopEls = (
    <>
      <stop offset="0" stopColor={a} />
      <stop offset=".55" stopColor={b} />
      <stop offset="1" stopColor={c} />
    </>
  )
  if (m[2] === 'R') {
    return (
      <radialGradient key={key} id={id} cx=".5" cy=".5" r=".62" fx=".32" fy=".28">
        {stopEls}
      </radialGradient>
    )
  }
  const [x2, y2] = m[2] === 'V' ? [0, 1] : m[2] === 'H' ? [1, 0] : [1, 1]
  return (
    <linearGradient key={key} id={id} x1="0" y1="0" x2={x2} y2={y2}>
      {stopEls}
    </linearGradient>
  )
}

/** Soft ground shadow under an object. */
function ground(f: Fill, cx: number, cy: number, rx: number, ry: number) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={f('sh')} />
}

/** Blurred drop shadow behind a rounded rectangle. */
function drop(f: Fill, x: number, y: number, w: number, h: number, r: number, dy = 7) {
  return (
    <rect x={x + 3} y={y + dy} width={w - 6} height={h} rx={r} fill="#3a3524" opacity=".24" filter={f('blur')} />
  )
}

/** Clay rounded rectangle: gradient body plus a soft gloss patch top-left. */
function clay(f: Fill, x: number, y: number, w: number, h: number, r: number, k: string, gloss = true) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r} fill={f(k)} />
      {gloss && w > 16 && h > 12 ? (
        <rect
          x={x + w * 0.07}
          y={y + Math.min(h * 0.07, 4)}
          width={w * 0.55}
          height={Math.min(h * 0.32, 18)}
          rx={Math.min(r * 0.7, 9)}
          fill={f('hi')}
          opacity=".55"
        />
      ) : null}
    </g>
  )
}

/** Clay ball with a small specular dot. */
function ball(f: Fill, cx: number, cy: number, r: number, k: string) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={f(`${k}R`)} />
      <ellipse
        cx={cx - r * 0.33}
        cy={cy - r * 0.4}
        rx={r * 0.3}
        ry={r * 0.17}
        fill="#fff"
        opacity=".6"
        transform={`rotate(-35 ${cx - r * 0.33} ${cy - r * 0.4})`}
      />
    </g>
  )
}

/** Window title bar with the top corners rounded, plus three little buttons. */
function titleBar(f: Fill, x: number, y: number, w: number, r: number, k: string) {
  const h = 16
  return (
    <g>
      <path
        d={`M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`}
        fill={f(k)}
      />
      {ball(f, x + 11, y + 8, 3, 'orange')}
      {ball(f, x + 20, y + 8, 3, 'lime')}
      {ball(f, x + 29, y + 8, 3, 'blue')}
    </g>
  )
}

/** Person glyph (head and shoulders) for avatar discs. */
function person(cx: number, cy: number, s: number) {
  return (
    <g fill="#fff" opacity=".92">
      <circle cx={cx} cy={cy - s * 0.2} r={s * 0.24} />
      <path d={`M${cx - s * 0.44} ${cy + s * 0.46}a${s * 0.44} ${s * 0.36} 0 0 1 ${s * 0.88} 0Z`} />
    </g>
  )
}

/** Four-point sparkle. */
function sparkle(cx: number, cy: number, s: number, fill: string, op = 1) {
  const d = `M${cx} ${cy - s}Q${cx + s * 0.12} ${cy - s * 0.12} ${cx + s} ${cy}Q${cx + s * 0.12} ${cy + s * 0.12} ${cx} ${cy + s}Q${cx - s * 0.12} ${cy + s * 0.12} ${cx - s} ${cy}Q${cx - s * 0.12} ${cy - s * 0.12} ${cx} ${cy - s}Z`
  return <path d={d} fill={fill} opacity={op} />
}

/** Thick isometric-looking plate (top face + two side faces). */
function plate(cx: number, cy: number, w: number, h: number, t: number, top: string, left: string, right: string, shine = false) {
  const T = `M${cx} ${cy - h}L${cx + w} ${cy}L${cx} ${cy + h}L${cx - w} ${cy}Z`
  const L = `M${cx - w} ${cy}L${cx} ${cy + h}V${cy + h + t}L${cx - w} ${cy + t}Z`
  const R = `M${cx + w} ${cy}L${cx} ${cy + h}V${cy + h + t}L${cx + w} ${cy + t}Z`
  const j = { strokeWidth: 5, strokeLinejoin: 'round' as const }
  return (
    <g>
      <path d={L} fill={left} stroke={left} {...j} />
      <path d={R} fill={right} stroke={right} {...j} />
      <path d={T} fill={top} stroke={top} {...j} />
      {shine ? <path d={`M${cx - w * 0.62} ${cy - h * 0.05}L${cx - w * 0.05} ${cy - h * 0.62}`} stroke="#fff" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" /> : null}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The illustrations                                                   */
/* ------------------------------------------------------------------ */

type Draw = (f: Fill) => ReactNode

const software: Draw = (f) => (
  <>
    {ground(f, 60, 106, 42, 7)}
    {clay(f, 30, 34, 76, 62, 14, 'limeV', false)}
    {drop(f, 12, 18, 86, 66, 13)}
    <rect x="12" y="18" width="86" height="66" rx="13" fill={f('ink')} />
    <rect x="16" y="22" width="40" height="14" rx="7" fill={f('hi')} opacity=".28" />
    {titleBar(f, 12, 18, 86, 13, 'dune')}
    <path d="M30 50L44 60L30 70" fill="none" stroke="#bef264" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M52 72H70" fill="none" stroke="#f7f5ee" strokeWidth="7.5" strokeLinecap="round" />
  </>
)

const frontend: Draw = (f) => (
  <>
    {ground(f, 58, 106, 42, 7)}
    {drop(f, 10, 18, 88, 74, 13)}
    {clay(f, 10, 18, 88, 74, 13, 'sand')}
    {titleBar(f, 10, 18, 88, 13, 'dune')}
    {clay(f, 18, 42, 46, 28, 8, 'lime')}
    {clay(f, 68, 42, 22, 13, 5, 'blue')}
    {clay(f, 68, 58, 22, 12, 5, 'orange')}
    {clay(f, 18, 76, 40, 6, 3, 'dune', false)}
    {clay(f, 18, 85, 26, 5, 2.5, 'dune', false)}
    <path
      d="M82 62L82 94L89 87L95 100L102 97L96 84L106 84Z"
      fill={f('ink')}
      stroke="#fff"
      strokeWidth="3.5"
      strokeLinejoin="round"
      paintOrder="stroke"
    />
  </>
)

const backend: Draw = (f) => {
  const slab = (y: number, k: string) => (
    <g>
      <rect x="12" y={y + 6} width="96" height="24" rx="10" fill={f('dune')} />
      {clay(f, 12, y, 96, 24, 10, k)}
      {ball(f, 28, y + 12, 4.5, 'blue')}
      {ball(f, 42, y + 12, 4.5, 'orange')}
      <g fill="#3a3524" opacity=".28">
        <rect x="70" y={y + 6} width="5" height="12" rx="2.5" />
        <rect x="80" y={y + 6} width="5" height="12" rx="2.5" />
        <rect x="90" y={y + 6} width="5" height="12" rx="2.5" />
      </g>
    </g>
  )
  return (
    <>
      {ground(f, 60, 108, 46, 7)}
      {slab(66, 'sand')}
      {slab(38, 'lime')}
      {slab(10, 'sand')}
    </>
  )
}

const fullstack: Draw = (f) => (
  <>
    {ground(f, 62, 108, 44, 7)}
    {drop(f, 32, 10, 76, 64, 13)}
    {clay(f, 32, 10, 76, 64, 13, 'limeV')}
    {drop(f, 16, 26, 72, 60, 13)}
    {clay(f, 16, 26, 72, 60, 13, 'sand')}
    {titleBar(f, 16, 26, 72, 13, 'dune')}
    {clay(f, 24, 48, 30, 10, 5, 'blue', false)}
    {clay(f, 24, 62, 44, 6, 3, 'dune', false)}
    {clay(f, 24, 72, 32, 6, 3, 'dune', false)}
    {drop(f, 46, 62, 62, 42, 12, 6)}
    <rect x="46" y="62" width="62" height="42" rx="12" fill={f('ink')} />
    <rect x="50" y="66" width="30" height="12" rx="6" fill={f('hi')} opacity=".25" />
    <path d="M68 74L60 83L68 92" fill="none" stroke="#bef264" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M86 74L94 83L86 92" fill="none" stroke="#f7f5ee" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M80 72L74 94" fill="none" stroke="#fb8f3c" strokeWidth="5" strokeLinecap="round" />
  </>
)

const devops: Draw = (f) => {
  const head = (x: number, y: number, deg: number, k: string) => (
    <path
      d="M9 0L-6 -9.5L-6 9.5Z"
      transform={`translate(${x} ${y}) rotate(${deg})`}
      fill={f(k)}
      stroke={f(k)}
      strokeWidth="4"
      strokeLinejoin="round"
    />
  )
  return (
    <>
      {ground(f, 60, 108, 40, 6)}
      <path d="M17 52A45 45 0 0 1 94 29" fill="none" stroke={f('blue')} strokeWidth="8" strokeLinecap="round" />
      {head(95.5, 31, 48, 'blue')}
      <path d="M103 68A45 45 0 0 1 26 91" fill="none" stroke={f('orange')} strokeWidth="8" strokeLinecap="round" />
      {head(24.5, 89, 228, 'orange')}
      <circle cx="62" cy="68" r="31" fill="#3a3524" opacity=".2" filter={f('blur')} />
      <circle cx="60" cy="60" r="30" fill="none" stroke="#5f9f10" strokeWidth="11" strokeLinecap="round" strokeDasharray="1 18.8" />
      <circle cx="60" cy="60" r="27" fill={f('lime')} />
      <circle cx="60" cy="60" r="19" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="12" fill={f('sandI')} />
      <circle cx="60" cy="60" r="7" fill={f('sand')} />
      <ellipse cx="48" cy="44" rx="12" ry="5" fill={f('hi')} opacity=".55" transform="rotate(-35 48 44)" />
    </>
  )
}

const dataEngineer: Draw = (f) => (
  <>
    {ground(f, 70, 108, 44, 6)}
    {drop(f, 6, 34, 62, 14, 7, 5)}
    {clay(f, 6, 32, 62, 15, 7.5, 'blueV')}
    {clay(f, 6, 64, 62, 15, 7.5, 'orangeV')}
    <rect x="42" y="27" width="9" height="25" rx="4" fill={f('sandV')} />
    <rect x="42" y="59" width="9" height="25" rx="4" fill={f('sandV')} />
    <path d="M58 32V86A26 10 0 0 0 110 86V32Z" fill={f('limeH')} />
    <ellipse cx="84" cy="32" rx="26" ry="10" fill={f('lime')} />
    <ellipse cx="78" cy="29" rx="14" ry="3.5" fill="#fff" opacity=".45" transform="rotate(-6 78 29)" />
    <path d="M60.5 52.6A24 9.4 0 0 0 107.5 52.6M60.5 70.6A24 9.4 0 0 0 107.5 70.6" fill="none" stroke="#3f6212" strokeOpacity=".28" strokeWidth="2.5" />
    {clay(f, 14, 12, 11, 11, 3.5, 'limeV', false)}
    {clay(f, 32, 6, 9, 9, 3, 'sandV', false)}
  </>
)

const dataScientist: Draw = (f) => (
  <>
    {ground(f, 60, 108, 46, 6)}
    {drop(f, 10, 14, 100, 84, 15)}
    {clay(f, 10, 14, 100, 84, 15, 'sand')}
    {clay(f, 22, 62, 15, 24, 6, 'limeV')}
    {clay(f, 42, 50, 15, 36, 6, 'limeV')}
    {clay(f, 62, 56, 15, 30, 6, 'limeV')}
    {clay(f, 82, 36, 15, 50, 6, 'blueV')}
    <path d="M29 48L50 36L69 42L90 24" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M29 48L50 36L69 42L90 24" fill="none" stroke={f('orange')} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    {ball(f, 29, 48, 4.5, 'orange')}
    {ball(f, 50, 36, 4.5, 'orange')}
    {ball(f, 69, 42, 4.5, 'orange')}
    {ball(f, 90, 24, 6, 'orange')}
  </>
)

const machineLearning: Draw = (f) => (
  <>
    {ground(f, 60, 108, 40, 6)}
    <ellipse cx="60" cy="58" rx="46" ry="16" transform="rotate(-24 60 58)" fill="none" stroke={f('dune')} strokeWidth="3" />
    <g stroke={f('dune')} strokeWidth="4" strokeLinecap="round">
      <path d="M60 58L26 32M60 58L96 28M60 58L24 90M60 58L98 90" />
    </g>
    {ball(f, 26, 32, 10, 'blue')}
    {ball(f, 96, 28, 8.5, 'orange')}
    {ball(f, 24, 90, 8.5, 'sand')}
    {ball(f, 98, 90, 10.5, 'lime')}
    <circle cx="62" cy="68" r="23" fill="#3a3524" opacity=".22" filter={f('blur')} />
    {ball(f, 60, 58, 23, 'lime')}
    {sparkle(60, 58, 14, '#fff', 0.95)}
  </>
)

const mobile: Draw = (f) => (
  <>
    {ground(f, 60, 108, 30, 6)}
    <g transform="rotate(-9 60 60)">
      {drop(f, 34, 8, 52, 96, 13, 7)}
      <rect x="34" y="8" width="52" height="96" rx="13" fill={f('ink')} />
      <rect x="38" y="12" width="44" height="88" rx="10" fill={f('sand')} />
      <rect x="52" y="16" width="16" height="5" rx="2.5" fill={f('ink')} />
      {clay(f, 44, 28, 32, 20, 6, 'lime')}
      {clay(f, 44, 52, 15, 15, 5, 'blue')}
      {clay(f, 61, 52, 15, 15, 5, 'orange')}
      {clay(f, 44, 72, 32, 6, 3, 'dune', false)}
      {clay(f, 44, 82, 20, 6, 3, 'dune', false)}
    </g>
    {drop(f, 74, 16, 36, 22, 10, 4)}
    <path d="M84 36L82 46L92 38Z" fill={f('blueV')} stroke={f('blueV')} strokeWidth="3" strokeLinejoin="round" />
    {clay(f, 74, 14, 36, 24, 11, 'blue')}
    <g fill="#fff">
      <circle cx="85" cy="26" r="2.6" />
      <circle cx="92" cy="26" r="2.6" />
      <circle cx="99" cy="26" r="2.6" />
    </g>
  </>
)

const security: Draw = (f) => {
  const shield = 'M60 8L100 22V56C100 80 83 97 60 108C37 97 20 80 20 56V22Z'
  return (
    <>
      {ground(f, 60, 112, 34, 5)}
      <path d={shield} fill="#3a3524" opacity=".22" filter={f('blur')} transform="translate(0 6)" />
      <path d={shield} fill={f('lime')} />
      <path d="M60 20L90 31V56C90 74 77 87 60 96C43 87 30 74 30 56V31Z" fill={f('limeI')} />
      <path d="M60 8L100 22V30L60 16L20 30V22Z" fill="#fff" opacity=".22" />
      <circle cx="60" cy="52" r="10" fill={f('sand')} />
      <path d="M54 58L66 58L69 78L51 78Z" fill={f('sand')} stroke={f('sand')} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="60" cy="53" r="3.6" fill={f('ink')} />
      <path d="M58.4 55L61.6 55L62.6 66L57.4 66Z" fill={f('ink')} />
      {sparkle(92, 16, 6, '#60a5fa')}
    </>
  )
}

const product: Draw = (f) => (
  <>
    {ground(f, 60, 108, 46, 6)}
    {drop(f, 10, 22, 100, 78, 15)}
    {clay(f, 10, 22, 100, 78, 15, 'sand')}
    <path d="M26 84C48 86 42 62 62 62S78 46 92 44" fill="none" stroke={f('dune')} strokeWidth="11" strokeLinecap="round" />
    <path d="M26 84C48 86 42 62 62 62S78 46 92 44" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="0.1 6.5" />
    {ball(f, 26, 84, 8, 'lime')}
    {ball(f, 62, 62, 5.5, 'blue')}
    <path d="M94 6C84 6 77 13 77 22C77 34 94 50 94 50S111 34 111 22C111 13 104 6 94 6Z" fill="#3a3524" opacity=".2" filter={f('blur')} transform="translate(0 5)" />
    <path d="M94 6C84 6 77 13 77 22C77 34 94 50 94 50S111 34 111 22C111 13 104 6 94 6Z" fill={f('orange')} />
    <circle cx="94" cy="22" r="6.5" fill={f('sand')} />
    <ellipse cx="86" cy="15" rx="5" ry="3" fill="#fff" opacity=".5" transform="rotate(-40 86 15)" />
  </>
)

const design: Draw = (f) => {
  const pal =
    'M60 12C31 12 10 33 10 60C10 87 32 106 58 106C69 106 71 98 67 92C63 85 67 78 76 78H90C102 78 110 69 110 56C110 31 89 12 60 12Z'
  return (
    <>
      {ground(f, 60, 110, 44, 5)}
      <path d={pal} fill="#3a3524" opacity=".22" filter={f('blur')} transform="translate(0 6)" />
      <path d={pal} fill={f('sand')} />
      <ellipse cx="38" cy="30" rx="18" ry="7" fill={f('hi')} opacity=".7" transform="rotate(-28 38 30)" />
      <circle cx="46" cy="90" r="6.5" fill={f('sandI')} />
      {ball(f, 32, 52, 9, 'lime')}
      {ball(f, 56, 32, 9, 'blue')}
      {ball(f, 84, 40, 9, 'orange')}
      {ball(f, 28, 78, 8, 'ink')}
      <g transform="translate(-9 6) rotate(36 96 84)">
        <rect x="91" y="64" width="10" height="42" rx="5" fill={f('dune')} />
        <rect x="90" y="56" width="12" height="14" rx="3" fill={f('sandV')} />
        <path d="M91 56C91 46 96 40 96 40C96 40 101 46 101 56Z" fill={f('limeV')} />
      </g>
    </>
  )
}

const engManager: Draw = (f) => (
  <>
    {ground(f, 60, 110, 46, 5)}
    <g stroke={f('dune')} strokeWidth="4.5" strokeLinecap="round" fill="none">
      <path d="M60 46V66M24 66H96M24 66V80M60 66V80M96 66V80" />
    </g>
    <circle cx="62" cy="38" r="21" fill="#3a3524" opacity=".2" filter={f('blur')} />
    {ball(f, 60, 30, 21, 'lime')}
    {person(60, 30, 24)}
    {ball(f, 24, 92, 14, 'blue')}
    {person(24, 92, 16)}
    {ball(f, 60, 92, 14, 'orange')}
    {person(60, 92, 16)}
    {ball(f, 96, 92, 14, 'sand')}
    <g fill="#8e8878" opacity=".95">
      <circle cx="96" cy="88.8" r="3.8" />
      <path d="M89.4 99.2a6.6 5.4 0 0 1 13.2 0Z" />
    </g>
  </>
)

const architect: Draw = (f) => (
  <>
    {ground(f, 60, 112, 46, 5)}
    {plate(60, 78, 42, 22, 10, '#cbc4b0', '#9d9684', '#847d6b')}
    {plate(60, 56, 42, 22, 10, '#f4f1e8', '#cdc7b6', '#aaa391')}
    {plate(60, 34, 42, 22, 10, '#a3e635', '#65a30d', '#4d7c0f', true)}
    {sparkle(60, 34, 10, '#fff', 0.95)}
    {sparkle(98, 14, 6, '#fb8f3c')}
  </>
)

const generic: Draw = (f) => (
  <>
    {ground(f, 60, 106, 46, 6)}
    <path d="M44 42V32C44 24 50 20 58 20H62C70 20 76 24 76 32V42" fill="none" stroke={f('dune')} strokeWidth="8" strokeLinecap="round" />
    {drop(f, 12, 38, 96, 62, 15)}
    {clay(f, 12, 38, 96, 62, 15, 'lime')}
    <rect x="12" y="62" width="96" height="9" fill={f('limeV')} />
    {clay(f, 50, 56, 20, 22, 6, 'sand')}
    {ball(f, 60, 67, 3.6, 'orange')}
  </>
)

export const ROLE_ART = {
  software,
  frontend,
  backend,
  fullstack,
  devops,
  dataEngineer,
  dataScientist,
  machineLearning,
  mobile,
  security,
  product,
  design,
  engManager,
  architect,
  generic,
} as const satisfies Record<string, Draw>

export type RoleArtKey = keyof typeof ROLE_ART

/**
 * Renders one illustration. Gradient ids are prefixed per instance, and only
 * the gradients the art really uses are emitted, to keep the HTML small.
 */
export function drawRoleArt(key: RoleArtKey, prefix: string): ReactNode {
  const used = new Set<string>()
  const f: Fill = (k) => {
    used.add(k)
    return k === 'blur' ? `url(#${prefix}blur)` : `url(#${prefix}${k})`
  }
  const body = ROLE_ART[key](f)
  return (
    <>
      <defs>{[...used].map((k) => gradient(prefix, k))}</defs>
      {body}
    </>
  )
}
