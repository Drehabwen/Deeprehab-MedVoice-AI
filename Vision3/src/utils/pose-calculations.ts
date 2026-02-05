import { calculateAngle, calculateSignedAngle, calculateMidpoint, getPixelCoords, Point3D, calculateVector3D, calculateAngle3D, calculateMidpoint3D, normalize3D, crossProduct3D, dotProduct3D } from './math';
import { Results } from '@mediapipe/pose';

// MediaPipe Pose Landmark Indices
const LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

// Note: MediaPipe JS uses normalized coordinates (0-1). 
// For angle calculation, aspect ratio matters if we want visual angles, 
// but for relative joint angles in 3D or 2D projection, normalized coords might be sufficient 
// IF the aspect ratio is handled or if we are strictly looking at projection.
// The provided Python code converts to pixel coords, so we will do the same.

interface Point {
  x: number;
  y: number;
}

export type JointType = 'cervical' | 'shoulder' | 'thoracolumbar' | 'wrist' | 'ankle' | 'hip' | 'knee' | 'elbow';

export type MovementDirection =
  | 'flexion' | 'extension'
  | 'abduction' | 'adduction'
  | 'internal-rotation' | 'external-rotation'
  | 'left-rotation' | 'right-rotation'
  | 'left-lateral-flexion' | 'right-lateral-flexion'
  | 'ulnar-deviation' | 'radial-deviation'
  | 'dorsiflexion' | 'plantarflexion';

export const calculateJointAngle = (
  jointType: JointType,
  direction: MovementDirection,
  landmarks: any[], // MediaPipe landmarks
  width: number,
  height: number,
  side?: 'left' | 'right',
  worldLandmarks?: any[] // MediaPipe world landmarks (3D)
): number | null => {
  if (!landmarks || landmarks.length === 0) return null;

  const getPoint = (index: number): Point => getPixelCoords(landmarks[index], width, height);

  try {
    switch (jointType) {
      case 'cervical':
        return calculateCervicalROM(direction, landmarks, width, height, worldLandmarks);
      case 'shoulder':
        return calculateShoulderROM(direction, side, landmarks, width, height);
      case 'thoracolumbar':
        return calculateThoracolumbarROM(direction, landmarks, width, height);
      case 'elbow':
        return calculateElbowROM(direction, side, landmarks, width, height);
      case 'wrist':
        return calculateWristROM(direction, side, landmarks, width, height);
      case 'hip':
        return calculateHipROM(direction, side, landmarks, width, height);
      case 'knee':
        return calculateKneeROM(direction, side, landmarks, width, height);
      case 'ankle':
        return calculateAnkleROM(direction, side, landmarks, width, height);
      default:
        return null;
    }
  } catch (e) {
    console.error(`Error calculating angle for ${jointType} ${direction}:`, e);
    return null;
  }
};

