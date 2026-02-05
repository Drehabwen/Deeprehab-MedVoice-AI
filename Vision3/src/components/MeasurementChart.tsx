import { useMeasurementStore } from '@/store/useMeasurementStore';
import { getStandardRange } from '@/constants/standard-ranges';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

export default function MeasurementChart() {
  const { activeMeasurements, isMeasuring } = useMeasurementStore();

  if (activeMeasurements.length === 0) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-md h-[300px] flex items-center justify-center">
        <span className="text-gray-400">请添加测量项...</span>
      </div>
    );
  }

  // Use the first measurement as the time base
  // We assume data points are roughly synchronized since they are updated in the same loop
  const primaryMeasurement = activeMeasurements[0];
  const chartData = primaryMeasurement.data.map((point, index) => {
    const merged: any = { timestamp: point.timestamp };
    activeMeasurements.forEach(m => {
      if (m.data[index]) {
        merged[m.id] = m.data[index].angle;
      }
    });
    return merged;
  });
  
  // Limit data points for performance
  const displayData = chartData.slice(-100);

  return (
    <div className="bg-white p-4 rounded-lg shadow-md h-[300px] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">活动度趋势</h3>
        <div className="flex flex-wrap gap-4 text-xs">
           {activeMeasurements.map(m => {
             const standardRange = getStandardRange(m.joint, m.direction);
             return (
               <div key={m.id} className="flex items-center space-x-1" style={{ color: m.color }}>
                 <span className="font-bold">{JOINT_NAMES[m.joint] || m.joint} {m.side ? `(${SIDE_NAMES[m.side] || m.side})` : ''}:</span>
                 <span>最大值: {m.maxAngle === -Infinity ? '-' : m.maxAngle.toFixed(1)}°</span>
                 {standardRange && (
                   <span className="text-gray-400 ml-1 scale-90 origin-left">
                     (参考: {standardRange.min}-{standardRange.max}°)
                   </span>
                 )}
               </div>
             );
           })}
        </div>
      </div>
      
      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis 
              dataKey="timestamp" 
              type="number" 
              domain={['auto', 'auto']} 
              tickFormatter={(val) => val.toFixed(1) + 's'}
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              label={{ value: '时间 (s)', position: 'insideBottomRight', offset: -5, fill: '#9ca3af', fontSize: 12 }}
            />
            <YAxis 
              domain={[0, 180]} 
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tickFormatter={(val) => Math.round(val).toString()}
              label={{ value: '角度 (°)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                borderRadius: '8px', 
                border: 'none', 
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                padding: '8px 12px'
              }}
              itemStyle={{ fontSize: '12px', padding: '2px 0' }}
              labelStyle={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}
              cursor={{ stroke: '#d1d5db', strokeWidth: 1, strokeDasharray: '4 4' }}
              formatter={(value: number, name: string) => {
                  const m = activeMeasurements.find(am => am.id === name);
                  if (m) {
                    const joint = JOINT_NAMES[m.joint] || m.joint;
                    const side = m.side ? (SIDE_NAMES[m.side] || m.side) : '';
                    const dir = DIRECTION_NAMES[m.direction] || m.direction;
                    const sideText = side ? `(${side})` : '';
                    return [`${value.toFixed(1)}°`, `${joint} ${sideText} ${dir}`];
                  }
                  return [value.toFixed(1) + '°', name];
              }}
              labelFormatter={(label: number) => label.toFixed(2) + 's'}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '10px' }}
              formatter={(value, entry: any) => {
                const m = activeMeasurements.find(am => am.id === entry.dataKey);
                if (m) {
                    const joint = JOINT_NAMES[m.joint] || m.joint;
                    const side = m.side ? (SIDE_NAMES[m.side] || m.side) : '';
                    const dir = DIRECTION_NAMES[m.direction] || m.direction;
                    const sideText = side ? `(${side})` : '';
                    return <span className="text-sm text-gray-600 font-medium ml-1">{`${joint} ${sideText} - ${dir}`}</span>;
                }
                return value;
            }} />
            
            {activeMeasurements.map(m => (
                <Line 
                  key={m.id}
                  type="monotone" 
                  dataKey={m.id} 
                  stroke={m.color} 
                  strokeWidth={2.5} 
                  dot={false} 
                  activeDot={{ r: 6, strokeWidth: 0, fill: m.color }}
                  isAnimationActive={false}
                />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {!isMeasuring && displayData.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-10">
          <span className="text-gray-400">等待开始测量...</span>
        </div>
      )}
    </div>
  );
}
