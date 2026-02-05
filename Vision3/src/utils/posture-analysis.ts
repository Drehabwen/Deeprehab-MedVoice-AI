import { getPixelCoords } from './math';
import { calculateHeadPose, getAxisPoints } from './head-pose-estimation';

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

export interface ReferenceLine {
    from: { x: number; y: number };
    to: { x: number; y: number };
    color: string;
    label?: string;
    lineWidth?: number;
    dash?: number[];
}

export interface PostureIssue {
  id: string;
  type: string;
  severity: 'mild' | 'moderate' | 'severe';
  title: string;
  description: string;
  recommendation: string;
  points?: { x: number; y: number }[];
  lines?: ReferenceLine[];
}

export interface PostureMetrics {
  shoulderAngle?: number; // degrees
  hipAngle?: number;      // degrees
  headDeviation?: number; // ratio
  headForward?: number;   // ratio
  shoulderRounded?: number; // ratio
  headPitch?: number; // degrees
  headYaw?: number;   // degrees
  headRoll?: number;  // degrees
}

export interface PostureResult {
  issues: PostureIssue[];
  metrics: PostureMetrics;
  headPoseAxes?: { x: number; y: number }[];
}

export function getPostureReferenceLines(
  view: 'front' | 'back' | 'side',
    landmarks: any[],
    width: number,
    height: number
): ReferenceLine[] {
    const lines: ReferenceLine[] = [];
    const getPoint = (index: number) => getPixelCoords(landmarks[index], width, height);

    if (view === 'front' || view === 'back') {
        // 1. Horizontal Shoulder Line
        const lShoulder = getPoint(LANDMARKS.LEFT_SHOULDER);
        const rShoulder = getPoint(LANDMARKS.RIGHT_SHOULDER);
        lines.push({
            from: lShoulder,
            to: rShoulder,
            color: 'rgba(0, 255, 255, 0.7)', // Cyan
            label: '肩线',
            dash: [5, 5]
        });

        // 2. Horizontal Hip Line
        const lHip = getPoint(LANDMARKS.LEFT_HIP);
        const rHip = getPoint(LANDMARKS.RIGHT_HIP);
        lines.push({
            from: lHip,
            to: rHip,
            color: 'rgba(0, 255, 255, 0.7)',
            label: '髋线',
            dash: [5, 5]
        });

        // 3. Vertical Midline (Plumb Line)
        // Base on midpoint of ankles
        const lAnkle = getPoint(LANDMARKS.LEFT_ANKLE);
        const rAnkle = getPoint(LANDMARKS.RIGHT_ANKLE);
        const midAnkleX = (lAnkle.x + rAnkle.x) / 2;
        const midAnkleY = (lAnkle.y + rAnkle.y) / 2; // Roughly ground level or ankle level
        
        // Draw line from top of screen to bottom passing through midAnkleX
        // But better to base it on body center. Let's draw from Nose/Head to Feet Midpoint
        // Standard plumb line usually starts from feet midpoint and goes up
        lines.push({
            from: { x: midAnkleX, y: height * 0.1 },
            to: { x: midAnkleX, y: height * 0.95 },
            color: 'rgba(255, 255, 0, 0.8)', // Yellow
            label: '中线',
            lineWidth: 2
        });
    }

    if (view === 'side') {
        // Assume Left side is visible or primary for side view logic (Standard usually Left Lateral View)
        // If user faces right, we might need to detect which side is closer. 
        // For simplicity, we use the side that has higher visibility or just default to Left if unknown,
        // but typically side view analysis expects a specific orientation.
        // Let's check which ankle is more visible or assume the user follows instruction.
        // Or simply draw the line through the ANKLE (Lateral Malleolus)
        
        const lAnkle = getPoint(LANDMARKS.LEFT_ANKLE);
        const rAnkle = getPoint(LANDMARKS.RIGHT_ANKLE);
        // Use the ankle that is lower (closest to ground in image? no) or just Left for now.
        // Better: Use the ankle with better visibility score if available, but here we just have coords.
        // Let's use Left Ankle as anchor for "Plumb Line"
        const anchor = landmarks[LANDMARKS.LEFT_ANKLE].visibility > landmarks[LANDMARKS.RIGHT_ANKLE].visibility 
            ? lAnkle 
            : rAnkle;

        // Draw Vertical Plumb Line through Ankle
        lines.push({
            from: { x: anchor.x, y: height * 0.05 },
            to: { x: anchor.x, y: height * 0.95 },
            color: 'rgba(255, 255, 0, 0.8)', // Yellow
            label: '垂直参考线',
            lineWidth: 2
        });
    }

    return lines;
}

