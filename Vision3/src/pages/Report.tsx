import { useMeasurementStore } from '@/store/useMeasurementStore';
import { Trash2, FileDown, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import ManualAnalysis from '@/components/ManualAnalysis';

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

export default function Report() {
  const { savedMeasurements, deleteSavedMeasurement } = useMeasurementStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [annotatingImage, setAnnotatingImage] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleManualSave = (annotatedImage: string) => {
    // Create a download link for the annotated image
    const link = document.createElement('a');
    link.href = annotatedImage;
    link.download = `annotated-measurement-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setAnnotatingImage(null);
  };

  const exportPDF = async (id: string) => {
    const element = document.getElementById(`report-${id}`);
    if (!element) return;

    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`report-${id}.pdf`);
    } catch (err) {
      console.error('PDF generation failed', err);
      alert('导出PDF失败，请重试');
    }
  };

  if (savedMeasurements.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-medium text-gray-900">暂无测量报告</h2>
        <p className="text-gray-500 mt-2">请先进行测量并保存数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">测量报告历史</h1>
      
      <div className="space-y-4">
        {savedMeasurements.map((session) => (
          <div key={session.id} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
            <div 
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
              onClick={() => toggleExpand(session.id)}
            >
              <div className="flex items-center space-x-4">
                <div className="bg-blue-100 p-2 rounded-full">
                  {expandedId === session.id ? <ChevronUp className="h-5 w-5 text-blue-600" /> : <ChevronDown className="h-5 w-5 text-blue-600" />}
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    测量记录 ({session.measurements.length} 项)
                  </h3>
                  <p className="text-sm text-gray-500">
                    {new Date(session.date).toLocaleString()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSavedMeasurement(session.id); }}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            {expandedId === session.id && (
              <div id={`report-${session.id}`} className="p-6 border-t border-gray-200 bg-white">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-xl font-bold text-gray-800">详细分析报告</h4>
                  <button
                    onClick={() => exportPDF(session.id)}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    导出PDF
                  </button>
                </div>

                <div className="space-y-8">
                  {session.measurements.map((item, idx) => (
                    <div key={idx} className="border-b pb-6 last:border-0">
                      <h5 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                        <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></span>
                        {JOINT_NAMES[item.joint] || item.joint} {item.side ? `(${SIDE_NAMES[item.side] || item.side})` : ''} - {DIRECTION_NAMES[item.direction] || item.direction}
                      </h5>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-500">最小角度</p>
                          <p className="text-2xl font-bold text-blue-600">{item.minAngle === Infinity ? '-' : item.minAngle.toFixed(1)}°</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-500">最大角度</p>
                          <p className="text-2xl font-bold text-blue-600">{item.maxAngle === -Infinity ? '-' : item.maxAngle.toFixed(1)}°</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-500">活动范围 (ROM)</p>
                          <p className="text-2xl font-bold text-blue-600">
                             {(item.maxAngle !== -Infinity && item.minAngle !== Infinity) ? (item.maxAngle - item.minAngle).toFixed(1) : '-'}°
                          </p>
                        </div>
                      </div>

                      <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={item.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                            <XAxis 
                              dataKey="timestamp" 
                              type="number" 
                              tickFormatter={(val) => val.toFixed(1) + 's'}
                              tick={{ fontSize: 12, fill: '#9ca3af' }}
                              tickLine={false}
                              axisLine={{ stroke: '#e5e7eb' }}
                            />
                            <YAxis 
                              domain={[0, 180]} 
                              tick={{ fontSize: 12, fill: '#9ca3af' }}
                              tickLine={false}
                              axisLine={{ stroke: '#e5e7eb' }}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                borderRadius: '8px', 
                                border: 'none', 
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                padding: '8px 12px'
                              }}
                              itemStyle={{ fontSize: '12px', padding: '2px 0' }}
                              formatter={(value: number) => value.toFixed(1) + '°'} 
                              labelFormatter={(label: number) => label.toFixed(2) + 's'}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="angle" 
                              stroke={item.color || "#2563eb"} 
                              strokeWidth={2.5} 
                              dot={false} 
                              activeDot={{ r: 6, strokeWidth: 0, fill: item.color || "#2563eb" }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {item.maxAngleImage && (
                        <div className="mt-6">
                          <div className="flex items-center justify-between mb-2">
                             <p className="text-sm font-medium text-gray-700">最大角度瞬间</p>
                             <button
                               onClick={() => setAnnotatingImage(item.maxAngleImage!)}
                               className="flex items-center text-xs text-blue-600 hover:text-blue-800"
                             >
                               <Edit3 className="w-3 h-3 mr-1" />
                               手动标注
                             </button>
                          </div>
                          <div className="relative rounded-lg overflow-hidden border border-gray-200 aspect-video max-w-lg group">
                            <img src={item.maxAngleImage} alt="Max Angle Frame" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                               <button 
                                 onClick={() => setAnnotatingImage(item.maxAngleImage!)}
                                 className="bg-white/90 text-gray-800 px-4 py-2 rounded-full text-sm font-medium shadow-sm hover:bg-white"
                               >
                                 点击标注
                               </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 text-sm text-gray-500 text-center">
                  生成时间: {new Date().toLocaleString()} | Vision3 智能评估系统
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {annotatingImage && (
        <ManualAnalysis
          imageUrl={annotatingImage}
          onClose={() => setAnnotatingImage(null)}
          onSave={handleManualSave}
        />
      )}
    </div>
  );
}
