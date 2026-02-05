import { Play, Square, RotateCcw, Save } from 'lucide-react';
import WebcamView from '@/components/WebcamView';
import JointSelector from '@/components/JointSelector';
import MeasurementChart from '@/components/MeasurementChart';
import { useMeasurementStore } from '@/store/useMeasurementStore';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export default function Measure() {
  const { 
    isMeasuring, startMeasurement, stopMeasurement, resetMeasurement, saveMeasurement, activeMeasurements
  } = useMeasurementStore();
  const navigate = useNavigate();

  const hasData = activeMeasurements.some(m => m.data.length > 0);

  const handleSave = () => {
    saveMeasurement();
    navigate('/report');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">关节活动度测量</h1>
          <p className="text-gray-500">选择关节和方向，开始实时测量</p>
        </div>
        
        <div className="flex space-x-3">
          {!isMeasuring ? (
            <>
              <button
                onClick={startMeasurement}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Play className="h-4 w-4 mr-2" />
                开始测量
              </button>
              
              {hasData && (
                <button
                  onClick={handleSave}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <Save className="h-4 w-4 mr-2" />
                  保存数据
                </button>
              )}
            </>
          ) : (
            <button
              onClick={stopMeasurement}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Square className="h-4 w-4 mr-2" />
              停止测量
            </button>
          )}
          
          <button
            onClick={resetMeasurement}
            disabled={isMeasuring}
            className={cn(
              "inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
              isMeasuring && "opacity-50 cursor-not-allowed"
            )}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            重置
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <WebcamView />
          <MeasurementChart />
        </div>
        
        <div className="lg:col-span-1">
          <JointSelector />
          
          {/* Instructions or Standard Range Info could go here */}
          <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h4 className="font-medium text-blue-900 mb-2">测量指南</h4>
            <ul className="text-sm text-blue-800 space-y-2 list-disc pl-4">
              <li>请确保全身或测量部位在摄像头视野内。</li>
              <li>保持光线充足，避免逆光。</li>
              <li>点击"开始测量"后，缓慢进行关节活动。</li>
              <li>活动至最大幅度保持1-2秒。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
