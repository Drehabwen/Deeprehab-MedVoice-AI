export function calculateSignedAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  // Vector BA
  const ba = { x: a.x - b.x, y: a.y - b.y };
  // Vector BC
  const bc = { x: c.x - b.x, y: c.y - b.y };

  // Calculate angle using atan2
  // angle(v) = atan2(v.y, v.x)
  const angleBA = Math.atan2(ba.y, ba.x);
  const angleBC = Math.atan2(bc.y, bc.x);

  let angleRad = angleBA - angleBC;
  
  // Normalize to -PI to +PI
  while (angleRad <= -Math.PI) angleRad += 2 * Math.PI;
  while (angleRad > Math.PI) angleRad -= 2 * Math.PI;

  return angleRad * (180 / Math.PI);
}

/**
 * Calculate the angle between three points (a, b, c) with b as the vertex.
 * Returns angle in degrees (0-180).
 */
export function calculateAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  // Convert to vectors
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };

  // Calculate dot product
  const dotProduct = ba.x * bc.x + ba.y * bc.y;

  // Calculate magnitudes
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);

  // Prevent division by zero
  if (magBA === 0 || magBC === 0) return 0;

  // Calculate cosine of the angle
  let cosAngle = dotProduct / (magBA * magBC);

  // Clamp value to [-1, 1] to handle floating point errors
  cosAngle = Math.max(-1, Math.min(1, cosAngle));

  // Calculate angle in radians and convert to degrees
  const angle = Math.acos(cosAngle) * (180 / Math.PI);

  return angle;
}

/**
 * Calculate midpoint between two points.
 */
export function calculateMidpoint(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

/**
 * Convert normalized MediaPipe landmark coordinates to pixel coordinates.
 */
export function getPixelCoords(
  landmark: { x: number; y: number },
  width: number,
  height: number
): { x: number; y: number } {
  return {
    x: landmark.x * width,
    y: landmark.y * height,
  };
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export function calculateVector3D(a: Point3D, b: Point3D): Point3D {
  return {
    x: b.x - a.x,
    y: b.y - a.y,
    z: b.z - a.z
  };
}

export function dotProduct3D(v1: Point3D, v2: Point3D): number {
  return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
}

export function magnitude3D(v: Point3D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function calculateAngle3D(v1: Point3D, v2: Point3D): number {
  const dot = dotProduct3D(v1, v2);
  const mag1 = magnitude3D(v1);
  const mag2 = magnitude3D(v2);
  
  if (mag1 === 0 || mag2 === 0) return 0;
  
  let cosAngle = dot / (mag1 * mag2);
  cosAngle = Math.max(-1, Math.min(1, cosAngle));
  
  return Math.acos(cosAngle) * (180 / Math.PI);
}

export function calculateMidpoint3D(p1: Point3D, p2: Point3D): Point3D {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: (p1.z + p2.z) / 2
  };
}

export function normalize3D(v: Point3D): Point3D {
  const mag = magnitude3D(v);
  if (mag === 0) return { x: 0, y: 0, z: 0 };
  return {
    x: v.x / mag,
    y: v.y / mag,
    z: v.z / mag
  };
}

export function crossProduct3D(a: Point3D, b: Point3D): Point3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}
