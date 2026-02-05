
export interface JointRange {
  min: number;
  max: number;
}

export const STANDARD_RANGES: Record<string, Record<string, JointRange>> = {
  cervical: {
    flexion: { min: 80, max: 90 },
    extension: { min: 50, max: 70 },
    'left-rotation': { min: 70, max: 90 },
    'right-rotation': { min: 70, max: 90 },
    'left-lateral-flexion': { min: 20, max: 45 },
    'right-lateral-flexion': { min: 20, max: 45 },
  },
  shoulder: {
    flexion: { min: 0, max: 180 },
    extension: { min: 0, max: 60 },
    abduction: { min: 0, max: 180 },
    adduction: { min: 0, max: 50 }, // Sometimes considered 0-50 across body
    'internal-rotation': { min: 0, max: 70 },
    'external-rotation': { min: 0, max: 90 },
  },
  elbow: {
    flexion: { min: 0, max: 150 },
    extension: { min: 0, max: 0 }, // Hyperextension possible but standard is 0
  },
  wrist: {
    flexion: { min: 0, max: 80 },
    extension: { min: 0, max: 70 },
    'ulnar-deviation': { min: 0, max: 30 },
    'radial-deviation': { min: 0, max: 20 },
  },
  thoracolumbar: {
    flexion: { min: 0, max: 80 }, // Lumbar ~60, Thoracic ~45. Combined ~80-90
    extension: { min: 0, max: 25 },
    'left-lateral-flexion': { min: 0, max: 35 },
    'right-lateral-flexion': { min: 0, max: 35 },
    'left-rotation': { min: 0, max: 45 },
    'right-rotation': { min: 0, max: 45 },
  },
  hip: {
    flexion: { min: 0, max: 120 },
    extension: { min: 0, max: 30 },
    abduction: { min: 0, max: 45 },
    adduction: { min: 0, max: 30 },
    'internal-rotation': { min: 0, max: 45 },
    'external-rotation': { min: 0, max: 45 },
  },
  knee: {
    flexion: { min: 0, max: 135 },
    extension: { min: 0, max: 0 },
  },
  ankle: {
    dorsiflexion: { min: 0, max: 20 },
    plantarflexion: { min: 0, max: 50 },
  },
};

export const getStandardRange = (joint: string, direction: string): JointRange | null => {
  if (!STANDARD_RANGES[joint]) return null;
  return STANDARD_RANGES[joint][direction] || null;
};
