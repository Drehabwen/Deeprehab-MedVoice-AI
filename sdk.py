import requests
import base64
import os
import json
from typing import Dict, Any, Optional

class AIsciClient:
    """
    AIsci 智能病历生成系统 Python SDK
    支持同步和基础功能调用
    """
    
    def __init__(self, base_url: str = "http://localhost:5000"):
        self.base_url = base_url.rstrip('/')
        
    def _post(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        try:
            response = requests.post(url, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"status": "error", "message": str(e)}

    def health_check(self) -> Dict[str, Any]:
        """检查服务器状态"""
        try:
            response = requests.get(f"{self.base_url}/health")
            return response.json()
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def transcribe(self, audio_path: str) -> Dict[str, Any]:
        """
        语音转录接口
        :param audio_path: 音频文件路径
        """
        if not os.path.exists(audio_path):
            return {"status": "error", "message": "文件不存在"}
            
        with open(audio_path, "rb") as f:
            audio_data = base64.b64encode(f.read()).decode('utf-8')
            
        payload = {
            "audio_data": audio_data,
            "format": audio_path.split('.')[-1]
        }
        return self._post("/api/transcribe", payload)

    def structure_case(self, transcript: str, separate_speakers: bool = True) -> Dict[str, Any]:
        """
        病例结构化接口
        :param transcript: 原始文本或对话
        :param separate_speakers: 是否进行说话人区分
        """
        payload = {
            "transcript": transcript,
            "separate_speakers": separate_speakers
        }
        return self._post("/api/structure", payload)

    def generate_report(self, structured_case: Dict[str, Any], 
                        patient_info: Optional[Dict[str, Any]] = None,
                        doctor_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        病历报告生成接口
        :param structured_case: 结构化后的病例数据
        :param patient_info: 患者基本信息
        :param doctor_info: 医生/机构信息
        """
        payload = {
            "structured_case": structured_case,
            "patient_info": patient_info or {},
            "doctor_info": doctor_info or {}
        }
        return self._post("/api/generate", payload)

    def export_document(self, case_data: Dict[str, Any], export_format: str = "docx") -> Dict[str, Any]:
        """
        导出病历文档接口
        :param case_data: 完整的病例数据（包含结构化内容和病历文本）
        :param export_format: 导出格式 (docx/pdf)
        """
        payload = {
            "case_data": case_data,
            "export_format": export_format
        }
        return self._post("/api/export", payload)

# 异步客户端示例 (如果需要)
try:
    import httpx
    import asyncio

    class AsyncAIsciClient:
        """
        AIsci 异步 Python SDK
        """
        def __init__(self, base_url: str = "http://localhost:5000"):
            self.base_url = base_url.rstrip('/')

        async def _post(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
            async with httpx.AsyncClient() as client:
                url = f"{self.base_url}{endpoint}"
                response = await client.post(url, json=data)
                return response.json()

        async def transcribe(self, audio_path: str) -> Dict[str, Any]:
            if not os.path.exists(audio_path):
                return {"status": "error", "message": "文件不存在"}
            with open(audio_path, "rb") as f:
                audio_data = base64.b64encode(f.read()).decode('utf-8')
            return await self._post("/api/transcribe", {"audio_data": audio_data})

        async def structure_case(self, transcript: str) -> Dict[str, Any]:
            return await self._post("/api/structure", {"transcript": transcript})

except ImportError:
    pass
