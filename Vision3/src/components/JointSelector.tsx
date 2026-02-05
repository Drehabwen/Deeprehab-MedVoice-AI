import { useState, useEffect } from 'react';
import { useMeasurementStore } from '@/store/useMeasurementStore';
import { JointType, MovementDirection } from '@/utils/pose-calculations';

const JOINTS: { label: string; value: JointType }[] = [
  { label: '颈椎', value: 'cervical' },
  { label: '肩关节', value: 'shoulder' },
  { label: '胸腰椎', value: 'thoracolumbar' },
  { label: '肘关节', value: 'elbow' },
  { label: '腕关节', value: 'wrist' },
  { label: '髋关节', value: 'hip' },
  { label: '膝关节', value: 'knee' },
  { label: '踝关节', value: 'ankle' },
];

const DIRECTIONS: Record<JointType, { label: string; value: MovementDirection }[]> = {
  cervical: [
    { label: '前屈', value: 'flexion' },
    { label: '后伸', value: 'extension' },
    { label: '左旋', value: 'left-rotation' },
    { label: '右旋', value: 'right-rotation' },
    { label: '左侧屈', value: 'left-lateral-flexion' },
    { label: '右侧屈', value: 'right-lateral-flexion' },
  ],
  shoulder: [
    { label: '前屈', value: 'flexion' },
    { label: '后伸', value: 'extension' },
    { label: '外展', value: 'abduction' },
  ],
  thoracolumbar: [
    { label: '前屈', value: 'flexion' },
    { label: '后伸', value: 'extension' },
    { label: '左侧屈', value: 'left-lateral-flexion' },
    { label: '右侧屈', value: 'right-lateral-flexion' },
  ],
  elbow: [
    { label: '前屈', value: 'flexion' },
    { label: '后伸', value: 'extension' },
  ],
  wrist: [
    { label: '前屈', value: 'flexion' },
    { label: '后伸', value: 'extension' },
    { label: '尺偏', value: 'ulnar-deviation' },
    { label: '桡偏', value: 'radial-deviation' },
  ],
  hip: [
    { label: '前屈', value: 'flexion' },
    { label: '后伸', value: 'extension' },
    { label: '外展', value: 'abduction' },
    { label: '内收', value: 'adduction' },
  ],
  knee: [
    { label: '前屈', value: 'flexion' },
  ],
  ankle: [
    { label: '背屈', value: 'dorsiflexion' },
    { label: '跖屈', value: 'plantarflexion' },
  ],
};

