import asyncio
import websockets
import json
import httpx
import time

WS_URL = "ws://127.0.0.1:5000/ws/record"
API_URL = "http://127.0.0.1:5000"

async def test_recording_flow():
    print(f"\n{'='*20} 开始录音功能测试 (WebSocket + Backend Recording) {'='*20}")
    
    # 1. 首先确保后端健康
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{API_URL}/health")
            if resp.status_code != 200:
                print("后端未就绪，请先启动 api_server.py")
                return
        except Exception as e:
            print(f"连接后端失败: {e}")
            return

    try:
        # 2. 建立 WebSocket 连接
        print("\n[步骤 1] 建立 WebSocket 连接...")
        async with websockets.connect(WS_URL) as ws:
            print("WebSocket 连接成功")

            # 3. 发送 start 指令
            print("\n[步骤 2] 发送 'start' 指令启动后端录音...")
            await ws.send(json.dumps({"command": "start"}))
            
            print(">>> 录音已启动，请对着麦克风说话 (测试将持续 10 秒) <<<")
            
            # 4. 接收实时转写文本
            start_time = time.time()
            received_any_text = False
            recording_duration = 20  # 延长录音时间到 20 秒
            
            print(f">>> 录音已启动，请对着麦克风说话 (测试将持续 {recording_duration} 秒) <<<")
            
            while time.time() - start_time < recording_duration:
                try:
                    # 设置超时，防止一直卡在 recv
                    message = await asyncio.wait_for(ws.recv(), timeout=1.0)
                    data = json.loads(message)
                    
                    if data.get("status") == "update":
                        text = data.get("text", "")
                        if text:
                            print(f"[实时转写]: {text}")
                            received_any_text = True
                except asyncio.TimeoutError:
                    # 打印一个点表示在等待
                    print(".", end="", flush=True)
                    continue
                except Exception as e:
                    print(f"\n接收数据异常: {e}")
                    break
            
            print("\n\n[步骤 3] 发送 'stop' 指令停止录音...")
            await ws.send(json.dumps({"command": "stop"}))
            
            # 5. 等待最终识别结果
            print("等待最终识别结果...")
            final_transcript = ""
            try:
                final_message = await asyncio.wait_for(ws.recv(), timeout=10.0)
                final_data = json.loads(final_message)
                
                if final_data.get("status") == "completed":
                    final_transcript = final_data.get('text')
                    print(f"\n[最终识别文本]: {final_transcript}")
                else:
                    print(f"\n收到非预期结束状态: {final_data}")
            except asyncio.TimeoutError:
                print("\n等待最终结果超时")
            
            # 6. 调用结构化分析 API
            if final_transcript:
                print("\n[步骤 4] 调用后台结构化分析 API...")
                async with httpx.AsyncClient(timeout=30.0) as client:
                    try:
                        resp = await client.post(
                            f"{API_URL}/api/structure", 
                            json={"transcript": final_transcript}
                        )
                        result = resp.json()
                        if result.get("status") == "success":
                            print("结构化分析成功！")
                            structured_data = result["data"]["structured_case"]
                            print("\n[提取出的病历要素]:")
                            for key, val in structured_data.items():
                                print(f"  - {key}: {val}")
                            print("\n[测试结论]: 录音 -> 转写 -> 结构化分析 全链路流转通过！")
                        else:
                            print(f"结构化分析失败: {result.get('detail')}")
                    except Exception as e:
                        print(f"结构化分析请求出错: {e}")
            else:
                print("\n[错误]: 未能获得最终转写文本，无法进行结构化分析测试。")
            
            if not received_any_text:
                print("\n[警告]: 测试期间未收到任何实时文本。请确认:")
                print("1. 麦克风是否正常工作")
                print("2. 讯飞 API 密钥是否正确配置")
                print("3. 是否有对着麦克风说话")

    except Exception as e:
        print(f"\nWebSocket 测试过程中出现错误: {e}")

if __name__ == "__main__":
    asyncio.run(test_recording_flow())