export function analyzePosture(
  view: 'front' | 'back' | 'side',
  landmarks: any[],
  width: number,
  height: number,
  faceLandmarks?: any[] // Optional Face Mesh landmarks (468 points)
): PostureResult {
  const issues: PostureIssue[] = [];
  const metrics: PostureMetrics = {};
  const getPoint = (index: number) => getPixelCoords(landmarks[index], width, height);

  // --- Head Pose Analysis (PnP) ---
  // Use Face Mesh landmarks if available, otherwise fall back to Pose landmarks
  const headPose = calculateHeadPose(faceLandmarks || landmarks, width, height);
  
  let headPoseAxes: { x: number; y: number }[] | undefined;

  if (headPose) {
      // Calculate Torso Yaw (Shoulder Rotation) to detect compensatory movement
      const lShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
      const rShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];
      let torsoYaw = 0;
      
      // MediaPipe Z: Negative is closer to camera.
      if (lShoulder && rShoulder && lShoulder.z !== undefined && rShoulder.z !== undefined) {
          // dx: Horizontal distance (Right - Left). Should be positive when facing forward.
          const dx = Math.abs(rShoulder.x - lShoulder.x); 
          // dz: Depth difference (Right - Left).
          // If Left is closer (z smaller), dz = R.z - L.z > 0.
          // This corresponds to rotation towards user's right (screen right).
          const dz = rShoulder.z - lShoulder.z;
          
          // Angle in degrees
          torsoYaw = Math.atan2(dz, dx) * (180 / Math.PI);
      }

      // Compensated Yaw
      // Assuming Head Yaw and Torso Yaw have same sign convention for same direction rotation.
      // We subtract Torso Yaw to get pure Cervical Rotation.
      metrics.headPitch = headPose.pitch;
      metrics.headYaw = headPose.yaw - torsoYaw; 
      metrics.headRoll = headPose.roll;
      
      // Calculate Axes for visualization
      headPoseAxes = getAxisPoints(
          headPose.rotationMatrix, 
          headPose.translation, 
          width, 
          height
      );

      // Check for significant head rotation/tilt (e.g. > 10 degrees)
      if (Math.abs(headPose.yaw) > 15) {
           issues.push({
              id: 'head-rotation',
              type: 'alignment',
              severity: Math.abs(headPose.yaw) > 30 ? 'severe' : 'mild',
              title: '头部旋转',
              description: `头部向${headPose.yaw > 0 ? '右' : '左'}旋转约 ${Math.abs(headPose.yaw).toFixed(0)}°。`,
              recommendation: '请保持头部正视前方，避免颈部扭转。',
           });
      }

      if (Math.abs(headPose.roll) > 10) {
           issues.push({
              id: 'head-tilt',
              type: 'alignment',
              severity: Math.abs(headPose.roll) > 20 ? 'moderate' : 'mild',
              title: '头部侧倾',
              description: `头部向${headPose.roll > 0 ? '右' : '左'}侧倾斜约 ${Math.abs(headPose.roll).toFixed(0)}°。`,
              recommendation: '建议检查颈部肌肉紧张度，保持视线水平。',
           });
      }
      
      // Use Pitch to detect "Looking Down/Up"
      if (Math.abs(headPose.pitch) > 15) {
           issues.push({
              id: 'head-pitch',
              type: 'alignment',
              severity: 'mild',
              title: headPose.pitch > 0 ? '抬头' : '低头', // Pitch > 0 is usually looking up (depending on coord system, need verify)
              // In my implementation: sin(pitch) = -R[2][1]. 
              // Standard CV: Y down. Looking down rotates around X positive?
              // Let's assume description based on value for now.
              description: `头部${headPose.pitch > 0 ? '上仰' : '下俯'}约 ${Math.abs(headPose.pitch).toFixed(0)}°。`,
              recommendation: '请收下巴，保持颈椎中立位。',
           });
      }
  }

  // --- Side View Analysis ---
  if (view === 'side') {
    // Detect which side is facing camera based on visibility or z-index (if available)
    // For simplicity, we check which shoulder is "left-most" or just use Left indices if visibility is good.
    // Standard protocol: Left side view.
    const ear = getPoint(LANDMARKS.LEFT_EAR);
    const shoulder = getPoint(LANDMARKS.LEFT_SHOULDER);
    const hip = getPoint(LANDMARKS.LEFT_HIP);
    // const knee = getPoint(LANDMARKS.LEFT_KNEE);
    const ankle = getPoint(LANDMARKS.LEFT_ANKLE);

    // 1. Forward Head Posture (Head Anterior Translation)
    // Check horizontal distance between Ear and Shoulder
    // Or better: Horizontal distance between Ear and Vertical Line through Shoulder
    // Wait, Plumb line is through Ankle. 
    // Ideally: Ear, Shoulder, Hip, Knee, Ankle should be on the vertical line.
    
    // Check Ear relative to Shoulder vertical line
    const headOffset = ear.x - shoulder.x; 
    // In pixel coords, if user faces Left (Ear x < Shoulder x), negative means back?
    // Let's assume user faces Left (looking at left of screen). 
    // If facing Right: Nose x > Ear x.
    const nose = getPoint(LANDMARKS.NOSE);
    const isFacingRight = nose.x > ear.x;

    // Calculate horizontal distance from Ear to Shoulder
    const earToShoulderDist = isFacingRight ? (ear.x - shoulder.x) : (shoulder.x - ear.x);
    // If Ear is significantly "in front" of shoulder.
    // "In front" means:
    // If facing Right: Ear X > Shoulder X ? No, Ear X should be same as Shoulder X.
    // Forward head means Ear is further in direction of gaze.
    
    const horizontalDist = Math.abs(ear.x - shoulder.x);
    // Normalize by some body metric (e.g., head height or shoulder-hip distance) to be scale invariant?
    // Let's use vertical distance between ear and shoulder as scale reference.
    const verticalScale = Math.abs(shoulder.y - ear.y) || 1;
    const forwardRatio = horizontalDist / verticalScale;
    
    metrics.headForward = forwardRatio;

    // Thresholds need tuning. 0.2 is a rough guess.
    if (forwardRatio > 0.25) {
        issues.push({
            id: 'head-forward',
            type: 'head-forward',
            severity: forwardRatio > 0.45 ? 'severe' : 'moderate',
            title: '头前倾',
            description: `耳垂位于肩峰前方 (偏移指数: ${forwardRatio.toFixed(2)})`,
            recommendation: '建议进行颈部收缩训练（Chin Tucks），放松胸锁乳突肌和上斜方肌。',
            points: [ear, shoulder],
            lines: [
                { from: ear, to: { x: ear.x, y: shoulder.y }, color: 'red' }, // Vertical drop from ear
                { from: shoulder, to: { x: shoulder.x, y: ear.y }, color: 'blue', dash: [2, 2] } // Reference vertical
            ]
        });
    }

    // 2. Rounded Shoulders (Internal Rotation) - Hard to see in 2D side view directly without depth
    // Usually checked by position of hands or shoulder vs ear.
    // If shoulder is forward of Hip?
    const shoulderToHipDist = isFacingRight ? (shoulder.x - hip.x) : (hip.x - shoulder.x);
    // If shoulder is "in front" of hip significantly.
    // Ideally Shoulder and Hip align vertically.
    const shoulderHipOffset = Math.abs(shoulder.x - hip.x);
    const trunkHeight = Math.abs(hip.y - shoulder.y) || 1;
    const kyphosisRatio = shoulderHipOffset / trunkHeight;
    
    metrics.shoulderRounded = kyphosisRatio;

    if (kyphosisRatio > 0.15) {
         issues.push({
            id: 'rounded-shoulders',
            type: 'posture',
            severity: 'mild',
            title: '圆肩/含胸',
            description: '肩关节相对于髋关节前移，可能伴随胸椎后凸。',
            recommendation: '建议加强背部肌群（菱形肌、中下斜方肌），伸展胸大肌。',
            points: [shoulder, hip],
            lines: [{ from: shoulder, to: hip, color: 'orange' }]
         });
    }
  }

  // --- Front/Back View Analysis ---
  if (view === 'front' || view === 'back') {
    const lShoulder = getPoint(LANDMARKS.LEFT_SHOULDER);
    const rShoulder = getPoint(LANDMARKS.RIGHT_SHOULDER);
    const lHip = getPoint(LANDMARKS.LEFT_HIP);
    const rHip = getPoint(LANDMARKS.RIGHT_HIP);

    // 1. Uneven Shoulders
    const shoulderSlope = Math.abs(lShoulder.y - rShoulder.y) / Math.abs(lShoulder.x - rShoulder.x);
    const shoulderAngle = Math.atan(shoulderSlope) * (180 / Math.PI);
    metrics.shoulderAngle = shoulderAngle;

    if (shoulderSlope > 0.05) { // ~3 degrees
        const isLeftHigh = lShoulder.y < rShoulder.y; // Y increases downwards
        issues.push({
            id: 'uneven-shoulders',
            type: 'imbalance',
            severity: shoulderSlope > 0.1 ? 'moderate' : 'mild',
            title: '高低肩',
            description: `${isLeftHigh ? '左' : '右'}肩较高。可能由背包习惯或脊柱侧弯引起。`,
            recommendation: '建议平衡双侧斜方肌力量，检查是否有脊柱侧弯风险。',
            points: [lShoulder, rShoulder],
            lines: [{ from: lShoulder, to: rShoulder, color: 'red', lineWidth: 3 }]
        });
    }

    // 2. Uneven Hips (Pelvic Tilt)
    const hipSlope = Math.abs(lHip.y - rHip.y) / Math.abs(lHip.x - rHip.x);
    const hipAngle = Math.atan(hipSlope) * (180 / Math.PI);
    metrics.hipAngle = hipAngle;

    if (hipSlope > 0.05) {
        const isLeftHigh = lHip.y < rHip.y;
        issues.push({
            id: 'uneven-hips',
            type: 'imbalance',
            severity: hipSlope > 0.1 ? 'moderate' : 'mild',
            title: '骨盆侧倾 (Pelvic Tilt)',
            description: `${isLeftHigh ? '左' : '右'}侧骨盆较高。可能存在长短腿或核心肌力不平衡。`,
            recommendation: '建议加强臀中肌和核心肌群，必要时进行步态分析。',
            points: [lHip, rHip],
            lines: [{ from: lHip, to: rHip, color: 'red', lineWidth: 3 }]
        });
    }
    
    // 3. Body Alignment (Midline Shift)
    // Check if Head (Nose) is aligned with center of Hips/Ankles
    const nose = getPoint(LANDMARKS.NOSE);
    const midHipX = (lHip.x + rHip.x) / 2;
    const midAnkleX = (getPoint(LANDMARKS.LEFT_ANKLE).x + getPoint(LANDMARKS.RIGHT_ANKLE).x) / 2;
    
    // Deviation of nose from ankle midline
    // Normalize by shoulder width
    const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);
    const deviation = Math.abs(nose.x - midAnkleX);
    const deviationRatio = deviation / shoulderWidth;
    
    metrics.headDeviation = deviationRatio;

    if (deviationRatio > 0.1) {
         issues.push({
            id: 'midline-shift',
            type: 'alignment',
            severity: 'moderate',
            title: '身体中线偏移',
            description: '头部或躯干偏离身体重心垂直线。',
            recommendation: '建议进行核心稳定性训练和本体感觉训练。',
            points: [nose, {x: midAnkleX, y: nose.y}],
            lines: [{ from: nose, to: { x: midAnkleX, y: getPoint(LANDMARKS.LEFT_ANKLE).y }, color: 'orange', dash: [5,5] }]
         });
    }
  }

  return { issues, metrics, headPoseAxes };
}