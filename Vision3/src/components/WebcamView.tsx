import { useEffect, useRef, useCallback, useState } from 'react';
import Webcam from 'react-webcam';
import { Pose, Results, POSE_CONNECTIONS } from '@mediapipe/pose';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { Camera } from '@mediapipe/camera_utils';
import { Video, VideoOff } from 'lucide-react';
import { useMeasurementStore } from '@/store/useMeasurementStore';
import { calculateJointAngle } from '@/utils/pose-calculations';

const JOINT_NAMES: Record<string, string> = {
  'cervical': '颈椎',
  'shoulder': '肩关节',
  'thoracolumbar': '胸腰椎',
  'wrist': '腕关节',
  'ankle': '踝关节',
  'hip': '髋关节',
  'knee': '膝关节',
  'elbow': '肘关节'
};

const DIRECTION_NAMES: Record<string, string> = {
  'flexion': '前屈',
  'extension': '后伸',
  'abduction': '外展',
  'adduction': '内收',
  'internal-rotation': '内旋',
  'external-rotation': '外旋',
  'left-rotation': '左旋',
  'right-rotation': '右旋',
  'left-lateral-flexion': '左侧屈',
  'right-lateral-flexion': '右侧屈',
  'ulnar-deviation': '尺偏',
  'radial-deviation': '桡偏',
  'dorsiflexion': '背伸',
  'plantarflexion': '跖屈'
};

const SIDE_NAMES: Record<string, string> = {
  'left': '左',
  'right': '右'
};

