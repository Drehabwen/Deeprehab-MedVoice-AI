from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import os
import json
import base64
import tempfile
import asyncio
from datetime import datetime
import logging
import uvicorn

# 导入核心模块
try:
    from core.voice import VoiceRecorder
    from core.nlp_processor import NLPProcessor
    from core.case_structurer import CaseStructurer
    from core.document_generator import DocumentGenerator
    from core.case_manager import CaseManager
except ImportError:
    from voice import VoiceRecorder
    from nlp_processor import NLPProcessor
    from case_structurer import CaseStructurer
    from document_generator import DocumentGenerator
    from case_manager import CaseManager

app = FastAPI(
    title="AIsci API",
    description="智能医疗助理系统后端接口",
    version="1.0.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 加载配置
def load_config():
    config_path = "config.json"
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    else:
        return {
            "hospital_name": "XX社区卫生服务中心",
            "doctor_name": "王医生",
            "audio_sample_rate": 16000,
            "audio_channels": 1,
            "cases_dir": "./cases",
            "exports_dir": "./exports"
        }

config = load_config()

# 初始化组件
recorder = VoiceRecorder()
nlp_processor = NLPProcessor(config)
case_structurer = CaseStructurer(nlp_processor)
doc_generator = DocumentGenerator(config)
case_manager = CaseManager(config)

# 挂载 Web 前端静态文件
# 假设 api_server.py 在 src/ 目录下，web 在 src/web/ 目录下
current_dir = os.path.dirname(os.path.abspath(__file__))
web_dir = os.path.join(current_dir, "web")

if os.path.exists(web_dir):
    app.mount("/static", StaticFiles(directory=web_dir), name="static")

@app.get("/")
async def read_root():
    index_path = os.path.join(web_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "AIsci API Server is running"}

# --- 数据模型定义 ---

class TranscribeRequest(BaseModel):
    audio_data: str  # base64
    format: Optional[str] = "wav"

class StructureRequest(BaseModel):
    transcript: str
    separate_speakers: Optional[bool] = True

class GenerateRequest(BaseModel):
    structured_case: Dict[str, Any]
    patient_info: Optional[Dict[str, Any]] = {}
    doctor_info: Optional[Dict[str, Any]] = {}

class ExportRequest(BaseModel):
    case_data: Dict[str, Any]
    export_format: Optional[str] = "docx"

class SaveRequest(BaseModel):
    case_data: Dict[str, Any]

# --- 路由定义 ---

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# --- 本地录音接口 ---

@app.post("/api/record/start")
async def start_local_record():
    try:
        # 这里可以使用 on_update 来通过 websocket 或其他方式推送实时文本
        # 目前先简单实现
        recorder.start_recording()
        return {"status": "success", "message": "已开启本地麦克风录音"}
    except Exception as e:
        logger.error(f"开启录音失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/record/stop")
async def stop_local_record():
    try:
        transcript = recorder.stop_recording()
        return {
            "status": "success",
            "data": {
                "transcript": transcript,
                "timestamp": datetime.now().isoformat()
            }
        }
    except Exception as e:
        logger.error(f"停止录音失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transcribe")
async def transcribe_audio(request: TranscribeRequest):
    try:
        audio_bytes = base64.b64decode(request.audio_data)
        
        with tempfile.NamedTemporaryFile(suffix=f'.{request.format}', delete=False) as temp_file:
            temp_file.write(audio_bytes)
            temp_file_path = temp_file.name
        
        try:
            transcript = recorder.transcribe_file(temp_file_path)
            return {
                'status': 'success',
                'data': {
                    'transcript': transcript,
                    'timestamp': datetime.now().isoformat()
                }
            }
        finally:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
    
    except Exception as e:
        logger.error(f'转录失败: {str(e)}')
        raise HTTPException(status_code=500, detail=f'转录失败: {str(e)}')

@app.post("/api/structure")
async def structure_case(request: StructureRequest):
    try:
        # 步骤 1: 分析对话
        analyzed_dialogue = case_structurer.analyze_dialogue(request.transcript)
        # 步骤 2: 结构化病历
        structured_case = case_structurer.structure(analyzed_dialogue)
        
        return {
            'status': 'success',
            'data': {
                'analyzed_dialogue': analyzed_dialogue,
                'structured_case': structured_case,
                'timestamp': datetime.now().isoformat()
            }
        }
    except Exception as e:
        logger.error(f'病例结构化失败: {str(e)}')
        raise HTTPException(status_code=500, detail=f'病例结构化失败: {str(e)}')

@app.post("/api/generate")
async def generate_medical_record(request: GenerateRequest):
    try:
        # 合并信息
        case_data = {**request.structured_case, **request.patient_info}
        config_info = {**config, **request.doctor_info}
        
        medical_record = case_structurer.generate_report(case_data, config_info)
        
        return {
            'status': 'success',
            'data': {
                'medical_record': medical_record,
                'timestamp': datetime.now().isoformat()
            }
        }
    except Exception as e:
        logger.error(f'病历生成失败: {str(e)}')
        raise HTTPException(status_code=500, detail=f'病历生成失败: {str(e)}')

@app.post("/api/export")
async def export_document(request: ExportRequest):
    try:
        case_data = request.case_data
        
        # 统一映射字段，确保导出模块能拿到正确的数据
        if not case_data.get("patient_name") and case_data.get("name"):
            case_data["patient_name"] = case_data["name"]
        
        # 确保 case_id 存在（用于文件名生成）
        if "case_id" not in case_data:
            case_data["case_id"] = "EXPORT_" + datetime.now().strftime("%H%M%S")

        logger.info(f"正在导出 {request.export_format} 格式，患者: {case_data.get('patient_name')}")

        if request.export_format == "pdf":
            file_path = doc_generator.generate_pdf(case_data)
        else:
            file_path = doc_generator.generate_word(case_data)
            
        return {
            'status': 'success',
            'data': {
                'file_path': file_path,
                'file_name': os.path.basename(file_path),
                'timestamp': datetime.now().isoformat()
            }
        }
    except Exception as e:
        logger.error(f'导出失败: {str(e)}')
        raise HTTPException(status_code=500, detail=f'导出失败: {str(e)}')

@app.post("/api/save")
async def save_case_data(request: SaveRequest):
    try:
        # 为了适配 CaseManager，我们需要确保一些字段存在
        case_data = request.case_data
        
        # 映射字段名以适配 CaseManager 的验证逻辑
        if "patient_name" not in case_data and "name" in case_data:
            case_data["patient_name"] = case_data["name"]
        
        # 如果没有诊断字段，从结构化数据中提取
        if "diagnosis" not in case_data and "诊断" in case_data:
            case_data["diagnosis"] = case_data["诊断"]
            
        # 映射主诉字段以通过 CaseManager 的验证
        if "chief_complaint" not in case_data and "主诉" in case_data:
            case_data["chief_complaint"] = case_data["主诉"]

        # 确保有就诊日期
        if "visit_date" not in case_data:
            case_data["visit_date"] = datetime.now().strftime("%Y-%m-%d")

        success, result = case_manager.save_case(case_data)
        if success:
            return {
                'status': 'success',
                'data': {
                    'case_id': result,
                    'timestamp': datetime.now().isoformat()
                }
            }
        else:
            raise Exception(result)
            
    except Exception as e:
        logger.error(f'保存失败: {str(e)}')
        raise HTTPException(status_code=500, detail=f'保存失败: {str(e)}')

@app.get("/api/cases")
async def get_cases():
    try:
        cases = case_manager.list_cases()
        return {
            'status': 'success',
            'data': {
                'cases': cases,
                'count': len(cases)
            }
        }
    except Exception as e:
        logger.error(f'获取病例列表失败: {str(e)}')
        raise HTTPException(status_code=500, detail=f'获取病例列表失败: {str(e)}')

@app.get("/api/cases/{case_id}")
async def get_case_detail(case_id: str):
    try:
        case_data = case_manager.load_case(case_id)
        if case_data:
            return {
                'status': 'success',
                'data': {
                    'case': case_data,
                    'timestamp': datetime.now().isoformat()
                }
            }
        else:
            raise HTTPException(status_code=404, detail="未找到该病例")
    except Exception as e:
        logger.error(f'获取病例详情失败: {str(e)}')
        raise HTTPException(status_code=500, detail=f'获取病例详情失败: {str(e)}')

@app.websocket("/ws/record")
async def websocket_record(websocket: WebSocket):
    # 显式允许所有 Origin 的 WebSocket 连接
    await websocket.accept()
    queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def on_update(text):
        # 使用 call_soon_threadsafe 确保跨线程推送数据到 asyncio 队列
        loop.call_soon_threadsafe(queue.put_nowait, text)

    try:
        # 等待前端发送开始指令
        data = await websocket.receive_json()
        if data.get("command") == "start":
            # 启动录音
            recorder.start_recording(on_update=on_update)
            logger.info("收到前端指令，录音已启动")
            
            # 启动一个并发任务来读取队列并发送给前端
            async def send_updates():
                while recorder.is_recording:
                    try:
                        text = await asyncio.wait_for(queue.get(), timeout=0.5)
                        await websocket.send_json({
                            "status": "update",
                            "text": text
                        })
                    except asyncio.TimeoutError:
                        continue
                    except Exception as e:
                        logger.error(f"发送实时数据失败: {e}")
                        break

            # 运行发送循环，同时监听前端的停止指令
            send_task = asyncio.create_task(send_updates())
            
            while True:
                # 监听可能的停止指令或断开连接
                try:
                    msg = await asyncio.wait_for(websocket.receive_json(), timeout=1.0)
                    if msg.get("command") == "stop":
                        logger.info("收到前端停止指令")
                        final_text = recorder.stop_recording()
                        await websocket.send_json({
                            "status": "completed",
                            "text": final_text
                        })
                        break
                except asyncio.TimeoutError:
                    if not recorder.is_recording:
                        break
                    continue
            
            send_task.cancel()
            try:
                await send_task
            except asyncio.CancelledError:
                pass
            
    except WebSocketDisconnect:
        logger.info("WebSocket 已断开")
    except Exception as e:
        logger.error(f"WebSocket 异常: {e}")
    finally:
        recorder.stop_recording()
        logger.info("WebSocket 录音流程结束")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)
