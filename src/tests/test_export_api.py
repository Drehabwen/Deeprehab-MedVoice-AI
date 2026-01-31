import requests
import os
import json
import unittest

class TestExportFunctionality(unittest.TestCase):
    """测试病例导出功能，包括 API 调用和文件下载接口"""
    
    BASE_URL = "http://localhost:5000"
    API_EXPORT = f"{BASE_URL}/api/export"
    API_DOWNLOAD = f"{BASE_URL}/api/download"

    @classmethod
    def setUpClass(cls):
        """准备测试数据"""
        cls.test_case_data = {
            "case_data": {
                "patient_name": "测试患者",
                "age": "30",
                "gender": "男",
                "主诉": "测试主诉内容",
                "现病史": "测试现病史内容",
                "既往史": "无",
                "体格检查": "体温正常",
                "诊断": "测试诊断",
                "处理意见": "休息",
                "ai_suggestions": "建议多喝水",
                "markdown_content": "# 测试病历报告\n\n## 主诉\n测试主诉内容"
            }
        }

    def test_01_export_docx_api(self):
        """测试导出 Word 的 API 接口"""
        payload = {
            "export_format": "docx",
            **self.test_case_data
        }
        print("\n[测试] 正在请求导出 Word...")
        response = requests.post(self.API_EXPORT, json=payload)
        
        self.assertEqual(response.status_code, 200)
        res_json = response.json()
        self.assertEqual(res_json["status"], "success")
        
        data = res_json["data"]
        self.assertIn("download_url", data)
        self.assertIn(".docx", data["download_url"])
        
        # 保存下载链接供后续下载测试使用
        self.__class__.docx_download_url = data["download_url"]
        print(f"成功获取 Word 下载链接: {data['download_url']}")

    def test_02_export_pdf_api(self):
        """测试导出 PDF 的 API 接口"""
        payload = {
            "export_format": "pdf",
            **self.test_case_data
        }
        print("\n[测试] 正在请求导出 PDF...")
        response = requests.post(self.API_EXPORT, json=payload)
        
        self.assertEqual(response.status_code, 200)
        res_json = response.json()
        self.assertEqual(res_json["status"], "success")
        
        data = res_json["data"]
        self.assertIn("download_url", data)
        self.assertIn(".pdf", data["download_url"])
        
        # 保存下载链接供后续下载测试使用
        self.__class__.pdf_download_url = data["download_url"]
        print(f"成功获取 PDF 下载链接: {data['download_url']}")

    def test_03_download_docx_file(self):
        """测试下载生成的 Word 文件"""
        if not hasattr(self, 'docx_download_url'):
            self.skipTest("未获取到 Word 下载链接，跳过下载测试")
            
        file_name = self.docx_download_url.split('/')[-1]
        download_url = f"{self.BASE_URL}{self.docx_download_url}"
        
        print(f"\n[测试] 正在下载文件: {file_name}...")
        response = requests.get(download_url)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Content-Type"], "application/octet-stream")
        
        # 验证文件是否实际存在（通过内容长度）
        self.assertGreater(len(response.content), 0)
        print(f"文件下载成功，大小: {len(response.content)} bytes")

    def test_04_download_pdf_file(self):
        """测试下载生成的 PDF 文件"""
        if not hasattr(self, 'pdf_download_url'):
            self.skipTest("未获取到 PDF 下载链接，跳过下载测试")
            
        file_name = self.pdf_download_url.split('/')[-1]
        download_url = f"{self.BASE_URL}{self.pdf_download_url}"
        
        print(f"\n[测试] 正在下载文件: {file_name}...")
        response = requests.get(download_url)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Content-Type"], "application/octet-stream")
        
        # 验证文件是否实际存在
        self.assertGreater(len(response.content), 0)
        print(f"文件下载成功，大小: {len(response.content)} bytes")

    def test_05_download_non_existent_file(self):
        """测试下载不存在的文件（异常测试）"""
        download_url = f"{self.API_DOWNLOAD}/non_existent_file_xyz_123.docx"
        response = requests.get(download_url)
        self.assertEqual(response.status_code, 404)
        print("\n[测试] 成功验证不存在文件的 404 错误")

if __name__ == "__main__":
    unittest.main()
