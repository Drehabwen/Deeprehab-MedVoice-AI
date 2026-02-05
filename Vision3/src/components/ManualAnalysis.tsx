import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Save, MousePointer2, Move, Pen, Type, Circle, ArrowRight, Eraser, ZoomIn, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import html2canvas from 'html2canvas';

// Types
export type ToolType = 'select' | 'goniometer-3' | 'goniometer-4' | 'pen' | 'arrow' | 'circle' | 'text';

interface Point {
  x: number;
  y: number;
}

interface GoniometerState {
  type: '3-point' | '4-point';
  points: Point[]; // 3 or 4 points
}

interface Annotation {
  id: string;
  type: 'path' | 'arrow' | 'circle' | 'text';
  points?: Point[]; // For path, arrow
  center?: Point; // For circle
  radius?: number; // For circle
  text?: string; // For text
  position?: Point; // For text
  color: string;
  width: number;
}

interface ManualAnalysisProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (annotatedImage: string) => void;
  initialLandmarks?: any[]; // For snapping (future)
}

export default function ManualAnalysis({ imageUrl, onClose, onSave }: ManualAnalysisProps) {
  const [activeTool, setActiveTool] = useState<ToolType>('goniometer-3');
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [magnifierPos, setMagnifierPos] = useState({ x: 0, y: 0 });
  const [magnifierContent, setMagnifierContent] = useState<string>('');
  
  // Goniometer State
  const [goniometer, setGoniometer] = useState<GoniometerState | null>(null);
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  // Annotations State
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize Goniometer
  useEffect(() => {
    if (imageSize && !goniometer) {
      // Default center position
      const cx = imageSize.width / 2;
      const cy = imageSize.height / 2;
      setGoniometer({
        type: '3-point',
        points: [
          { x: cx - 100, y: cy - 50 }, // Fixed arm
          { x: cx, y: cy },           // Vertex
          { x: cx - 100, y: cy + 50 }  // Moving arm
        ]
      });
    }
  }, [imageSize]);

  // Handle Image Load
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setImageSize({ width: naturalWidth, height: naturalHeight });
  };

  // Helper: Convert screen coords to image coords
  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!imageRef.current || !imageSize) return { x: 0, y: 0 };
    
    const rect = imageRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const x = (clientX - rect.left) * (imageSize.width / rect.width);
    const y = (clientY - rect.top) * (imageSize.height / rect.height);
    
    return { x, y };
  };

  // Interaction Handlers
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent, pointIndex?: number) => {
    if (!imageSize) return;
    const pos = getMousePos(e);
    
    if (activeTool === 'pen' || activeTool === 'arrow' || activeTool === 'circle') {
      setIsDrawing(true);
      setCurrentPath([pos]); // For pen, arrow (start), circle (center)
    } else if (activeTool === 'text') {
       const text = prompt("请输入标注文字:", "异常点");
       if (text) {
         setAnnotations(prev => [...prev, {
            id: crypto.randomUUID(),
            type: 'text',
            text,
            position: pos,
            color: '#ef4444',
            width: 16
         }]);
       }
    } else if (pointIndex !== undefined) {
      setActivePointIndex(pointIndex);
      setShowMagnifier(true);
      updateMagnifier(pos);
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getMousePos(e);
    
    if (isDrawing) {
      if (activeTool === 'pen') {
         setCurrentPath(prev => [...prev, pos]);
      } else if (activeTool === 'arrow' || activeTool === 'circle') {
         // Update end point dynamically
         setCurrentPath(prev => [prev[0], pos]);
      }
    } else if (activePointIndex !== null && goniometer) {
      const newPoints = [...goniometer.points];
      newPoints[activePointIndex] = pos;
      setGoniometer({ ...goniometer, points: newPoints });
      updateMagnifier(pos);
      setMagnifierPos({ x: ('touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX), y: ('touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY) });
    }
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    if (currentPath.length > 0) {
      if (activeTool === 'pen') {
          setAnnotations(prev => [...prev, {
            id: crypto.randomUUID(),
            type: 'path',
            points: currentPath,
            color: '#ef4444',
            width: 3
          }]);
      } else if (activeTool === 'arrow' && currentPath.length >= 2) {
          setAnnotations(prev => [...prev, {
            id: crypto.randomUUID(),
            type: 'arrow',
            points: [currentPath[0], currentPath[currentPath.length-1]],
            color: '#ef4444',
            width: 3
          }]);
      } else if (activeTool === 'circle' && currentPath.length >= 2) {
          const center = currentPath[0];
          const edge = currentPath[currentPath.length-1];
          const radius = Math.sqrt(Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2));
          setAnnotations(prev => [...prev, {
            id: crypto.randomUUID(),
            type: 'circle',
            center,
            radius,
            color: '#ef4444',
            width: 3
          }]);
      }
      setCurrentPath([]);
    }
    
    setActivePointIndex(null);
    setShowMagnifier(false);
  };

  // Magnifier Logic
  const updateMagnifier = (pos: Point) => {
    if (!imageRef.current || !magnifierCanvasRef.current || !imageSize) return;
    
    const canvas = magnifierCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw source image section
    // Source: pos.x - 25, pos.y - 25 (50x50 area)
    // Dest: 0, 0, 150, 150 (3x zoom)
    const zoomLevel = 3;
    const sourceSize = 50;
    const destSize = 150;
    
    ctx.drawImage(
      imageRef.current,
      pos.x - sourceSize/2, pos.y - sourceSize/2, sourceSize, sourceSize,
      0, 0, destSize, destSize
    );
    
    // Draw crosshair
    ctx.strokeStyle = 'rgba(255,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(destSize/2, 0);
    ctx.lineTo(destSize/2, destSize);
    ctx.moveTo(0, destSize/2);
    ctx.lineTo(destSize, destSize/2);
    ctx.stroke();
  };

  // Calculation
  const angle = useMemo(() => {
    if (!goniometer || goniometer.points.length < 3) return 0;
    
    const calculateAngle = (a: Point, b: Point, c: Point) => {
      const ang = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
      let deg = Math.abs(ang * 180 / Math.PI);
      if (deg > 180) deg = 360 - deg;
      return deg;
    };

    if (goniometer.type === '3-point') {
      const [a, b, c] = goniometer.points;
      return calculateAngle(a, b, c);
    } else {
      // 4-point: Angle between AB and CD
      const [a, b, c, d] = goniometer.points;
      const v1 = { x: b.x - a.x, y: b.y - a.y };
      const v2 = { x: d.x - c.x, y: d.y - c.y };
      const ang = Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x);
      let deg = Math.abs(ang * 180 / Math.PI);
      if (deg > 180) deg = 360 - deg;
      return deg;
    }
  }, [goniometer]);

  // Handle Save
  const handleSave = async () => {
    if (!containerRef.current) return;
    try {
      // Hide controls for screenshot? No, we want the overlay.
      // But we probably don't want the UI buttons.
      // The containerRef should target the wrapper of the image and overlay.
      
      const element = document.getElementById('manual-analysis-canvas');
      if (!element) return;
      
      const canvas = await html2canvas(element, { useCORS: true, scale: 2 });
      onSave(canvas.toDataURL('image/jpeg'));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-xl font-bold">手动测量与标注</h2>
        <div className="flex gap-2">
          <button onClick={handleSave} className="flex items-center px-4 py-2 bg-blue-600 rounded hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" /> 保存
          </button>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Toolbar */}
        <div className="w-16 bg-zinc-900 border-r border-white/10 flex flex-col items-center py-4 gap-4">
          <ToolButton 
            active={activeTool === 'goniometer-3'} 
            onClick={() => { setActiveTool('goniometer-3'); setGoniometer(prev => ({ type: '3-point', points: prev?.points.slice(0,3) || [] })) }}
            icon={<RotateCcw className="w-5 h-5" />}
            label="三点量角"
          />
          <ToolButton 
            active={activeTool === 'goniometer-4'} 
            onClick={() => { setActiveTool('goniometer-4'); setGoniometer(prev => ({ type: '4-point', points: prev?.points.length === 4 ? prev.points : [...(prev?.points.slice(0,3) || []), {x: 100, y: 100}] })) }}
            icon={<Move className="w-5 h-5" />}
            label="四点量角"
          />
          <div className="w-8 h-px bg-white/10 my-2" />
          <ToolButton 
            active={activeTool === 'pen'} 
            onClick={() => setActiveTool('pen')}
            icon={<Pen className="w-5 h-5" />}
            label="画笔"
          />
          <ToolButton 
            active={activeTool === 'arrow'} 
            onClick={() => setActiveTool('arrow')}
            icon={<ArrowRight className="w-5 h-5" />}
            label="箭头"
          />
          <ToolButton 
            active={activeTool === 'text'} 
            onClick={() => setActiveTool('text')}
            icon={<Type className="w-5 h-5" />}
            label="文字"
          />
           <div className="w-8 h-px bg-white/10 my-2" />
           <button 
             onClick={() => setAnnotations([])}
             className="p-3 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
             title="清除标注"
           >
             <Eraser className="w-5 h-5" />
           </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-black relative p-8" ref={containerRef}>
            
            <div 
              id="manual-analysis-canvas"
              className="relative shadow-2xl" 
              style={{ 
                width: imageSize ? imageSize.width * zoom : 'auto',
                height: imageSize ? imageSize.height * zoom : 'auto',
                maxWidth: '100%',
                maxHeight: '100%'
              }}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <img 
                ref={imageRef}
                src={imageUrl} 
                onLoad={onImageLoad}
                className="w-full h-full object-contain pointer-events-none select-none"
                alt="Analysis Target"
              />
              
              {/* SVG Overlay for Goniometer & Shapes */}
              {imageSize && (
                <svg 
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                >
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                    </marker>
                  </defs>

                  {/* Annotations */}
                  {annotations.map(ann => {
                    if (ann.type === 'path' && ann.points) {
                      return (
                        <polyline 
                          key={ann.id}
                          points={ann.points.map(p => `${p.x},${p.y}`).join(' ')}
                          fill="none"
                          stroke={ann.color}
                          strokeWidth={ann.width}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      );
                    } else if (ann.type === 'arrow' && ann.points) {
                       return (
                         <line
                           key={ann.id}
                           x1={ann.points[0].x} y1={ann.points[0].y}
                           x2={ann.points[1].x} y2={ann.points[1].y}
                           stroke={ann.color}
                           strokeWidth={ann.width}
                           markerEnd="url(#arrowhead)"
                         />
                       );
                    } else if (ann.type === 'circle' && ann.center && ann.radius) {
                       return (
                         <circle
                           key={ann.id}
                           cx={ann.center.x} cy={ann.center.y}
                           r={ann.radius}
                           fill="none"
                           stroke={ann.color}
                           strokeWidth={ann.width}
                         />
                       );
                    } else if (ann.type === 'text' && ann.text && ann.position) {
                       return (
                         <text
                           key={ann.id}
                           x={ann.position.x} y={ann.position.y}
                           fill={ann.color}
                           fontSize={ann.width * 2}
                           fontWeight="bold"
                           textAnchor="middle"
                         >
                           {ann.text}
                         </text>
                       );
                    }
                    return null;
                  })}
                  
                  {/* Current Drawing Preview */}
                  {currentPath.length > 0 && activeTool === 'pen' && (
                     <polyline 
                       points={currentPath.map(p => `${p.x},${p.y}`).join(' ')}
                       fill="none"
                       stroke="#ef4444"
                       strokeWidth={3}
                       strokeLinecap="round"
                       strokeLinejoin="round"
                     />
                  )}
                  {currentPath.length >= 2 && activeTool === 'arrow' && (
                      <line
                        x1={currentPath[0].x} y1={currentPath[0].y}
                        x2={currentPath[currentPath.length-1].x} y2={currentPath[currentPath.length-1].y}
                        stroke="#ef4444"
                        strokeWidth={3}
                        markerEnd="url(#arrowhead)"
                      />
                  )}
                  {currentPath.length >= 2 && activeTool === 'circle' && (
                      <circle
                        cx={currentPath[0].x} cy={currentPath[0].y}
                        r={Math.sqrt(Math.pow(currentPath[currentPath.length-1].x - currentPath[0].x, 2) + Math.pow(currentPath[currentPath.length-1].y - currentPath[0].y, 2))}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth={3}
                      />
                  )}

                  {/* Goniometer Lines */}
                  {goniometer && (
                    <>
                      {goniometer.type === '3-point' && goniometer.points.length === 3 && (
                        <>
                          {/* Arm 1 */}
                          <line 
                            x1={goniometer.points[0].x} y1={goniometer.points[0].y}
                            x2={goniometer.points[1].x} y2={goniometer.points[1].y}
                            stroke="rgba(255, 255, 255, 0.8)"
                            strokeWidth="4"
                          />
                          {/* Arm 2 */}
                          <line 
                            x1={goniometer.points[1].x} y1={goniometer.points[1].y}
                            x2={goniometer.points[2].x} y2={goniometer.points[2].y}
                            stroke="rgba(255, 255, 255, 0.8)"
                            strokeWidth="4"
                          />
                          {/* Angle Arc */}
                          {/* (Simplified arc drawing could go here) */}
                        </>
                      )}
                      
                      {goniometer.type === '4-point' && goniometer.points.length === 4 && (
                         <>
                           {/* Line 1 */}
                           <line 
                             x1={goniometer.points[0].x} y1={goniometer.points[0].y}
                             x2={goniometer.points[1].x} y2={goniometer.points[1].y}
                             stroke="rgba(255, 255, 255, 0.8)"
                             strokeWidth="4"
                             strokeDasharray="8 4"
                           />
                           {/* Line 2 */}
                           <line 
                             x1={goniometer.points[2].x} y1={goniometer.points[2].y}
                             x2={goniometer.points[3].x} y2={goniometer.points[3].y}
                             stroke="rgba(255, 255, 255, 0.8)"
                             strokeWidth="4"
                             strokeDasharray="8 4"
                           />
                         </>
                      )}
                    </>
                  )}
                </svg>
              )}

              {/* Interactive Points Layer (HTML/Divs for better hit testing) */}
              {imageSize && goniometer && (
                 <div className="absolute inset-0 w-full h-full">
                    {goniometer.points.map((p, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white cursor-move flex items-center justify-center shadow-lg transition-transform",
                          idx === 1 && goniometer.type === '3-point' ? "bg-blue-500 z-20 w-8 h-8 -ml-4 -mt-4" : "bg-blue-400/80 z-10",
                          activePointIndex === idx ? "scale-125 ring-2 ring-white" : ""
                        )}
                        style={{ 
                           left: `${(p.x / imageSize.width) * 100}%`, 
                           top: `${(p.y / imageSize.height) * 100}%` 
                        }}
                        onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, idx); }}
                      >
                         <div className="w-1 h-1 bg-white rounded-full" />
                      </div>
                    ))}
                    
                    {/* Angle Label */}
                    {goniometer.type === '3-point' && (
                        <div 
                           className="absolute px-2 py-1 bg-black/70 rounded text-white font-bold text-sm pointer-events-none whitespace-nowrap"
                           style={{
                               left: `${(goniometer.points[1].x / imageSize.width) * 100}%`,
                               top: `${(goniometer.points[1].y / imageSize.height) * 100}%`,
                               transform: 'translate(20px, -20px)'
                           }}
                        >
                            {angle.toFixed(1)}°
                        </div>
                    )}
                    {goniometer.type === '4-point' && (
                         <div className="absolute top-4 left-4 px-3 py-2 bg-black/70 rounded text-white font-bold pointer-events-none z-30">
                             夹角: {angle.toFixed(1)}°
                         </div>
                    )}
                 </div>
              )}

              {/* Magnifier (Loupe) */}
              {showMagnifier && (
                <div 
                  className="fixed pointer-events-none z-50 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-black"
                  style={{
                    width: 150,
                    height: 150,
                    left: magnifierPos.x - 75,
                    top: magnifierPos.y - 200, // Show above finger
                  }}
                >
                  <canvas ref={magnifierCanvasRef} width={150} height={150} className="w-full h-full" />
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}

function ToolButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center p-2 rounded-lg w-12 h-12 transition-all",
        active ? "bg-blue-600 text-white shadow-lg scale-105" : "text-gray-400 hover:bg-white/10 hover:text-white"
      )}
      title={label}
    >
      {icon}
      {/* <span className="text-[10px] mt-1">{label}</span> */}
    </button>
  );
}
