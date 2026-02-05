import { Link } from 'react-router-dom';
import { Activity, LayoutDashboard, FileText, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="space-y-12 py-10">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
          <span className="block">精准关节活动度测量</span>
          <span className="block text-blue-600">基于机器视觉技术</span>
        </h1>
        <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
          Vision3 使用先进的计算机视觉算法，通过摄像头实时评估您的关节活动范围(ROM)和体态健康。无需穿戴设备，保护隐私，即刻开始。
        </p>
        <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
          <div className="rounded-md shadow">
            <Link
              to="/measure"
              className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10"
            >
              开始测量
            </Link>
          </div>
          <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
            <Link
              to="/posture"
              className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10"
            >
              体态评估
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto px-4">
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <Activity className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">关节ROM测量</h3>
          <p className="text-gray-500">
            支持颈椎、肩、肘、腕、髋、膝、踝等全身主要关节的活动度测量。实时显示角度变化趋势。
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <LayoutDashboard className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">静态体态评估</h3>
          <p className="text-gray-500">
            从正面、背面、侧面多角度分析体态问题，如头前倾、高低肩、骨盆倾斜等，并提供改善建议。
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <FileText className="h-6 w-6 text-purple-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">专业报告导出</h3>
          <p className="text-gray-500">
            自动生成包含趋势图和数据分析的测量报告，支持本地保存和PDF导出，方便追踪康复进度。
          </p>
        </div>
      </div>
    </div>
  );
}
