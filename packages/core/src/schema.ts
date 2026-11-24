import { z } from 'zod'
import { defaultLayers } from './model'
import type { Project } from './types'

const finiteNum = z.number().refine(Number.isFinite, 'Harus berupa angka valid')
const positiveNum = finiteNum.gt(0)
const nonNegativeNum = finiteNum.gte(0)

export const pointSchema = z.tuple([finiteNum, finiteNum])

export const unitSchema = z.enum(['mm', 'inch'])

export const systemSchema = z.enum(['SA', 'EA'])

export const flowUnitSchema = z.enum(['cfm', 'l/s'])

export const ductShapeSchema = z.enum(['rect', 'round'])

export const layerKeySchema = z.enum([
  'sa',
  'ea',
  'eq',
  'diff',
  'hanger',
  'dim',
  'denah',
  'kolom',
  'bukaan',
  'arsi',
  'coret',
])

export const layerSchema = z.object({
  on: z.boolean(),
  lock: z.boolean(),
})

export const layersSchema = z.object({
  sa: layerSchema,
  ea: layerSchema,
  eq: layerSchema,
  diff: layerSchema,
  hanger: layerSchema,
  dim: layerSchema,
  denah: layerSchema,
  kolom: layerSchema,
  bukaan: layerSchema,
  arsi: layerSchema,
  coret: layerSchema,
})

export const hangerConfigSchema = z.object({
  on: z.boolean(),
  sp: positiveNum,
})

export const wallHostSchema = z.object({
  id: z.string().min(1),
  e: z.number().int().gte(0),
  s: finiteNum,
  n: z.number().int().gte(3),
})

export const textColorSchema = z.enum(['', 'merah', 'kuning', 'hijau', 'biru', 'putih'])

export const textAlignSchema = z.enum(['start', 'middle', 'end'])

export const elbowTypeSchema = z.enum(['r', 'sq'])

export const elbowRadiusRatioSchema = z.enum(['1', '1.5'])

export const doorKindSchema = z.enum(['single', 'double', 'sliding'])

export const doorSwingSchema = z.enum(['in', 'out'])

export const doorHingeSchema = z.enum(['l', 'r'])

export const stairKindSchema = z.enum(['straight', 'L'])

const nodeBaseFields = {
  id: z.string().min(1),
  x: finiteNum,
  y: finiteNum,
  rot: finiteNum,
  mir: z.boolean(),
  lock: z.boolean().optional(),
  g: z.string().min(1).optional(),
}

const straightNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('straight'),
  L: positiveNum,
  w: positiveNum,
  h: positiveNum,
  shape: ductShapeSchema,
  sys: systemSchema,
  elev: finiteNum,
  flip: z.boolean(),
})

const flexNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('flex'),
  L: positiveNum,
  w: positiveNum,
  h: positiveNum,
  shape: ductShapeSchema,
  sys: systemSchema,
  elev: finiteNum,
})

const elbowNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('elbow'),
  w: positiveNum,
  h: positiveNum,
  w2: positiveNum.nullable(),
  h2: positiveNum.nullable(),
  shape: ductShapeSchema,
  angle: finiteNum.gt(0).lt(180),
  et: elbowTypeSchema,
  rr: elbowRadiusRatioSchema,
  sys: systemSchema,
  elev: finiteNum,
})

const transitionNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('transition'),
  L: positiveNum,
  w: positiveNum,
  h: positiveNum,
  w2: positiveNum,
  h2: positiveNum,
  shape: ductShapeSchema,
  sys: systemSchema,
  elev: finiteNum,
})

const teeNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('tee'),
  w: positiveNum,
  h: positiveNum,
  bw: positiveNum,
  bh: positiveNum,
  shape: ductShapeSchema,
  sys: systemSchema,
  elev: finiteNum,
})

const takeoffNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('takeoff'),
  w: positiveNum,
  h: positiveNum,
  bw: positiveNum,
  bh: positiveNum,
  shape: ductShapeSchema,
  sys: systemSchema,
  elev: finiteNum,
})

const endcapNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('endcap'),
  w: positiveNum,
  h: positiveNum,
  shape: ductShapeSchema,
  sys: systemSchema,
})

const damperNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('damper'),
  L: positiveNum,
  w: positiveNum,
  h: positiveNum,
  shape: ductShapeSchema,
  sys: systemSchema,
  elev: finiteNum,
})

const accessdoorNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('accessdoor'),
  L: positiveNum,
  w: positiveNum,
  h: positiveNum,
  shape: ductShapeSchema,
  sys: systemSchema,
  elev: finiteNum,
})

const diffuserNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('diffuser'),
  F: positiveNum,
  flow: nonNegativeNum,
  tag: z.string(),
  sys: systemSchema,
})

const grilleNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('grille'),
  Fx: positiveNum,
  Fy: positiveNum,
  flow: nonNegativeNum,
  tag: z.string(),
  sys: systemSchema,
})

const louverNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('louver'),
  F: positiveNum,
  tag: z.string(),
  sys: systemSchema,
})

const fanNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('fan'),
  L: positiveNum,
  B: positiveNum,
  tag: z.string(),
  sys: systemSchema,
})

const fcuNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('fcu'),
  L: positiveNum,
  B: positiveNum,
  w: positiveNum,
  h: positiveNum,
  shape: ductShapeSchema,
  tag: z.string(),
})

const outdoorNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('outdoor'),
  L: positiveNum,
  B: positiveNum,
  tag: z.string(),
})

const roomNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('room'),
  W: positiveNum,
  H: positiveNum,
  t: positiveNum,
  name: z.string(),
  dims: z.boolean(),
  pts: z.array(pointSchema).min(3).optional(),
})

const dimNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('dim'),
  L: positiveNum,
  off: finiteNum,
})

const columnNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('column'),
  shape: ductShapeSchema,
  cw: positiveNum,
  cd: positiveNum,
})

const doorNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('door'),
  dw: positiveNum,
  t: positiveNum,
  kind: doorKindSchema,
  swing: doorSwingSchema,
  hinge: doorHingeSchema,
  host: wallHostSchema.optional(),
})

const winNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('win'),
  dw: positiveNum,
  t: positiveNum,
  host: wallHostSchema.optional(),
})

const openingNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('opening'),
  dw: positiveNum,
  t: positiveNum,
  host: wallHostSchema.optional(),
})

const partitionNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('partition'),
  L: positiveNum,
  t: positiveNum,
})

const shaftNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('shaft'),
  sw: positiveNum,
  sd: positiveNum,
})

const beamNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('beam'),
  L: positiveNum,
  bw: positiveNum,
  be: finiteNum,
})

const stairNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('stair'),
  skind: stairKindSchema,
  sl: positiveNum,
  sw: positiveNum,
  tr: positiveNum,
})

const liftNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('lift'),
  sw: positiveNum,
  sd: positiveNum,
})

const ceilingNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('ceiling'),
  ch: positiveNum,
})

const sketchNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('sketch'),
  pts: z.array(pointSchema).min(2),
})

const textNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('text'),
  s: z.string(),
  th: nonNegativeNum,
  tz: z.string().min(1),
  col: textColorSchema,
  al: textAlignSchema,
  b: z.boolean(),
  it: z.boolean(),
  ul: z.boolean(),
  bx: z.boolean(),
})

const noteNodeSchema = z.object({
  ...nodeBaseFields,
  type: z.literal('note'),
  s: z.string(),
  tx: finiteNum,
  ty: finiteNum,
  th: nonNegativeNum,
  tz: z.string().min(1),
  col: textColorSchema,
  b: z.boolean(),
  it: z.boolean(),
  ul: z.boolean(),
  bx: z.boolean(),
})

export const nodeSchema = z.discriminatedUnion('type', [
  straightNodeSchema,
  flexNodeSchema,
  elbowNodeSchema,
  transitionNodeSchema,
  teeNodeSchema,
  takeoffNodeSchema,
  endcapNodeSchema,
  damperNodeSchema,
  accessdoorNodeSchema,
  diffuserNodeSchema,
  grilleNodeSchema,
  louverNodeSchema,
  fanNodeSchema,
  fcuNodeSchema,
  outdoorNodeSchema,
  roomNodeSchema,
  dimNodeSchema,
  columnNodeSchema,
  doorNodeSchema,
  winNodeSchema,
  openingNodeSchema,
  partitionNodeSchema,
  shaftNodeSchema,
  beamNodeSchema,
  stairNodeSchema,
  liftNodeSchema,
  ceilingNodeSchema,
  sketchNodeSchema,
  textNodeSchema,
  noteNodeSchema,
])

export const scaleSchema = z.string().regex(/^1:[1-9]\d*$/, 'Skala harus berformat 1:N (mis. 1:100)')

export const projectSchema = z.object({
  version: z.literal(2),
  id: z.string().min(1),
  name: z.string().min(1),
  unit: unitSchema,
  scale: scaleSchema,
  fu: flowUnitSchema,
  updated: nonNegativeNum,
  hang: hangerConfigSchema,
  layers: layersSchema,
  nodes: z.array(nodeSchema),
})

function fillMissingLayers(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input
  const obj = input as Record<string, unknown>
  if (!obj.layers || typeof obj.layers !== 'object' || Array.isArray(obj.layers)) return input
  return {
    ...obj,
    layers: {
      ...defaultLayers(),
      ...(obj.layers as Record<string, unknown>),
    },
  }
}

export function parseProject(input: unknown): Project {
  return projectSchema.parse(fillMissingLayers(input))
}

export function safeParseProject(input: unknown) {
  return projectSchema.safeParse(fillMissingLayers(input))
}
