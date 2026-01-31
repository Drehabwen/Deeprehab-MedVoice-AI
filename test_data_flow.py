import httpx
import asyncio
import json
import time
from datetime import datetime

BASE_URL = "http://127.0.0.1:5000"

async def test_flow():
    async with httpx.AsyncClient(timeout=10.0) as client:
        print(f"\n{'='*20} 开始前后端数据流转测试 {'='*20}")
        
        # 1. 测试健康检查
        print("\n[步骤 1] 测试后端健康检查...")
        try:
            resp = await client.get(f"{BASE_URL}/health")
            print(f"状态码: {resp.status_code}, 内容: {resp.json()}")
            assert resp.status_code == 200
        except Exception as e:
            print(f"健康检查失败: {e}")
            return

        # 2. 模拟前端保存病例数据
        print("\n[步骤 2] 模拟前端发送保存病例请求...")
        # 模拟前端构建的 case_data 结构（扁平化结构，符合 app.js 逻辑）
        case_data = {
            "patient_name": "测试患者",
            "age": "30",
            "gender": "男",
            "主诉": "反复咳嗽一周",
            "现病史": "患者一周前受凉后出现咳嗽，无发热，无痰。",
            "既往史": "无特殊",
            "体格检查": "双肺呼吸音清，未闻及干湿啰音。",
            "诊断": "急性支气管炎",
            "处理意见": "止咳对症治疗，注意休息。",
            "transcript": "医生：你好，哪里不舒服？患者：我咳嗽一周了。医生：有没有发热？患者：没有。"
        }
        
        try:
            # 根据 api_server.py 的 SaveRequest 模型，需要嵌套在 case_data 字段中
            resp = await client.post(f"{BASE_URL}/api/save", json={"case_data": case_data})
            result = resp.json()
            print(f"保存响应: {result}")
            assert resp.status_code == 200
            assert result["status"] == "success"
            case_id = result["data"]["case_id"]
            print(f"成功保存病例，ID: {case_id}")
        except Exception as e:
            print(f"保存病例失败: {e}")
            return

        # 3. 测试获取病例列表
        print("\n[步骤 3] 测试获取病例列表，确认新病例已存在...")
        try:
            resp = await client.get(f"{BASE_URL}/api/cases")
            result = resp.json()
            print(f"获取到 {result['data']['count']} 个病例")
            assert resp.status_code == 200
            # 确认刚保存的 ID 在列表中
            case_ids = [c["case_id"] for c in result["data"]["cases"]]
            assert case_id in case_ids
            print(f"确认病例 {case_id} 已在索引列表中")
        except Exception as e:
            print(f"获取列表失败: {e}")
            return

        # 4. 测试获取病例详情
        print("\n[步骤 4] 测试获取病例详情，确认数据完整性...")
        try:
            resp = await client.get(f"{BASE_URL}/api/cases/{case_id}")
            result = resp.json()
            print(f"详情响应状态: {result['status']}")
            assert resp.status_code == 200
            case_detail = result["data"]["case"]
            
            # 验证关键字段
            assert case_detail["patient_name"] == "测试患者"
            assert case_detail["诊断"] == "急性支气管炎"
            assert case_detail["transcript"] == case_data["transcript"]
            print("病例详情验证通过：字段完整且准确")
        except Exception as e:
            print(f"获取详情失败: {e}")
            return

        print(f"\n{'='*20} 所有数据流转测试通过！ {'='*20}\n")

if __name__ == "__main__":
    asyncio.run(test_flow())
