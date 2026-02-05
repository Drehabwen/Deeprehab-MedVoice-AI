/**
 * Head Pose Estimation using solvePnP (Iterative Gauss-Newton)
 * Standalone implementation without OpenCV dependency.
 * Refactored to use standard 3D Face Model and MediaPipe Face Mesh landmarks.
 */

// --- 1. 3D Model Definition ---
// Standard 3D face model points based on user specification.
// Original User Model (Y-Up):
// - Nose: (0, 0, 0)
// - Chin: (0, -330, -65)
// - Left Eye: (-225, 170, -135)
// - Right Eye: (225, 170, -135)
// - Left Mouth: (-150, -150, -125)
// - Right Mouth: (150, -150, -125)
//
// Converted to Camera Coordinate System (Y-Down, Z-Forward) for solvePnP:
// We flip Y coordinates (y = -y) so that Model Y aligns with Image Y (Down).
const FACE_MODEL_POINTS_Y_DOWN = {
  NOSE: { x: 0.0, y: 0.0, z: 0.0 },
  CHIN: { x: 0.0, y: 330.0, z: -65.0 },         // Original -330 -> 330
  LEFT_EYE: { x: -225.0, y: -170.0, z: -135.0 },// Original 170 -> -170
  RIGHT_EYE: { x: 225.0, y: -170.0, z: -135.0 },
  LEFT_MOUTH: { x: -150.0, y: 150.0, z: -125.0 },// Original -150 -> 150
  RIGHT_MOUTH: { x: 150.0, y: 150.0, z: -125.0 },
};

// Map MediaPipe Face Mesh Indices (468 points) to Model
const FACE_MESH_MAP = {
  1: FACE_MODEL_POINTS_Y_DOWN.NOSE,
  152: FACE_MODEL_POINTS_Y_DOWN.CHIN,
  33: FACE_MODEL_POINTS_Y_DOWN.LEFT_EYE,
  263: FACE_MODEL_POINTS_Y_DOWN.RIGHT_EYE,
  61: FACE_MODEL_POINTS_Y_DOWN.LEFT_MOUTH,
  291: FACE_MODEL_POINTS_Y_DOWN.RIGHT_MOUTH,
};

// Fallback Map for MediaPipe Pose (33 points) - Approximate
// Pose doesn't have Chin (152). We approximate or skip.
// If we use Pose, we lose the precision of the Chin.
// We map what we have: Nose(0), Eyes(2,5), Mouth(9,10).
const POSE_MAP = {
  0: FACE_MODEL_POINTS_Y_DOWN.NOSE,
  // 2: Right Eye in Pose? No, 2 is Left Eye Inner? Let's check.
  // Pose: 0-Nose, 1-3 Left Eye, 4-6 Right Eye.
  // Let's map roughly to Eye Centers.
  2: FACE_MODEL_POINTS_Y_DOWN.LEFT_EYE, 
  5: FACE_MODEL_POINTS_Y_DOWN.RIGHT_EYE,
  9: FACE_MODEL_POINTS_Y_DOWN.LEFT_MOUTH,
  10: FACE_MODEL_POINTS_Y_DOWN.RIGHT_MOUTH
  // Missing Chin -> PnP will be less stable for Pitch.
};

// --- 2. Math Helpers ---

export class Mat3 {
  data: number[]; // Row-major

  constructor(data?: number[]) {
    this.data = data || [1, 0, 0, 0, 1, 0, 0, 0, 1]; // Identity default
  }

  static fromRodrigues(rvec: number[]): Mat3 {
    const theta = Math.sqrt(rvec[0] ** 2 + rvec[1] ** 2 + rvec[2] ** 2);
    if (theta < 1e-6) return new Mat3();

    const k = [rvec[0] / theta, rvec[1] / theta, rvec[2] / theta];
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const t = 1 - c;

    return new Mat3([
      c + k[0] * k[0] * t, k[0] * k[1] * t - k[2] * s, k[0] * k[2] * t + k[1] * s,
      k[1] * k[0] * t + k[2] * s, c + k[1] * k[1] * t, k[1] * k[2] * t - k[0] * s,
      k[2] * k[0] * t - k[1] * s, k[2] * k[1] * t + k[0] * s, c + k[2] * k[2] * t
    ]);
  }