// 1. 颈椎活动度
function calculateCervicalROM(
  direction: MovementDirection,
  landmarks: any[],
  width: number,
  height: number,
  worldLandmarks?: any[]
): number {
  // Priority: Use World Landmarks (3D) if available
  if (worldLandmarks && worldLandmarks.length > 0) {
    const getPoint3D = (index: number): Point3D => worldLandmarks[index];
    
    const nose = getPoint3D(LANDMARKS.NOSE);
    const leftEar = getPoint3D(LANDMARKS.LEFT_EAR);
    const rightEar = getPoint3D(LANDMARKS.RIGHT_EAR);
    const leftShoulder = getPoint3D(LANDMARKS.LEFT_SHOULDER);
    const rightShoulder = getPoint3D(LANDMARKS.RIGHT_SHOULDER);
    
    // Midpoints
    const earMid = calculateMidpoint3D(leftEar, rightEar);
    const shoulderMid = calculateMidpoint3D(leftShoulder, rightShoulder);
    const hipMid = calculateMidpoint3D(worldLandmarks[LANDMARKS.LEFT_HIP], worldLandmarks[LANDMARKS.RIGHT_HIP]);

    // Construct Torso Coordinate System (Reference Frame)
    // Y_axis (Torso Up): from HipMid to ShoulderMid
    const torsoUp = normalize3D(calculateVector3D(hipMid, shoulderMid));
    
    // X_axis (Torso Right): from Left Shoulder to Right Shoulder
    const shoulderLine = calculateVector3D(leftShoulder, rightShoulder);
    const torsoRight = normalize3D(shoulderLine);
    
    // Z_axis (Torso Forward): Cross Product of Right and Up (Assuming Right-Handed System)
    // If Right is X, Up is Y, then Z is X cross Y.
    // However, we want to ensure orthogonality.
    // Recompute Right as Cross(Up, Forward)? No, we have Right and Up roughly.
    // Let's assume Shoulder Line is roughly perpendicular to Spine.
    // Better: Forward = Cross(Right, Up) ? 
    // Right (Shoulder L->R). Up (Spine).
    // Right x Up -> Z (Forward or Backward?).
    // X(1,0,0) x Y(0,1,0) = Z(0,0,1).
    // So TorsoRight x TorsoUp = TorsoForward.
    const torsoForward = crossProduct3D(torsoRight, torsoUp);
    
    // Re-normalize TorsoRight to ensure orthogonality: Cross(Up, Forward)
    const torsoRightOrtho = normalize3D(crossProduct3D(torsoUp, torsoForward));
    
    // Now we have a Basis {torsoRightOrtho, torsoUp, torsoForward} attached to the body.

    switch (direction) {
      case 'flexion':
      case 'extension':
        // 1. Cervical Spine Flexion/Extension (Sagittal)
        // Vector: Neck (ShoulderMid -> EarMid)
        const neckVector = calculateVector3D(shoulderMid, earMid);
        
        // Project Neck Vector onto Sagittal Plane (defined by Up and Forward)
        // Component along Right axis should be removed.
        // Or simpler: Angle between Neck Vector and Torso Up axis in the Sagittal Plane.
        // Actually, 3D angle between Neck Vector and Torso Up Vector is the "total deviation".
        // But for flexion/extension, we only care about the forward/backward component.
        
        // Let's project neckVector onto the plane spanned by {torsoUp, torsoForward}.
        // P_sagittal = v - dot(v, right) * right
        const dotRight = dotProduct3D(neckVector, torsoRightOrtho);
        const neckSagittal = {
            x: neckVector.x - dotRight * torsoRightOrtho.x,
            y: neckVector.y - dotRight * torsoRightOrtho.y,
            z: neckVector.z - dotRight * torsoRightOrtho.z
        };
        
        // Calculate angle between Projected Neck and Torso Up
        // Use atan2 for signed angle?
        // In local basis {Forward, Up}:
        // y_local = dot(neckSagittal, torsoUp)
        // x_local = dot(neckSagittal, torsoForward)
        // angle = atan2(x, y)
        // If x is positive (Forward) -> Flexion (+).
        // If x is negative (Backward) -> Extension (-).
        
        const ySag = dotProduct3D(neckSagittal, torsoUp);
        const xSag = dotProduct3D(neckSagittal, torsoForward);
        
        const angleSag = Math.atan2(xSag, ySag) * (180 / Math.PI);
        
        // Angle is 0 when upright.
        // + for Forward (Flexion).
        // - for Backward (Extension).
        
        if (direction === 'flexion') {
            return angleSag; // Positive if flexing, negative if extending
        } else {
            return -angleSag; // Positive if extending, negative if flexing
        }

      case 'left-lateral-flexion':
      case 'right-lateral-flexion':
        // 2. Lateral Flexion (Coronal)
        // Plane: {Right, Up}
        // Vector: Head (ShoulderMid -> Nose) or Neck (ShoulderMid -> EarMid)?
        // Use Neck (ShoulderMid -> EarMid) for consistency with spine.
        // Or Head (ShoulderMid -> Nose) might be more visible for tilt?
        // Let's use Neck (ShoulderMid -> EarMid).
        
        const neckVectorLat = calculateVector3D(shoulderMid, earMid);
        
        // Project onto Coronal Plane {Right, Up}
        // Remove Forward component
        const dotFwd = dotProduct3D(neckVectorLat, torsoForward);
        const neckCoronal = {
            x: neckVectorLat.x - dotFwd * torsoForward.x,
            y: neckVectorLat.y - dotFwd * torsoForward.y,
            z: neckVectorLat.z - dotFwd * torsoForward.z
        };
        
        // Local coords
        const yCor = dotProduct3D(neckCoronal, torsoUp);
        const xCor = dotProduct3D(neckCoronal, torsoRightOrtho);
        
        // Angle
        const angleCor = Math.atan2(xCor, yCor) * (180 / Math.PI);
        
        // Right is Positive (Right Lateral Flexion).
        // Left is Negative.
        // Note: xCor is along TorsoRight (Left Shoulder -> Right Shoulder).
        // So positive xCor means leaning to the Right.
        
        // MediaPipe "Right" is User's Right.
        // So angleCor > 0 => Right Lateral Flexion.
        // angleCor < 0 => Left Lateral Flexion.
        
        if (direction === 'right-lateral-flexion') {
            return angleCor;
        } else {
            return -angleCor;
        }

      case 'left-rotation':
      case 'right-rotation':
        // 3. Rotation (Transverse)
        // Vector: Ear Line (Left -> Right) projected onto Transverse Plane {Right, Forward}
        const earLine = calculateVector3D(leftEar, rightEar);
        
        // Project onto Transverse Plane (Remove Up component)
        const dotUp = dotProduct3D(earLine, torsoUp);
        const earTransverse = {
            x: earLine.x - dotUp * torsoUp.x,
            y: earLine.y - dotUp * torsoUp.y,
            z: earLine.z - dotUp * torsoUp.z
        };
        
        // Calculate angle relative to Shoulder Line (TorsoRight)
        // x_local = dot(earTransverse, torsoRightOrtho)
        // y_local = dot(earTransverse, torsoForward)
        
        const xTrans = dotProduct3D(earTransverse, torsoRightOrtho);
        const yTrans = dotProduct3D(earTransverse, torsoForward);
        
        // angle = atan2(y, x).
        // If aligned, y=0, x>0 -> angle=0.
        // If rotated Left (Nose Left, Right Ear moves Forward):
        // Right Ear (End of vector) moves Forward.
        // Vector is LeftEar -> RightEar.
        // So RightEar moves Forward (+Z local).
        // So yTrans > 0.
        // Angle > 0.
        
        // So Positive Angle => Left Rotation (User turning head Left).
        // Negative Angle => Right Rotation.
        
        const angleRot = Math.atan2(yTrans, xTrans) * (180 / Math.PI);
        
        if (direction === 'left-rotation') {
            return angleRot;
        } else {
            return -angleRot;
        }
        
      default:
        return 0;
    }
  }

  // Fallback to 2D logic (original implementation)
  const getPoint = (index: number) => getPixelCoords(landmarks[index], width, height);
  const nose = getPoint(LANDMARKS.NOSE);
  const leftEar = getPoint(LANDMARKS.LEFT_EAR);
  const rightEar = getPoint(LANDMARKS.RIGHT_EAR);
  // Calculate ear midpoint for better side-view alignment (neutral head position)
  const earMid = calculateMidpoint(leftEar, rightEar);

  const leftShoulder = getPoint(LANDMARKS.LEFT_SHOULDER);
  const rightShoulder = getPoint(LANDMARKS.RIGHT_SHOULDER);
  
  const shoulderMid = calculateMidpoint(leftShoulder, rightShoulder);
  
  // Need hip mid for flexion/extension reference
  const leftHip = getPoint(LANDMARKS.LEFT_HIP);
  const rightHip = getPoint(LANDMARKS.RIGHT_HIP);
  const hipMid = calculateMidpoint(leftHip, rightHip);

  switch (direction) {
    case 'flexion':
    case 'extension':
      // Updated logic: Use EarMid instead of Nose
      // Vertex: ShoulderMid (11+12 mid)
      // Point A: EarMid (7+8 mid) - better alignment with shoulder in neutral
      // Point C: HipMid (23+24 mid)
      
      // Calculate Signed Angle to distinguish Flexion (positive) vs Extension (negative)
      // Vector A: ShoulderMid -> EarMid (Head Vector)
      // Vector C: ShoulderMid -> HipMid (Torso Vector)
      
      const vTorso = { x: shoulderMid.x - hipMid.x, y: shoulderMid.y - hipMid.y };
      const vHead = { x: earMid.x - shoulderMid.x, y: earMid.y - shoulderMid.y };
      
      const angleRad = Math.atan2(vHead.y, vHead.x) - Math.atan2(vTorso.y, vTorso.x);
      let angleDeg = angleRad * (180 / Math.PI);
      
      // Normalize to -180 to 180
      while (angleDeg <= -180) angleDeg += 360;
      while (angleDeg > 180) angleDeg -= 360;
      
      // Determine sign based on facing direction
      const isFacingLeft = nose.x < leftEar.x; 
      
      if (isFacingLeft) {
          return -angleDeg;
      } else {
          return angleDeg;
      }
    
    case 'left-rotation':
    case 'right-rotation':
      // 1. 获取关键点的3D坐标 (Use z from 2D landmarks if available, which are often normalized z)
      const n = landmarks[LANDMARKS.NOSE];
      const le = landmarks[LANDMARKS.LEFT_EAR];
      const re = landmarks[LANDMARKS.RIGHT_EAR];
      
      if (n.z === undefined || le.z === undefined || re.z === undefined) {
          return 0;
      }
      
      // 2. 头部向量 (Head Vector)
      // 中点
      const midEarZ = (le.z + re.z) / 2;
      const midEarX = (le.x + re.x) / 2;
      
      // 向量：从耳连线中点指向鼻尖
      const vecHead = { x: n.x - midEarX, z: n.z - midEarZ };
      
      // 3. 计算偏航角 (Yaw) 相对于相机Z轴
      const Z_SCALE = 2.5; 
      
      const yawAngle = Math.atan2(vecHead.x, -vecHead.z * Z_SCALE) * (180 / Math.PI);
       
       // 4. 根据任务方向返回正值
       if (direction === 'left-rotation') {
           return -yawAngle;
       } else {
           return yawAngle;
       }

    case 'left-lateral-flexion':
    case 'right-lateral-flexion':
      // Use Signed Angle to differentiate Left vs Right lateral flexion.
      // Torso Axis (Up): HipMid -> ShoulderMid
      // Head Axis (Up): ShoulderMid -> EarMid (Using EarMid instead of Nose for better alignment)
      
      const vTorso2 = { x: shoulderMid.x - hipMid.x, y: shoulderMid.y - hipMid.y };
      const vHead2 = { x: earMid.x - shoulderMid.x, y: earMid.y - shoulderMid.y };
      
      const angleRad2 = Math.atan2(vHead2.y, vHead2.x) - Math.atan2(vTorso2.y, vTorso2.x);
      let angleDeg2 = angleRad2 * (180 / Math.PI);
      
      // Normalize
      while (angleDeg2 <= -180) angleDeg2 += 360;
      while (angleDeg2 > 180) angleDeg2 -= 360;
      
      // Let's flip it so Left (Screen Left) is Positive.
      return -angleDeg2;
      
    default:
      return 0;
  }
}

