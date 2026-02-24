/**
 * Represents the 8 possible directions for a Landolt C
 */
export const Direction = {
  Right: 0,
  BottomRight: 1,
  Bottom: 2,
  BottomLeft: 3,
  Left: 4,
  TopLeft: 5,
  Top: 6,
  TopRight: 7
} as const
export type Direction = typeof Direction[keyof typeof Direction]

/**
 * Calculates the size of the gap (in mm) based on distance and visual angle.
 * For a standard Landolt C:
 *   Visual Acuity (V) = 1 / Visual Angle (in minutes)
 *   gap size (mm) = 2 * distance(mm) * tan(angle_in_radians / 2)
 *
 * A Visual Acuity of 1.0 means the eye can resolve a gap that subtends 1 arcminute (1/60 degree).
 * The overall ring diameter is 5 times the gap size.
 * The stroke width is equal to the gap size.
 */
export function calculateGapSizeMm(distanceM: number, targetAcuity: number): number {
  const distanceMm = distanceM * 1000
  // Standard acuity: V = 1/a (a is arcminutes)
  // a = 1 / V
  const arcMinutes = 1.0 / targetAcuity
  const degrees = arcMinutes / 60.0
  const radians = degrees * (Math.PI / 180.0)

  // Exact calculation
  return 2 * distanceMm * Math.tan(radians / 2)
}

/**
 * Draws a Landolt C ring on the given canvas context.
 * @param ctx The 2D rendering context
 * @param cx Center X coordinate
 * @param cy Center Y coordinate
 * @param gapSizePx The size of the gap (and stroke width) in pixels
 * @param direction The direction of the gap (0-7, where 0 is Right, going clockwise)
 * @param color Color of the ring
 */
export function drawLandoltC(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  gapSizePx: number,
  direction: Direction,
  color: string = '#f0f0f0'
) {
  const outerDiameterPx = gapSizePx * 5
  const outerRadiusPx = outerDiameterPx / 2

  ctx.save()

  // Move context to center
  ctx.translate(cx, cy)

  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = gapSizePx

  // Draw the full circle
  ctx.beginPath()
  // The arc is drawn at the center of the stroke, so radius is (outerRadius - half_stroke)
  ctx.arc(0, 0, outerRadiusPx - (gapSizePx / 2), 0, Math.PI * 2, false)
  ctx.stroke()

  // Erase the gap by drawing over it using destination-out
  ctx.rotate((Math.PI * 2) / 8 * direction)

  ctx.globalCompositeOperation = 'destination-out'
  // Center the clearing rectangle accurately on the stroke
  // The gap width is exactly gapSizePx. We make it slightly longer to ensure clean cut.
  ctx.fillRect(0, -(gapSizePx / 2), outerRadiusPx + gapSizePx, gapSizePx)

  ctx.restore()
}