  multiplyVec3(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    const d = this.data;
    return {
      x: d[0] * v.x + d[1] * v.y + d[2] * v.z,
      y: d[3] * v.x + d[4] * v.y + d[5] * v.z,
      z: d[6] * v.x + d[7] * v.y + d[8] * v.z
    };
  }
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    }
    [M[i], M[maxRow]] = [M[maxRow], M[i]];

    const pivot = M[i][i];
    if (Math.abs(pivot) < 1e-8) continue;
    for (let j = i; j <= n; j++) M[i][j] /= pivot;

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = M[k][i];
        for (let j = i; j <= n; j++) M[k][j] -= factor * M[i][j];
      }
    }
  }
  return M.map(row => row[n]);
}

// --- 3. solvePnP Implementation ---

interface CameraMatrix {
  fx: number; fy: number; cx: number; cy: number;
}

export interface HeadPoseResult {
  pitch: number; // Degrees (Up/Down)
  yaw: number;   // Degrees (Left/Right)
  roll: number;  // Degrees (Tilt)
  rotationMatrix: number[]; // 3x3 array
  translation: { x: number; y: number; z: number };
}

export function calculateHeadPose(landmarks: any[], width: number, height: number): HeadPoseResult | null {
  const imagePoints: { x: number; y: number; id: number }[] = [];
  const modelPoints: { x: number; y: number; z: number }[] = [];

  // Determine if using Face Mesh (> 33 points) or Pose (<= 33 points)
  const isFaceMesh = landmarks.length > 33;
  const map = isFaceMesh ? FACE_MESH_MAP : POSE_MAP;

  for (const [idStr, point3D] of Object.entries(map)) {
    const id = parseInt(idStr);
    const lm = landmarks[id];
    // Filter by visibility (if available)
    if (lm && (lm.visibility === undefined || lm.visibility > 0.5)) {
      imagePoints.push({ x: lm.x * width, y: lm.y * height, id });
      modelPoints.push(point3D);
    }
  }

  // Need at least 4 points for PnP
  if (imagePoints.length < 4) return null;

  // Approximate Camera Matrix
  // User logic: focal_length = img_w
  // Tuning: Using a slightly smaller focal length (wider FOV) can sometimes help with perspective
  // but often a sensitivity multiplier is needed for single-camera PnP.
  const focalLength = width; 
  const camMat: CameraMatrix = {
    fx: focalLength,
    fy: focalLength,
    cx: width / 2,
    cy: height / 2
  };

  const { rvec, tvec } = solvePnPIterative(modelPoints, imagePoints, camMat);
  const R = Mat3.fromRodrigues(rvec);

  // Extract Euler Angles
  // Based on rotation order, we use standard decomposition.
  // We apply a sensitivity multiplier (GAIN) because single-camera PnP on a generic model
  // often underestimates the rotation angles compared to perceived human motion.
  const YAW_GAIN = 1.5;
  const PITCH_GAIN = 1.2;
  const ROLL_GAIN = 1.2;

  const pitchRaw = Math.atan2(R.data[7], R.data[8]);
  const yawRaw = Math.asin(Math.max(-1, Math.min(1, -R.data[6]))); 
  const rollRaw = Math.atan2(R.data[3], R.data[0]);

  return {
    pitch: pitchRaw * (180 / Math.PI) * PITCH_GAIN,
    yaw: yawRaw * (180 / Math.PI) * YAW_GAIN,
    roll: rollRaw * (180 / Math.PI) * ROLL_GAIN,
    rotationMatrix: R.data,
    translation: { x: tvec[0], y: tvec[1], z: tvec[2] }
  };
}