// 2. 肩关节活动度
function calculateShoulderROM(
  direction: MovementDirection,
  side: 'left' | 'right' | undefined,
  landmarks: any[],
  width: number,
  height: number
): number {
  const getPoint = (index: number) => getPixelCoords(landmarks[index], width, height);
  
  if (!side) return 0;

  const shoulder = getPoint(side === 'left' ? LANDMARKS.LEFT_SHOULDER : LANDMARKS.RIGHT_SHOULDER);
  const elbow = getPoint(side === 'left' ? LANDMARKS.LEFT_ELBOW : LANDMARKS.RIGHT_ELBOW);
  const hip = getPoint(side === 'left' ? LANDMARKS.LEFT_HIP : LANDMARKS.RIGHT_HIP);
  // Opposite shoulder for reference in flexion/extension
  const oppositeShoulder = getPoint(side === 'left' ? LANDMARKS.RIGHT_SHOULDER : LANDMARKS.LEFT_SHOULDER);

  switch (direction) {
    case 'flexion':
    case 'extension':
      // 左：顶点 11（左肩），a：12（右肩），c：13（左肘）
      return Math.abs(90 - calculateAngle(oppositeShoulder, shoulder, elbow));
    
    case 'abduction':
    case 'adduction': // Usually abduction logic covers adduction range
      // 左：顶点 11（左肩），a：23（左髋），c：13（左肘）
      return calculateAngle(hip, shoulder, elbow);
      
    default:
      return 0;
  }
}

