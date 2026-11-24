// Tipe data inti CAD Temandor (format proyek v2).
// Satuan dunia dalam mm (sumbu Y ke bawah seperti SVG).
// Ukuran duct (w, h, w2, h2, bw, bh) disimpan dalam satuan proyek (`unit`) tanpa konversi bolak-balik.

export type Point = [number, number]

export type Unit = 'mm' | 'inch'

export type System = 'SA' | 'EA'

export type FlowUnit = 'cfm' | 'l/s'

export type DuctShape = 'rect' | 'round'

export type LayerKey
  = | 'sa'
    | 'ea'
    | 'eq'
    | 'diff'
    | 'hanger'
    | 'dim'
    | 'denah'
    | 'kolom'
    | 'bukaan'
    | 'arsi'
    | 'coret'

export interface LayerMeta {
  readonly key: LayerKey
  readonly name: string
  readonly dxf: string
  readonly aci: number
}

export interface Layer {
  on: boolean
  lock: boolean
}

export type LayersMap = Record<LayerKey, Layer>

export interface HangerConfig {
  on: boolean
  sp: number
}

export interface WallHost {
  id: string
  e: number
  s: number
  n: number
}

export type TextColor = '' | 'merah' | 'kuning' | 'hijau' | 'biru' | 'putih'

export type TextAlign = 'start' | 'middle' | 'end'

export type ElbowType = 'r' | 'sq'

export type ElbowRadiusRatio = '1' | '1.5'

export type DoorKind = 'single' | 'double' | 'sliding'

export type DoorSwing = 'in' | 'out'

export type DoorHinge = 'l' | 'r'

export type StairKind = 'straight' | 'L'

export interface NodeBase {
  id: string
  x: number
  y: number
  rot: number
  mir: boolean
  lock?: boolean
  g?: string
}

// ---- Duct & fitting ----

export interface StraightNode extends NodeBase {
  type: 'straight'
  L: number
  w: number
  h: number
  shape: DuctShape
  sys: System
  elev: number
  flip: boolean
}

export interface FlexNode extends NodeBase {
  type: 'flex'
  L: number
  w: number
  h: number
  shape: DuctShape
  sys: System
  elev: number
}

export interface ElbowNode extends NodeBase {
  type: 'elbow'
  w: number
  h: number
  w2: number | null
  h2: number | null
  shape: DuctShape
  angle: number
  et: ElbowType
  rr: ElbowRadiusRatio
  sys: System
  elev: number
}

export interface TransitionNode extends NodeBase {
  type: 'transition'
  L: number
  w: number
  h: number
  w2: number
  h2: number
  shape: DuctShape
  sys: System
  elev: number
}

export interface TeeNode extends NodeBase {
  type: 'tee'
  w: number
  h: number
  bw: number
  bh: number
  shape: DuctShape
  sys: System
  elev: number
}

export interface TakeoffNode extends NodeBase {
  type: 'takeoff'
  w: number
  h: number
  bw: number
  bh: number
  shape: DuctShape
  sys: System
  elev: number
}

export interface EndcapNode extends NodeBase {
  type: 'endcap'
  w: number
  h: number
  shape: DuctShape
  sys: System
}

export interface DamperNode extends NodeBase {
  type: 'damper'
  L: number
  w: number
  h: number
  shape: DuctShape
  sys: System
  elev: number
}

export interface AccessdoorNode extends NodeBase {
  type: 'accessdoor'
  L: number
  w: number
  h: number
  shape: DuctShape
  sys: System
  elev: number
}

// ---- Perlengkapan & equipment ----

export interface DiffuserNode extends NodeBase {
  type: 'diffuser'
  F: number
  flow: number
  tag: string
  sys: System
}

export interface GrilleNode extends NodeBase {
  type: 'grille'
  Fx: number
  Fy: number
  flow: number
  tag: string
  sys: System
}

export interface LouverNode extends NodeBase {
  type: 'louver'
  F: number
  tag: string
  sys: System
}

export interface FanNode extends NodeBase {
  type: 'fan'
  L: number
  B: number
  tag: string
  sys: System
}

export interface FcuNode extends NodeBase {
  type: 'fcu'
  L: number
  B: number
  w: number
  h: number
  shape: DuctShape
  tag: string
}

export interface OutdoorNode extends NodeBase {
  type: 'outdoor'
  L: number
  B: number
  tag: string
}

// ---- Ruangan & dimensi ----

export interface RoomNode extends NodeBase {
  type: 'room'
  W: number
  H: number
  t: number
  name: string
  dims: boolean
  pts?: Point[]
}

export type Room = RoomNode

export interface DimNode extends NodeBase {
  type: 'dim'
  L: number
  off: number
}

// ---- Arsitektur ----

export interface ColumnNode extends NodeBase {
  type: 'column'
  shape: DuctShape
  cw: number
  cd: number
}