function solvePnPIterative(
  objPoints: {x:number, y:number, z:number}[], 
  imgPoints: {x:number, y:number}[], 
  cam: CameraMatrix
) {
  let rvec = [0, 0, 0];
  let tvec = [0, 0, 500]; // Initial Z estimate
  const iterations = 10;
  
  for (let iter = 0; iter < iterations; iter++) {
    const R = Mat3.fromRodrigues(rvec);
    const JtJ = Array(6).fill(0).map(() => Array(6).fill(0));
    const Jtr = Array(6).fill(0);
    let totalError = 0;

    for (let i = 0; i < objPoints.length; i++) {
      const P = objPoints[i];
      const p_obs = imgPoints[i];

      const Pc = R.multiplyVec3(P);
      Pc.x += tvec[0];
      Pc.y += tvec[1];
      Pc.z += tvec[2];

      const z_inv = 1.0 / Pc.z;
      const z_inv2 = z_inv * z_inv;
      
      const u = cam.fx * Pc.x * z_inv + cam.cx;
      const v = cam.fy * Pc.y * z_inv + cam.cy;

      const ex = p_obs.x - u;
      const ey = p_obs.y - v;
      totalError += ex*ex + ey*ey;

      const du_dPc = [cam.fx * z_inv, 0, -cam.fx * Pc.x * z_inv2];
      const dv_dPc = [0, cam.fy * z_inv, -cam.fy * Pc.y * z_inv2];

      const dPc_dPose = [
        [0, -Pc.z, Pc.y, 1, 0, 0],
        [Pc.z, 0, -Pc.x, 0, 1, 0],
        [-Pc.y, Pc.x, 0, 0, 0, 1]
      ];

      const J = [Array(6).fill(0), Array(6).fill(0)];
      for (let k = 0; k < 6; k++) {
        J[0][k] = du_dPc[0]*dPc_dPose[0][k] + du_dPc[1]*dPc_dPose[1][k] + du_dPc[2]*dPc_dPose[2][k];
        J[1][k] = dv_dPc[0]*dPc_dPose[0][k] + dv_dPc[1]*dPc_dPose[1][k] + dv_dPc[2]*dPc_dPose[2][k];
      }

      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          JtJ[r][c] += J[0][r] * J[0][c] + J[1][r] * J[1][c];
        }
        Jtr[r] += J[0][r] * ex + J[1][r] * ey;
      }
    }

    const lambda = 0.001;
    for (let i = 0; i < 6; i++) JtJ[i][i] += lambda;

    const delta = solveLinearSystem(JtJ, Jtr);

    rvec[0] += delta[0]; rvec[1] += delta[1]; rvec[2] += delta[2];
    tvec[0] += delta[3]; tvec[1] += delta[4]; tvec[2] += delta[5];

    if (totalError / objPoints.length < 0.1) break;
  }

  return { rvec, tvec };
}

/**
 * Project 3D points to 2D image plane using calculated pose
 */
export function projectPoints(
  points3D: { x: number; y: number; z: number }[],
  rotationMatrix: number[],
  translation: { x: number; y: number; z: number },
  width: number,
  height: number
): { x: number; y: number }[] {
  const R = new Mat3(rotationMatrix);
  const fx = width;
  const fy = width;
  const cx = width / 2;
  const cy = height / 2;

  return points3D.map(p => {
    const Pc = R.multiplyVec3(p);
    Pc.x += translation.x;
    Pc.y += translation.y;
    Pc.z += translation.z;

    if (Pc.z <= 0.1) return { x: cx, y: cy }; // Behind camera or too close

    return {
      x: fx * Pc.x / Pc.z + cx,
      y: fy * Pc.y / Pc.z + cy
    };
  });
}

/**
 * Get axis endpoints for visualization (Nose origin)
 * Returns [Nose, X-Axis-End, Y-Axis-End, Z-Axis-End] in 2D
 */
export function getAxisPoints(
    rotationMatrix: number[],
    translation: { x: number; y: number; z: number },
    width: number,
    height: number,
    length: number = 100
) {
    const axes = [
        { x: 0, y: 0, z: 0 },         // Origin (Nose)
        { x: length, y: 0, z: 0 },    // X (Right)
        { x: 0, y: length, z: 0 },    // Y (Down)
        { x: 0, y: 0, z: length }     // Z (Forward/Into Head)
    ];
    return projectPoints(axes, rotationMatrix, translation, width, height);
}