export default function JointSelector() {
  const { 
    setSingleMeasurement, isMeasuring, activeMeasurements 
  } = useMeasurementStore();

  // Initialize state based on store or default
  // We want to persist the selection even if store updates, but initial state should match store
  const [localJoint, setLocalJoint] = useState<JointType>('cervical');
  const [localSide, setLocalSide] = useState<'left' | 'right'>('left');
  const [localDirection, setLocalDirection] = useState<MovementDirection>('flexion');

  // Sync local state with store on mount (if store has a measurement)
  useEffect(() => {
    if (activeMeasurements.length > 0) {
      const current = activeMeasurements[0];
      setLocalJoint(current.joint);
      if (current.side) setLocalSide(current.side);
      setLocalDirection(current.direction);
    }
  }, []); // Run only on mount

  // Helper to check if side is needed
  const isSpinal = localJoint === 'cervical' || localJoint === 'thoracolumbar';

  // Helper to get sideToSave logic
  const getSideToSave = (joint: JointType, dir: MovementDirection, side: 'left' | 'right'): 'left' | 'right' | null => {
    const isSpinalJoint = joint === 'cervical' || joint === 'thoracolumbar';
    if (isSpinalJoint && (dir === 'flexion' || dir === 'extension')) {
      return null;
    }
    return side;
  };

  // Logic to filter directions based on side/joint
  const getDisplayOptions = () => {
    const rawDirs = DIRECTIONS[localJoint] || [];
    
    if (!isSpinal) return rawDirs;

    // For spinal joints, we consolidate Left/Right Rotation/Lateral Flexion
    const baseMotions = [];
    
    const hasFlex = rawDirs.find(d => d.value === 'flexion');
    if (hasFlex) baseMotions.push(hasFlex);
    
    const hasExt = rawDirs.find(d => d.value === 'extension');
    if (hasExt) baseMotions.push(hasExt);
    
    const hasRot = rawDirs.some(d => d.value.includes('rotation'));
    if (hasRot) {
      baseMotions.push({ label: '旋转', value: 'rotation' });
    }
    
    const hasLat = rawDirs.some(d => d.value.includes('lateral-flexion'));
    if (hasLat) {
      baseMotions.push({ label: '侧屈', value: 'lateral-flexion' });
    }
    
    return baseMotions;
  };

  const isSideDisabled = () => {
    if (isSpinal) {
      return localDirection === 'flexion' || localDirection === 'extension';
    }
    return false;
  };

  const getDirectionSelectValue = () => {
    if (isSpinal) {
      if (localDirection.includes('rotation')) return 'rotation';
      if (localDirection.includes('lateral-flexion')) return 'lateral-flexion';
    }
    return localDirection;
  };

  // Handlers
  const handleJointChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newJoint = e.target.value as JointType;
    setLocalJoint(newJoint);

    // Determine default direction for new joint
    let newDirection = 'flexion' as MovementDirection;
    const isNewSpinal = newJoint === 'cervical' || newJoint === 'thoracolumbar';
    
    if (isNewSpinal) {
      newDirection = 'flexion';
    } else {
      const firstDir = DIRECTIONS[newJoint]?.[0]?.value;
      if (firstDir) newDirection = firstDir;
    }
    
    setLocalDirection(newDirection);

    // Update store immediately
    const sideToSave = getSideToSave(newJoint, newDirection, localSide);
    setSingleMeasurement(newJoint, newDirection, sideToSave);
  };

  const handleSideChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSide = e.target.value as 'left' | 'right';
    setLocalSide(newSide);

    // If spinal and rotation/lateral-flexion, update direction value (e.g. left-rotation -> right-rotation)
    let newDirection = localDirection;
    if (isSpinal) {
      if (localDirection.includes('rotation')) {
        newDirection = newSide === 'left' ? 'left-rotation' : 'right-rotation';
      } else if (localDirection.includes('lateral-flexion')) {
        newDirection = newSide === 'left' ? 'left-lateral-flexion' : 'right-lateral-flexion';
      }
    }
    
    if (newDirection !== localDirection) {
      setLocalDirection(newDirection);
    }

    // Update store immediately
    const sideToSave = getSideToSave(localJoint, newDirection, newSide);
    setSingleMeasurement(localJoint, newDirection, sideToSave);
  };

  const handleDirectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    let newDirection = val as MovementDirection;

    if (isSpinal) {
      if (val === 'rotation') {
        newDirection = localSide === 'left' ? 'left-rotation' : 'right-rotation';
      } else if (val === 'lateral-flexion') {
        newDirection = localSide === 'left' ? 'left-lateral-flexion' : 'right-lateral-flexion';
      }
    }
    
    setLocalDirection(newDirection);

    // Update store immediately
    const sideToSave = getSideToSave(localJoint, newDirection, localSide);
    setSingleMeasurement(localJoint, newDirection, sideToSave);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">测量设置</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">关节部位</label>
          <select
            value={localJoint}
            onChange={handleJointChange}
            disabled={isMeasuring}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
          >
            {JOINTS.map(j => (
              <option key={j.value} value={j.value}>{j.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">侧别</label>
          <select
            value={localSide}
            onChange={handleSideChange}
            disabled={isMeasuring || isSideDisabled()}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="left">左侧</option>
            <option value="right">右侧</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">运动方向</label>
          <select
            value={getDirectionSelectValue()}
            onChange={handleDirectionChange}
            disabled={isMeasuring}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          >
            {getDisplayOptions().map((d, idx) => (
              <option key={d.value || idx} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