export default function WebcamView() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<Pose | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(() => {
    const saved = localStorage.getItem('vision3_camera_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('vision3_camera_enabled', String(isCameraOn));
    
    // Clear canvas when camera is turned off
    if (!isCameraOn && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    }
  }, [isCameraOn]);
  
  // We subscribe to activeMeasurements to render the HTML overlay
  const { activeMeasurements, updateMeasurementData } = useMeasurementStore();

  const onResults = useCallback((results: Results) => {
    const canvas = canvasRef.current;
    const video = webcamRef.current?.video;
    
    if (!canvas || !video || !results.poseLandmarks) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    
    // Draw video frame
    // Since we are mirroring, we scale the x-axis by -1 and translate by width
    // But drawImage(img, x, y, w, h)
    // To mirror: translate(width, 0) scale(-1, 1) drawImage(img, 0, 0, width, height)
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(results.image, 0, 0, width, height);
    
    // Restore context to draw landmarks normally (since landmarks are already mirrored manually below)
    // Wait, if we restore, we are back to normal coordinates.
    // The manual mirroring logic is: x = 1 - x.
    // This assumes 0..1 range.
    // If we draw landmarks on normal context, x=0 is left.
    // Mirrored landmark x=0 (was right in camera frame) should be drawn at left.
    // So yes, we restore context and draw manually mirrored landmarks.
    ctx.restore();
    
    ctx.save(); // Save again for potential other transforms or just to be safe
    // ctx.clearRect(0, 0, width, height); // No longer needed as we draw image over it

    // Create mirrored landmarks for display to match mirrored video
    const mirroredLandmarks = results.poseLandmarks.map(lm => ({
      ...lm,
      x: 1 - lm.x
    }));

    // Create mirrored World Landmarks (if available)
    let mirroredWorldLandmarks: any[] | undefined;
    if (results.poseWorldLandmarks) {
        mirroredWorldLandmarks = results.poseWorldLandmarks.map(lm => ({
            ...lm,
            x: -lm.x // Mirror X axis for world coordinates
        }));
    }
    
    // Draw landmarks
    drawConnectors(ctx, mirroredLandmarks, POSE_CONNECTIONS,
                   { color: '#00FF00', lineWidth: 4 });
    drawLandmarks(ctx, mirroredLandmarks,
                  { color: '#FF0000', lineWidth: 2 });

    const storeState = useMeasurementStore.getState();
    const currentMeasurements = storeState.activeMeasurements;
    const isMeasuring = storeState.isMeasuring;

    currentMeasurements.forEach(measurement => {
      // Calculate angle using mirrored landmarks
      const angle = calculateJointAngle(
        measurement.joint,
        measurement.direction,
        mirroredLandmarks,
        width,
        height,
        measurement.side || undefined,
        mirroredWorldLandmarks
      );

      if (angle !== null) {
        // Draw angle on canvas
        // Find a relevant landmark to place the text near
        // For simplicity, let's use the first landmark involved or just the center of the image if we can't easily find it
        // Or better, use the landmark corresponding to the joint center.
        // But since we don't have the joint index easily available here without re-importing constants, 
        // let's just draw it at the top left for now or near the center of the body.
        // Actually, we can just draw it.
        
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        
        // Let's put it near the joint if possible, but for now let's just put it in a fixed position if we don't have coordinates easily.
        // But we DO have landmarks. We just need to know which one. 
        // The angle calculation already knows. 
        // For now, let's skip complex positioning and focus on functionality. 
        // We will rely on the HTML overlay for the live view, but for the screenshot, we want it burnt in.
        
        // If this is a new max angle, capture it.
        let imageUrl: string | undefined;
        if (isMeasuring && angle > measurement.maxAngle) {
             // Draw angle on canvas before capturing
             // We'll draw it at a somewhat fixed position relative to the body center (e.g. nose or hip mid)
             // or just at the top right corner.
             ctx.strokeText(`${angle.toFixed(1)}°`, 50, 50 + currentMeasurements.indexOf(measurement) * 40);
             ctx.fillText(`${angle.toFixed(1)}°`, 50, 50 + currentMeasurements.indexOf(measurement) * 40);
             
             imageUrl = canvas.toDataURL('image/jpeg', 0.8);
        }

        updateMeasurementData(measurement.id, angle, imageUrl);
      }
    });

    ctx.restore();
  }, [updateMeasurementData]);

  useEffect(() => {
    const pose = new Pose({locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }});

    pose.setOptions({
      modelComplexity: 2,
      smoothLandmarks: true,
      enableSegmentation: true,
      smoothSegmentation: true,
      minDetectionConfidence: 0.75,
      minTrackingConfidence: 0.75
    });

    poseRef.current = pose;

    let camera: Camera | null = null;
    
    // Wait for video to be ready
    const interval = setInterval(() => {
      if (webcamRef.current && webcamRef.current.video) {
        camera = new Camera(webcamRef.current.video, {
          onFrame: async () => {
            if (webcamRef.current?.video && poseRef.current) {
              await poseRef.current.send({image: webcamRef.current.video});
            }
          },
          width: 1280,
          height: 720
        });
        camera.start();
        clearInterval(interval);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      pose.close();
      // camera?.stop();
    };
  }, []);

  // Update callback when it changes
  useEffect(() => {
    if (poseRef.current) {
      poseRef.current.onResults(onResults);
    }
  }, [onResults]);

  return (
    <div className="relative bg-black rounded-lg overflow-hidden shadow-lg aspect-video">
      {isCameraOn ? (
        <Webcam
            ref={webcamRef}
            className="absolute inset-0 w-full h-full object-cover"
            mirrored={true}
            audio={false}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white z-10">
            <VideoOff className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-gray-400 text-lg">摄像头已关闭</p>
            <button 
                onClick={() => setIsCameraOn(true)}
                className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-medium transition-colors cursor-pointer"
            >
                开启摄像头
            </button>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
      
      {/* Overlay info - Loop through active measurements */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
        {activeMeasurements.map((m) => (
          <div 
            key={m.id}
            className="bg-black/60 px-4 py-2 rounded-md shadow backdrop-blur-sm"
          >
            <p className="text-xs font-medium text-gray-200">
              {JOINT_NAMES[m.joint] || m.joint} {m.side ? `(${SIDE_NAMES[m.side] || m.side})` : ''} - {DIRECTION_NAMES[m.direction] || m.direction}
            </p>
            <p className="text-3xl font-bold text-white drop-shadow-md">
              {m.currentAngle.toFixed(1)}°
            </p>
          </div>
        ))}
        {activeMeasurements.length === 0 && (
            <div className="bg-white/80 px-4 py-2 rounded-md shadow backdrop-blur-sm">
                <p className="text-sm text-gray-500">请添加测量项</p>
            </div>
        )}
      </div>

      <button
        onClick={() => setIsCameraOn(!isCameraOn)}
        className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors backdrop-blur-sm pointer-events-auto"
        title={isCameraOn ? "关闭摄像头" : "打开摄像头"}
      >
        {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
      </button>
    </div>
  );
}