// 3. 胸腰椎活动度
function calculateThoracolumbarROM(
  direction: MovementDirection,
  landmarks: any[],
  width: number,
  height: number
): number {
  const getPoint = (index: number) => getPixelCoords(landmarks[index], width, height);
  
  const leftShoulder = getPoint(LANDMARKS.LEFT_SHOULDER);
  const rightShoulder = getPoint(LANDMARKS.RIGHT_SHOULDER);
  const shoulderMid = calculateMidpoint(leftShoulder, rightShoulder);
  
  const leftHip = getPoint(LANDMARKS.LEFT_HIP);
  const rightHip = getPoint(LANDMARKS.RIGHT_HIP);
  const hipMid = calculateMidpoint(leftHip, rightHip);
  
  const nose = getPoint(LANDMARKS.NOSE);

  switch (direction) {
    case 'flexion':
    case 'extension':
      // 前屈/后伸: 顶点 shoulder_mid, a: nose, c: hip_mid
      return Math.abs(180 - calculateAngle(nose, shoulderMid, hipMid));
      
    case 'left-lateral-flexion':
    case 'right-lateral-flexion':
      // 左侧屈/右侧屈: 顶点 hip_mid, a: shoulder_mid (implied from snippet which uses landmarks[11]??)
      // Snippet: spine_lateral = calculate_angle(get_pixel_coords(landmarks[11], img_shape), hip_mid, get_pixel_coords(landmarks[12], img_shape))
      // This calculates angle between left shoulder, hip mid, and right shoulder. 
      // This angle changes as torso bends sideways.
      return calculateAngle(leftShoulder, hipMid, rightShoulder);
      
    default:
      return 0;
  }
}

