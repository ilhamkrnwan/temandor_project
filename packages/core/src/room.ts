import { dist, insetPoly, polyArea, roomPts } from './geom'
import { setRoomPoints } from './grips'
import { createNode } from './model'
import { orthoPoint, type SnapResult } from './snap'
import type { Point, RoomNode } from './types'

export const MIN_ROOM_SIDE_MM = 600
export const MIN_ROOM_AREA_MM2 = 360_000

/** Skala ulang lebar (`W`) atau panjang (`H`) ruangan; titik poligon ikut diskalakan. */
export function resizeRoom(room: RoomNode, axis: 'W' | 'H', value: number): void {
  if (!Number.isFinite(value) || value <= 0) return
  if (room.pts) {
    const idx = axis === 'W' ? 0 : 1
    const factor = value / (room[axis] || 1)
    room.pts = room.pts.map(p => (
      idx === 1
        ? [p[0], Math.round(p[1] * factor)]
        : [Math.round(p[0] * factor), p[1]]
    ))
  }
  room[axis] = value
}

/** Luas luar poligon ruangan dalam m². */
export function roomOuterAreaM2(room: Pick<RoomNode, 'W' | 'H' | 'pts'>): number {
  return Math.abs(polyArea(roomPts(room))) / 1e6
}

/** Luas bersih dalam dinding ruangan dalam m² (sama dengan label di tengah ruangan). */
export function roomInnerAreaM2(room: Pick<RoomNode, 'W' | 'H' | 't' | 'pts'>): number {
  return Math.abs(polyArea(insetPoly(roomPts(room), room.t))) / 1e6
}

/** Buat ruangan persegi dari dua sudut dunia; null bila sisi < 600 mm. */
export function roomFromCorners(a: Point, b: Point, name: string): RoomNode | null {
  const W = Math.round(Math.abs(b[0] - a[0]))
  const H = Math.round(Math.abs(b[1] - a[1]))
  if (W < MIN_ROOM_SIDE_MM || H < MIN_ROOM_SIDE_MM) return null
  return createNode('room', {
    x: Math.min(a[0], b[0]),
    y: Math.min(a[1], b[1]),
    W,
    H,
    name,
  })
}

/** Buat ruangan persegi dari sudut awal, arah kuadran kursor, dan ukuran P x L (mm). */
export function roomFromDimensions(
  origin: Point,
  cursor: Point,
  widthMm: number,
  heightMm: number,
  name: string,
): RoomNode | null {
  const b: Point = [
    origin[0] + (cursor[0] >= origin[0] ? widthMm : -widthMm),
    origin[1] + (cursor[1] >= origin[1] ? heightMm : -heightMm),
  ]
  return roomFromCorners(origin, b, name)
}

/** Buat ruangan poligon bebas dari daftar titik dunia; null bila < 3 titik atau luas < 0,36 m². */
export function roomFromPolygon(pts: readonly Point[], name: string): RoomNode | null {
  if (pts.length < 3) return null
  const room = createNode('room', { name })
  setRoomPoints(room, pts.map(p => [Math.round(p[0]), Math.round(p[1])] as Point))
  if (!room.pts || room.pts.length < 3) return null
  if (Math.abs(polyArea(roomPts(room))) < MIN_ROOM_AREA_MM2) return null
  return room
}

/** Titik target berikutnya untuk alat ruangan bebas (mengikuti ORTHO kecuali snap ke ujung/titik tutup). */
export function polyTargetPoint(
  pts: readonly Point[],
  snapped: SnapResult,
  orthoEnabled: boolean,
  shiftHeld = false,
): Point {
  const last = pts[pts.length - 1]
  if (!last || snapped.kind === 'end') {
    return [snapped.p[0], snapped.p[1]]
  }
  return orthoPoint(last, snapped.p, orthoEnabled, shiftHeld)
}

/** Cek apakah titik `target` menutup poligon kembali ke titik awal (`pts[0]`). */
export function isClosingPolyPoint(pts: readonly Point[], target: Point, toleranceMm = 1): boolean {
  return pts.length >= 3 && dist(target, pts[0]!) < toleranceMm
}
