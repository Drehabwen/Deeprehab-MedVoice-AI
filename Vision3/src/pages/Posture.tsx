import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Holistic, Results, POSE_CONNECTIONS, FACEMESH_TESSELATION } from '@mediapipe/holistic';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { Camera } from '@mediapipe/camera_utils';
import { Camera as CameraIcon, CheckCircle, AlertTriangle, User, Play, RefreshCw, FileDown, Video, VideoOff } from 'lucide-react';
import { analyzePosture, PostureIssue, PostureMetrics, getPostureReferenceLines, ReferenceLine } from '@/utils/posture-analysis';
import { cn } from '@/lib/utils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

export default function Posture() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holisticRef = useRef<Holistic | null>(null);
  const [view, setView] = useState<'front' | 'back' | 'side'>('front');
  const [isCameraOn, setIsCameraOn] = useState(() => {
    const saved = localStorage.getItem('vision3_camera_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('vision3_camera_enabled', String(isCameraOn));
    
    // Clear canvas and stop video tracks when camera is turned off
    if (!isCameraOn) {
        if (webcamRef.current && webcamRef.current.video) {
            const stream = webcamRef.current.video.srcObject as MediaStream;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        }
    }
  }, [isCameraOn]);

  const [result, setResult] = useState<{ issues: PostureIssue[]; metrics: PostureMetrics; image: string } | null>(null);
  const [landmarks, setLandmarks] = useState<any[] | null>(null);
  
  // Auto-capture states
  const [captureStatus, setCaptureStatus] = useState<'idle' | 'scanning' | 'countdown'>('idle');
  const [countdown, setCountdown] = useState(3);
  const [isInPosition, setIsInPosition] = useState(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // We need to keep track of latest landmarks for snapshot
  const latestLandmarksRef = useRef<any[] | null>(null);
  // Buffer for smoothing landmarks over time
  const landmarksBufferRef = useRef<any[][]>([]);
  const faceLandmarksBufferRef = useRef<any[][]>([]);

  // Define reference box (normalized coordinates 0-1)
  const BOX = {
    xMin: 0.25,
    xMax: 0.75,
    yMin: 0.1,
    yMax: 0.9
  };

  const checkUserPosition = (landmarks: any[]) => {
    if (!landmarks || landmarks.length < 33) return false;

    // Check visibility of key points (Nose, Shoulders, Hips, Ankles)
    const keyPointsIndices = [0, 11, 12, 23, 24, 27, 28];
    const visible = keyPointsIndices.every(idx => landmarks[idx].visibility > 0.6);
    if (!visible) return false;

    // Check bounds
    const nose = landmarks[0];
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    const inX = 
      nose.x > BOX.xMin && nose.x < BOX.xMax &&
      leftShoulder.x > BOX.xMin && rightShoulder.x < BOX.xMax;
      
    const inY = 
      nose.y > BOX.yMin && nose.y < 0.4 && // Head in upper section
      leftAnkle.y > 0.6 && leftAnkle.y < BOX.yMax; // Feet in lower section

    return inX && inY;
  };

  const drawResultCanvas = (
    imageSrc: string, 
    landmarks: any[], 
    issues: PostureIssue[], 
    referenceLines: ReferenceLine[], 
    headPoseAxes?: any[]
  ) => {
      const img = new Image();
      img.src = imageSrc;
      img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;

          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // Draw original image
          ctx.save();
          if (view === 'front') {
              ctx.translate(canvas.width, 0);
              ctx.scale(-1, 1);
          }
          ctx.drawImage(img, 0, 0);
          ctx.restore();

          // Draw Skeleton
          drawConnectors(ctx, landmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
          drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 3 });

          // Draw Standard Reference Lines (Top Layer - Blue/Dashed)
          referenceLines.forEach(line => {
              ctx.beginPath();
              ctx.strokeStyle = line.color;
              ctx.lineWidth = line.lineWidth || 2;
              if (line.dash) ctx.setLineDash(line.dash);
              else ctx.setLineDash([]);
              
              ctx.moveTo(line.from.x, line.from.y);
              ctx.lineTo(line.to.x, line.to.y);
              ctx.stroke();
              ctx.setLineDash([]);

              // Optional: Draw Label
              if (line.label) {
                  ctx.fillStyle = line.color;
                  ctx.font = '14px Arial';
                  ctx.fillText(line.label, line.to.x + 5, line.to.y);
              }
          });

          // Draw Head Pose Axes (if available)
          if (headPoseAxes && headPoseAxes.length === 4) {
              const axes = headPoseAxes;
              const origin = axes[0];
              const xAxis = axes[1];
              const yAxis = axes[2];
              const zAxis = axes[3];

              ctx.lineWidth = 3;

              // X-Axis (Red) - Right
              ctx.beginPath();
              ctx.strokeStyle = 'red';
              ctx.moveTo(origin.x, origin.y);
              ctx.lineTo(xAxis.x, xAxis.y);
              ctx.stroke();

              // Y-Axis (Green) - Down
              ctx.beginPath();
              ctx.strokeStyle = 'green';
              ctx.moveTo(origin.x, origin.y);
              ctx.lineTo(yAxis.x, yAxis.y);
              ctx.stroke();

              // Z-Axis (Blue) - Forward
              ctx.beginPath();
              ctx.strokeStyle = 'blue';
              ctx.moveTo(origin.x, origin.y);
              ctx.lineTo(zAxis.x, zAxis.y);
              ctx.stroke();
          }

          // Draw Reference Box
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 10]);
          ctx.strokeRect(
              BOX.xMin * canvas.width,
              BOX.yMin * canvas.height,
              (BOX.xMax - BOX.xMin) * canvas.width,
              (BOX.yMax - BOX.yMin) * canvas.height
          );
          ctx.setLineDash([]);

          // Draw Issues
          issues.forEach(issue => {
              // Draw Lines
              if (issue.lines) {
                  ctx.beginPath();
                  ctx.strokeStyle = 'red';
                  ctx.lineWidth = 4;
                  issue.lines.forEach(line => {
                      ctx.moveTo(line.from.x, line.from.y);
                      ctx.lineTo(line.to.x, line.to.y);
                      if (line.dash) {
                          ctx.save();
                          ctx.setLineDash(line.dash);
                          ctx.stroke();
                          ctx.restore();
                      } else {
                          ctx.stroke();
                      }
                  });
              }

              // Draw Points
              if (issue.points) {
                  ctx.fillStyle = 'red';
                  issue.points.forEach(point => {
                      ctx.beginPath();
                      ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
                      ctx.fill();
                  });
              }
          });
          
          // Update result image with annotations
          setResult(prev => prev ? { ...prev, image: canvas.toDataURL() } : null);
      };
  };

  const handleCapture = useCallback(() => {
    if (!webcamRef.current || landmarksBufferRef.current.length === 0) return;
    
    const imageSrc = webcamRef.current.getScreenshot();
    
    // Average landmarks from buffer for stability
    const buffer = landmarksBufferRef.current;
    if (buffer.length === 0) return;
    
    // Initialize with first frame
    const numLandmarks = buffer[0].length;
    const avgLandmarks = buffer[0].map(lm => ({ ...lm, x: 0, y: 0, z: 0, visibility: 0 }));
    
    // Sum up
    for (const frame of buffer) {
        frame.forEach((lm, idx) => {
            if (avgLandmarks[idx]) {
                avgLandmarks[idx].x += lm.x;
                avgLandmarks[idx].y += lm.y;
                avgLandmarks[idx].z += lm.z;
                avgLandmarks[idx].visibility += lm.visibility;
            }
        });
    }
    
    // Divide
    const count = buffer.length;
    let currentLandmarks = avgLandmarks.map(lm => ({
        x: lm.x / count,
        y: lm.y / count,
        z: lm.z / count,
        visibility: lm.visibility / count
    }));
    
    // Fix alignment for mirrored front view
    if (view === 'front') {
        currentLandmarks = currentLandmarks.map((lm: any) => ({
            ...lm,
            x: 1 - lm.x
        }));
    }
    
    // Analyze
    const video = webcamRef.current.video;
    if (video && imageSrc) {
        const { issues, metrics, headPoseAxes } = analyzePosture(
            view, 
            currentLandmarks, 
            video.videoWidth, 
            video.videoHeight
        );

        const refLines = getPostureReferenceLines(
            view,
            currentLandmarks,
            video.videoWidth,
            video.videoHeight
        );
        
        setResult({
            issues,
            metrics,
            image: imageSrc,
            // @ts-ignore
            headPoseAxes
        });
        setLandmarks(currentLandmarks);
        
        // Defer canvas drawing to allow state update or use temp variables
        setTimeout(() => drawResultCanvas(imageSrc, currentLandmarks, issues, refLines, headPoseAxes), 100);

        setCaptureStatus('idle'); // Reset status
        setIsInPosition(false);
    }
  }, [view]);

  const exportPDF = async () => {
    if (!result) return;
    const element = document.getElementById('posture-report');
    if (!element) return;

    // Temporarily show the element
    element.style.display = 'block';

    try {
      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`posture-analysis-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF generation failed', err);
      alert('导出PDF失败，请重试');
    } finally {
      element.style.display = 'none';
    }
  };

  const onResults = useCallback((results: Results) => {
    if (results.poseLandmarks) {
      latestLandmarksRef.current = results.poseLandmarks;
      
      // Update buffer
      landmarksBufferRef.current.push(results.poseLandmarks);
      if (results.faceLandmarks) {
          faceLandmarksBufferRef.current.push(results.faceLandmarks);
      }
      
      // Keep last 30 frames (~1 second)
      if (landmarksBufferRef.current.length > 30) {
          landmarksBufferRef.current.shift();
      }
      if (faceLandmarksBufferRef.current.length > 30) {
          faceLandmarksBufferRef.current.shift();
      }
      
      // Auto-capture logic
      if (captureStatus === 'scanning' || captureStatus === 'countdown') {
        const inPos = checkUserPosition(results.poseLandmarks);
        setIsInPosition(inPos);

        if (captureStatus === 'scanning' && inPos) {
           setCaptureStatus('countdown');
           setCountdown(3);
           // Clear buffer when starting countdown to ensure clean data for capture
           landmarksBufferRef.current = [];
           faceLandmarksBufferRef.current = [];
        } else if (captureStatus === 'countdown' && !inPos) {
           // User left position, reset
           setCaptureStatus('scanning');
           setCountdown(3);
        }
      }
    }
  }, [captureStatus]);

  // Countdown timer effect
  useEffect(() => {
    if (captureStatus === 'countdown') {
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!);
            handleCapture();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    }

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [captureStatus, handleCapture]);

  useEffect(() => {
    const holistic = new Holistic({locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
    }});

    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: true,
      refineFaceLandmarks: true, // Critical for precise eyes/iris
      minDetectionConfidence: 0.75,
      minTrackingConfidence: 0.75
    });

    holisticRef.current = holistic;
    
    return () => {
        holistic.close();
    };
  }, []);

  useEffect(() => {
      if (holisticRef.current) {
          holisticRef.current.onResults(onResults);
      }
  }, [onResults]);

  useEffect(() => {
    if (!isCameraOn) return;

    let camera: Camera | null = null;
    
    const interval = setInterval(() => {
        if (webcamRef.current && webcamRef.current.video && holisticRef.current) {
            camera = new Camera(webcamRef.current.video, {
                onFrame: async () => {
                    if (webcamRef.current?.video && holisticRef.current) {
                        await holisticRef.current.send({image: webcamRef.current.video});
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
        if (camera) camera.stop();
    };
  }, [isCameraOn]);

  const startScanning = () => {
    setResult(null);
    setCaptureStatus('scanning');
    setCountdown(3);
  };

  const resetAnalysis = () => {
      setResult(null);
      setLandmarks(null);
      setCaptureStatus('idle');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">静态体态评估</h1>
        <p className="text-gray-500">点击开始，站在虚线框内，系统将自动拍摄分析</p>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="flex space-x-4">
            {[
            { id: 'front', label: '正面' },
            { id: 'back', label: '背面' },
            { id: 'side', label: '侧面' }
            ].map((v) => (
            <button
                key={v.id}
                onClick={() => { setView(v.id as any); resetAnalysis(); }}
                className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                view === v.id 
                    ? "bg-blue-600 text-white" 
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                )}
            >
                {v.label}
            </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera/Image Area */}
        <div className="bg-black rounded-lg overflow-hidden shadow-lg aspect-video relative group">
          {!result ? (
            <>
              {isCameraOn ? (
                <Webcam
                  ref={webcamRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  mirrored={view === 'front'} 
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ width: 1280, height: 720 }}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white">
                    <VideoOff className="h-16 w-16 mb-4 opacity-30" />
                    <p className="text-gray-400 text-lg">摄像头已关闭</p>
                    <button 
                      onClick={() => setIsCameraOn(true)}
                      className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-medium transition-colors"
                    >
                      开启摄像头
                    </button>
                </div>
              )}
              
              {/* Reference Box Overlay */}
              {isCameraOn && captureStatus !== 'idle' && (
                  <div className={cn(
                      "absolute border-4 border-dashed rounded-lg transition-colors duration-300",
                      isInPosition ? "border-green-500 bg-green-500/10" : "border-white/50",
                      captureStatus === 'countdown' ? "border-solid border-blue-500" : ""
                  )}
                  style={{
                      left: `${BOX.xMin * 100}%`,
                      top: `${BOX.yMin * 100}%`,
                      width: `${(BOX.xMax - BOX.xMin) * 100}%`,
                      height: `${(BOX.yMax - BOX.yMin) * 100}%`
                  }}>
                      {/* Status Text inside Box */}
                      <div className="absolute inset-0 flex items-center justify-center">
                          {captureStatus === 'countdown' ? (
                              <span className="text-9xl font-bold text-white drop-shadow-lg animate-pulse">
                                  {countdown}
                              </span>
                          ) : (
                              !isInPosition && (
                                <div className="text-center bg-black/50 p-2 rounded backdrop-blur-sm">
                                    <User className="h-10 w-10 text-white mx-auto mb-2 opacity-50" />
                                    <p className="text-white font-medium">请站入框内</p>
                                </div>
                              )
                          )}
                      </div>
                  </div>
              )}

              {/* Controls Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-center">
                {isCameraOn && (captureStatus === 'idle' ? (
                    <button
                    onClick={startScanning}
                    className="flex items-center px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-lg shadow-lg transition-transform hover:scale-105 active:scale-95"
                    >
                    <Play className="h-6 w-6 mr-2" />
                    开始测量
                    </button>
                ) : (
                    <button
                    onClick={() => setCaptureStatus('idle')}
                    className="flex items-center px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-md transition-colors"
                    >
                    取消
                    </button>
                ))}
              </div>

              <button
                  onClick={() => setIsCameraOn(!isCameraOn)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors backdrop-blur-sm pointer-events-auto z-50"
                  title={isCameraOn ? "关闭摄像头" : "打开摄像头"}
              >
                  {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
            </>
          ) : (
            <div className="relative w-full h-full">
                <img src={result.image} alt="Analysis" className="w-full h-full object-cover" />
                <button
                    onClick={resetAnalysis}
                    className="absolute top-4 right-4 flex items-center bg-white/90 px-4 py-2 rounded-full text-sm font-medium hover:bg-white shadow-sm transition-colors"
                >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重新拍摄
                </button>
            </div>
          )}
        </div>

        {/* Results Area */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">分析结果</h3>
            {result && (
              <button
                onClick={exportPDF}
                className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <FileDown className="h-4 w-4 mr-1" />
                导出报告
              </button>
            )}
          </div>
          
          {!result ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
              <CameraIcon className="h-12 w-12 mb-3 opacity-20" />
              <p>点击“开始测量”并站在指示框内</p>
            </div>
          ) : (
            <div className="space-y-4">
              {result.issues.length === 0 ? (
                <div className="flex items-center p-4 bg-green-50 rounded-lg text-green-800 border border-green-100">
                  <CheckCircle className="h-6 w-6 mr-3 text-green-600" />
                  <div>
                    <p className="font-medium">未检测到明显体态问题</p>
                    <p className="text-sm mt-1">您的体态保持良好，请继续保持！</p>
                  </div>
                </div>
              ) : (
                result.issues.map((issue, index) => (
                  <div key={index} className={cn(
                    "p-4 rounded-lg border",
                    issue.severity === 'severe' ? "bg-red-50 border-red-200" :
                    issue.severity === 'moderate' ? "bg-orange-50 border-orange-200" :
                    "bg-yellow-50 border-yellow-200"
                  )}>
                    <div className="flex items-start">
                      <AlertTriangle className={cn(
                        "h-5 w-5 mr-3 mt-0.5",
                        issue.severity === 'severe' ? "text-red-600" :
                        issue.severity === 'moderate' ? "text-orange-600" :
                        "text-yellow-600"
                      )} />
                      <div>
                        <h4 className="font-medium text-gray-900">{issue.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{issue.description}</p>
                        <div className="mt-2 text-sm font-medium text-blue-800">
                          建议：{issue.recommendation}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Hidden Canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden Report Template for PDF Export */}
      {result && (
        <div 
          id="posture-report" 
          className="fixed left-[-9999px] top-0 bg-white p-8"
          style={{ width: '210mm', minHeight: '297mm' }}
        >
          {/* Header */}
          <div className="text-center border-b pb-6 mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">体态评估报告</h1>
            <p className="text-gray-500">评估日期: {new Date().toLocaleDateString()}</p>
          </div>

          {/* Content Grid */}
          <div className="space-y-8">
            {/* 1. Image Snapshot */}
            <div className="flex justify-center bg-black rounded-lg overflow-hidden h-[300px]">
               <img src={result.image} alt="Analysis Snapshot" className="h-full object-contain" />
            </div>

            {/* 2. Analysis Summary */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4 border-l-4 border-blue-600 pl-3">评估总结</h2>
              {result.issues.length === 0 ? (
                <div className="p-4 bg-green-50 text-green-800 rounded">
                   恭喜！您的体态保持良好，各项指标均在正常范围内。
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {result.issues.map((issue, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded border border-gray-200">
                       <div className="flex items-center mb-2">
                         <span className={cn(
                           "px-2 py-0.5 text-xs font-bold rounded uppercase mr-2",
                           issue.severity === 'severe' ? "bg-red-100 text-red-800" :
                           issue.severity === 'moderate' ? "bg-orange-100 text-orange-800" :
                           "bg-yellow-100 text-yellow-800"
                         )}>
                           {issue.severity === 'severe' ? '严重' : issue.severity === 'moderate' ? '中度' : '轻微'}
                         </span>
                         <h3 className="font-bold text-gray-900">{issue.title}</h3>
                       </div>
                       <p className="text-gray-600 text-sm mb-2">{issue.description}</p>
                       <p className="text-blue-700 text-sm font-medium">建议: {issue.recommendation}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Data Visualization (Trend/Standard Chart) */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4 border-l-4 border-blue-600 pl-3">数据指标分析</h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={
                      view === 'side' ? [
                        { name: '头前倾指数', value: result.metrics.headForward || 0, max: 0.25, label: '正常 < 0.25' },
                        { name: '圆肩指数', value: result.metrics.shoulderRounded || 0, max: 0.15, label: '正常 < 0.15' }
                      ] : [
                        { name: '肩部倾斜', value: Math.abs(result.metrics.shoulderAngle || 0), max: 3, label: '正常 < 3°' },
                        { name: '骨盆倾斜', value: Math.abs(result.metrics.hipAngle || 0), max: 3, label: '正常 < 3°' },
                        { name: '中线偏移', value: (result.metrics.headDeviation || 0) * 100, max: 10, label: '正常 < 10%' }
                      ]
                    }
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip 
                      cursor={{fill: 'transparent'}}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-2 border shadow text-sm">
                              <p>{data.name}: {data.value.toFixed(2)}</p>
                              <p className="text-gray-500">{data.label}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Bar dataKey="value" name="测量值" fill="#3b82f6" barSize={20} isAnimationActive={false}>
                      {
                        (view === 'side' ? [
                            { value: result.metrics.headForward || 0, max: 0.25 },
                            { value: result.metrics.shoulderRounded || 0, max: 0.15 },
                            { value: Math.abs(result.metrics.headPitch || 0), max: 15 }
                          ] : [
                            { value: Math.abs(result.metrics.shoulderAngle || 0), max: 3 },
                            { value: Math.abs(result.metrics.hipAngle || 0), max: 3 },
                            { value: (result.metrics.headDeviation || 0) * 100, max: 10 },
                            { value: Math.abs(result.metrics.headYaw || 0), max: 15 },
                            { value: Math.abs(result.metrics.headRoll || 0), max: 10 }
                          ]).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.value > entry.max ? '#ef4444' : '#22c55e'} />
                        ))
                      }
                    </Bar>
                    <Bar dataKey="max" name="参考上限" fill="#9ca3af" barSize={20} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">* 绿色表示正常范围，红色表示超出参考标准</p>
            </div>
            
            {/* Footer */}
            <div className="border-t pt-4 mt-8 text-center text-sm text-gray-400">
               <p>Vision3 AI Posture Analysis System</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}