// 4. 肘关节活动度
function calculateElbowROM(
  direction: MovementDirection,
  side: 'left' | 'right' | undefined,
  landmarks: any[],
  width: number,
  height: number
): number {
  const getPoint = (index: number) => getPixelCoords(landmarks[index], width, height);
  
  if (!side) return 0;

  const shoulder = getPoint(side === 'left' ? LANDMARKS.LEFT_SHOULDER : LANDMARKS.RIGHT_SHOULDER);
  const elbow = getPoint(side === 'left' ? LANDMARKS.LEFT_ELBOW : LANDMARKS.RIGHT_ELBOW);
  const wrist = getPoint(side === 'left' ? LANDMARKS.LEFT_WRIST : LANDMARKS.RIGHT_WRIST);

  switch (direction) {
    case 'flexion':
    case 'extension':
      return Math.abs(180 - calculateAngle(shoulder, elbow, wrist));
    default:
      return 0;
  }
}

// 5. 膝关节活动度
function calculateKneeROM(
  direction: MovementDirection,
  side: 'left' | 'right' | undefined,
  landmarks: any[],
  width: number,
  height: number
): number {
  const getPoint = (index: number) => getPixelCoords(landmarks[index], width, height);
  
  if (!side) return 0;

  const hip = getPoint(side === 'left' ? LANDMARKS.LEFT_HIP : LANDMARKS.RIGHT_HIP);
  const knee = getPoint(side === 'left' ? LANDMARKS.LEFT_KNEE : LANDMARKS.RIGHT_KNEE);
  const ankle = getPoint(side === 'left' ? LANDMARKS.LEFT_ANKLE : LANDMARKS.RIGHT_ANKLE);

  switch (direction) {
    case 'flexion':
    case 'extension':
      return Math.abs(180 - calculateAngle(hip, knee, ankle));
    default:
      return 0;
  }
}

