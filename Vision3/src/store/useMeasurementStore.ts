import { create } from 'zustand';
import { JointType, MovementDirection } from '../utils/pose-calculations';

export interface MeasurementDataPoint {
  timestamp: number;
  angle: number;
}

export interface ActiveMeasurement {
  id: string;
  joint: JointType;
  direction: MovementDirection;
  side: 'left' | 'right' | null;
  currentAngle: number;
  maxAngle: number;
  minAngle: number;
  maxAngleImage?: string; // Image data URL at max angle
  data: MeasurementDataPoint[];
  color: string;
}

interface MeasurementState {
  activeMeasurements: ActiveMeasurement[];
  isMeasuring: boolean;
  startTime: number | null;
  savedMeasurements: Array<{
    id: string;
    date: number;
    measurements: ActiveMeasurement[];
  }>;

  // Actions
  addMeasurement: (joint: JointType, direction: MovementDirection, side: 'left' | 'right' | null) => void;
  removeMeasurement: (id: string) => void;
  updateMeasurementData: (id: string, angle: number, imageUrl?: string) => void;
  setSingleMeasurement: (joint: JointType, direction: MovementDirection, side: 'left' | 'right' | null) => void;
  startMeasurement: () => void;
  stopMeasurement: () => void;
  resetMeasurement: () => void;
  saveMeasurement: () => void;
  deleteSavedMeasurement: (id: string) => void;
}

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#db2777'];

export const useMeasurementStore = create<MeasurementState>((set, get) => ({
  activeMeasurements: [{
    id: 'default-single',
    joint: 'cervical',
    direction: 'flexion',
    side: null,
    currentAngle: 0,
    maxAngle: -Infinity,
    minAngle: Infinity,
    data: [],
    color: COLORS[0]
  }],
  isMeasuring: false,
  startTime: null,
  savedMeasurements: [],

  addMeasurement: (joint, direction, side) => set((state) => {
    // Check if already exists to prevent duplicates (optional, but good UX)
    const exists = state.activeMeasurements.some(
      m => m.joint === joint && m.direction === direction && m.side === side
    );
    if (exists) return state;

    const newMeasurement: ActiveMeasurement = {
      id: crypto.randomUUID(),
      joint,
      direction,
      side,
      currentAngle: 0,
      maxAngle: -Infinity,
      minAngle: Infinity,
      data: [],
      color: COLORS[state.activeMeasurements.length % COLORS.length]
    };

    return { activeMeasurements: [...state.activeMeasurements, newMeasurement] };
  }),

  removeMeasurement: (id) => set((state) => ({
    activeMeasurements: state.activeMeasurements.filter(m => m.id !== id)
  })),

  setSingleMeasurement: (joint, direction, side) => set(() => ({
    activeMeasurements: [{
      id: 'default-single',
      joint,
      direction,
      side,
      currentAngle: 0,
      maxAngle: -Infinity,
      minAngle: Infinity,
      data: [],
      color: COLORS[0]
    }]
  })),

  updateMeasurementData: (id, angle, imageUrl) => {
    const { isMeasuring, startTime, activeMeasurements } = get();
    
    // Always update current angle
    const measurementIndex = activeMeasurements.findIndex(m => m.id === id);
    if (measurementIndex === -1) return;

    const measurement = activeMeasurements[measurementIndex];
    const newMeasurement = { ...measurement, currentAngle: angle };

    // If measuring, update history and max/min
    if (isMeasuring && startTime) {
      const currentTime = Date.now();
      const time = (currentTime - startTime) / 1000;
      
      newMeasurement.data = [...measurement.data, { timestamp: time, angle }];
      
      if (angle > measurement.maxAngle) {
        newMeasurement.maxAngle = angle;
        if (imageUrl) {
          newMeasurement.maxAngleImage = imageUrl;
        }
      }
      
      newMeasurement.minAngle = Math.min(measurement.minAngle, angle);
    }

    const newMeasurements = [...activeMeasurements];
    newMeasurements[measurementIndex] = newMeasurement;
    
    set({ activeMeasurements: newMeasurements });
  },

  startMeasurement: () => set((state) => ({ 
    isMeasuring: true, 
    startTime: Date.now(),
    activeMeasurements: state.activeMeasurements.map(m => ({
      ...m,
      data: [],
      maxAngle: -Infinity,
      minAngle: Infinity
    }))
  })),

  stopMeasurement: () => set({ isMeasuring: false }),

  resetMeasurement: () => set((state) => ({ 
    isMeasuring: false,
    startTime: null,
    activeMeasurements: state.activeMeasurements.map(m => ({
      ...m,
      data: [],
      maxAngle: -Infinity,
      minAngle: Infinity,
      currentAngle: 0
    }))
  })),

  saveMeasurement: () => {
    const { activeMeasurements } = get();
    if (activeMeasurements.length === 0) return;
    
    // Only save if there is data
    const hasData = activeMeasurements.some(m => m.data.length > 0);
    if (!hasData) return;

    const newSaved = {
      id: crypto.randomUUID(),
      date: Date.now(),
      measurements: JSON.parse(JSON.stringify(activeMeasurements)) // Deep clone
    };

    set(state => ({
      savedMeasurements: [newSaved, ...state.savedMeasurements]
    }));
  },

  deleteSavedMeasurement: (id) => set((state) => ({
    savedMeasurements: state.savedMeasurements.filter(m => m.id !== id)
  }))
}));