export interface DoorNode extends NodeBase {
  type: 'door'
  dw: number
  t: number
  kind: DoorKind
  swing: DoorSwing
  hinge: DoorHinge
  host?: WallHost
}

export interface WinNode extends NodeBase {
  type: 'win'
  dw: number
  t: number
  host?: WallHost
}

export interface OpeningNode extends NodeBase {
  type: 'opening'
  dw: number
  t: number
  host?: WallHost
}

export interface PartitionNode extends NodeBase {
  type: 'partition'
  L: number
  t: number
}

export interface ShaftNode extends NodeBase {
  type: 'shaft'
  sw: number
  sd: number
}

export interface BeamNode extends NodeBase {
  type: 'beam'
  L: number
  bw: number
  be: number
}

export interface StairNode extends NodeBase {
  type: 'stair'
  skind: StairKind
  sl: number
  sw: number
  tr: number
}

export interface LiftNode extends NodeBase {
  type: 'lift'
  sw: number
  sd: number
}

export interface CeilingNode extends NodeBase {
  type: 'ceiling'
  ch: number
}

// ---- Coretan, teks, catatan ----

export interface SketchNode extends NodeBase {
  type: 'sketch'
  pts: Point[]
}

export interface TextNode extends NodeBase {
  type: 'text'
  s: string
  th: number
  tz: string
  col: TextColor
  al: TextAlign
  b: boolean
  it: boolean
  ul: boolean
  bx: boolean
}

export interface NoteNode extends NodeBase {
  type: 'note'
  s: string
  tx: number
  ty: number
  th: number
  tz: string
  col: TextColor
  b: boolean
  it: boolean
  ul: boolean
  bx: boolean
}

export type Node
  = | StraightNode
    | FlexNode
    | ElbowNode
    | TransitionNode
    | TeeNode
    | TakeoffNode
    | EndcapNode
    | DamperNode
    | AccessdoorNode
    | DiffuserNode
    | GrilleNode
    | LouverNode
    | FanNode
    | FcuNode
    | OutdoorNode
    | RoomNode
    | DimNode
    | ColumnNode
    | DoorNode
    | WinNode
    | OpeningNode
    | PartitionNode
    | ShaftNode
    | BeamNode
    | StairNode
    | LiftNode
    | CeilingNode
    | SketchNode
    | TextNode
    | NoteNode

export type NodeType = Node['type']

export type NodeOf<T extends NodeType> = Extract<Node, { type: T }>

// ---- Port sambungan ----

export interface Port {
  id: string
  x: number
  y: number
  dir: number
  w?: number
  h?: number
  shape?: DuctShape
  keys: [string, string] | null
  any?: boolean
  opt?: boolean
}

export interface WorldPort extends Port {
  pos: Point
  wdir: number
  node: Node
}

// ---- Primitive gambar (lokal / dunia) ----

export interface PrimStyle {
  layer?: LayerKey
  j?: boolean | 1
  dash?: boolean | 1
  fill?: 'wall' | 'bg' | boolean | 1
  nostroke?: boolean | 1
  col?: TextColor
  lbl?: boolean | 1
}

export interface LinePrim extends PrimStyle {
  k: 'l'
  a: Point
  b: Point
}

export interface PolylinePrim extends PrimStyle {
  k: 'pl'
  pts: Point[]
  closed?: boolean
}

export interface RingPrim extends PrimStyle {
  k: 'ring'
  outer: Point[]
  inner: Point[]
}

export interface CirclePrim extends PrimStyle {
  k: 'c'
  c: Point
  r: number
}

export interface ArcPrim extends PrimStyle {
  k: 'arc'
  c: Point
  r: number
  a0: number
  a1: number
}

export interface TextPrim extends PrimStyle {
  k: 't'
  p: Point
  s: string
  h: number
  rot: number
  anchor: TextAlign
  b?: boolean
  it?: boolean
  ul?: boolean
  box?: [number, number]
  gap?: number
}

export interface ArrowPrim extends PrimStyle {
  k: 'arrow'
  p: Point
  dir: number
  h: number
}

export interface HitPrim {
  k: 'hit'
  pts: Point[]
  layer?: LayerKey
}

export type Prim
  = | LinePrim
    | PolylinePrim
    | RingPrim
    | CirclePrim
    | ArcPrim
    | TextPrim
    | ArrowPrim
    | HitPrim

// ---- Proyek v2 ----

export interface Project {
  version: 2
  id: string
  name: string
  unit: Unit
  scale: string
  fu: FlowUnit
  updated: number
  hang: HangerConfig
  layers: LayersMap
  nodes: Node[]
}

export interface NewProjectOptions {
  id?: string
  name?: string
  unit?: Unit
  scale?: string
  fu?: FlowUnit
  W?: number
  H?: number
  updated?: number
}