// 6. 腕关节活动度
function calculateWristROM(
  direction: MovementDirection,
  side: 'left' | 'right' | undefined,
  landmarks: any[],
  width: number,
  height: number
): number {
  const getPoint = (index: number) => getPixelCoords(landmarks[index], width, height);
  
  if (!side) return 0;

  const elbow = getPoint(side === 'left' ? LANDMARKS.LEFT_ELBOW : LANDMARKS.RIGHT_ELBOW);
  const wrist = getPoint(side === 'left' ? LANDMARKS.LEFT_WRIST : LANDMARKS.RIGHT_WRIST);
  const indexFinger = getPoint(side === 'left' ? LANDMARKS.LEFT_INDEX : LANDMARKS.RIGHT_INDEX);
  const pinkyFinger = getPoint(side === 'left' ? LANDMARKS.LEFT_PINKY : LANDMARKS.RIGHT_PINKY); // Approx for ulnar side
  const thumbFinger = getPoint(side === 'left' ? LANDMARKS.LEFT_THUMB : LANDMARKS.RIGHT_THUMB); // Approx for radial side
  
  // Use Index finger as main reference for flexion/extension
  
  switch (direction) {
    case 'flexion':
    case 'extension':
      // 顶点15（左腕），a=13（左肘），c=17（左手指 - usually pinky or index, let's use index for better line）
      // Snippet says c=17 (pinky). Let's stick to user snippet if possible or improve.
      // User snippet: c=17 (Left Pinky).
      const finger = getPoint(side === 'left' ? LANDMARKS.LEFT_PINKY : LANDMARKS.RIGHT_PINKY);
      return Math.abs(180 - calculateAngle(elbow, wrist, finger));
      
    case 'ulnar-deviation':
    case 'radial-deviation':
      // a=15.x±10,15.y (Horizontal line reference?), c=17
      // Creating a virtual point for reference line (e.g., forearm line projected?)
      // Deviation is usually angle between forearm axis and hand axis.
      // Forearm axis: Elbow -> Wrist. Hand axis: Wrist -> Middle Finger (approx Index).
      // If result is 180, it's straight. Deviation is offset from 180.
      return calculateAngle(elbow, wrist, indexFinger);
      
    default:
      return 0;
  }
}

// 7. 踝关节活动度
function calculateAnkleROM(
  direction: MovementDirection,
  side: 'left' | 'right' | undefined,
  landmarks: any[],
  width: number,
  height: number
): number {
  const getPoint = (index: number) => getPixelCoords(landmarks[index], width, height);
  
  if (!side) return 0;

  const knee = getPoint(side === 'left' ? LANDMARKS.LEFT_KNEE : LANDMARKS.RIGHT_KNEE);
  const ankle = getPoint(side === 'left' ? LANDMARKS.LEFT_ANKLE : LANDMARKS.RIGHT_ANKLE);
  // User snippet: c=29 (Left Heel) ? Or 31 (Foot Index)?
  // Snippet: c=29 (left heel) ?? Actually typically Foot Index (toe) is better for dorsiflexion.
  // Snippet says c=29 (Left Heel). Let's check landmark 29. It is LEFT_HEEL.
  // However, dorsiflexion is angle between shin and foot.
  // Using Knee, Ankle, Foot Index (Toe) is standard.
  // Let's use Foot Index (31/32).
  const footIndex = getPoint(side === 'left' ? LANDMARKS.LEFT_FOOT_INDEX : LANDMARKS.RIGHT_FOOT_INDEX);

  switch (direction) {
    case 'dorsiflexion':
    case 'plantarflexion':
      return Math.abs(90 - calculateAngle(knee, ankle, footIndex));
    default:
      return 0;
  }
}

// 8. 髋关节活动度
function calculateHipROM(
  direction: MovementDirection,
  side: 'left' | 'right' | undefined,
  landmarks: any[],
  width: number,
  height: number
): number {
  const getPoint = (index: number) => getPixelCoords(landmarks[index], width, height);
  
  if (!side) return 0;

  const shoulder = getPoint(side === 'left' ? LANDMARKS.LEFT_SHOULDER : LANDMARKS.RIGHT_SHOULDER);
  const hip = getPoint(side === 'left' ? LANDMARKS.LEFT_HIP : LANDMARKS.RIGHT_HIP);
  const knee = getPoint(side === 'left' ? LANDMARKS.LEFT_KNEE : LANDMARKS.RIGHT_KNEE);
  const oppositeHip = getPoint(side === 'left' ? LANDMARKS.RIGHT_HIP : LANDMARKS.LEFT_HIP);

  switch (direction) {
    case 'flexion':
    case 'extension':
      // 屈/伸→顶点23（左髋），a=11（左肩），c=25（左膝）
      return Math.abs(180 - calculateAngle(shoulder, hip, knee));
      
    case 'abduction':
    case 'adduction':
      // 内收/外展→顶点23，a=24（右髋），c=25
      return Math.abs(90 - calculateAngle(oppositeHip, hip, knee));
      
    case 'internal-rotation':
    case 'external-rotation':
      // Rotation is hard in 2D without specific seated/prone setup.
      // Usually detected by angle of lower leg relative to vertical when knee is bent 90 deg.
      // We will skip complex 2D rotation for now or just return 0 as placeholder unless we have specific logic.
      return 0;

    default:
      return 0;
  }
}
