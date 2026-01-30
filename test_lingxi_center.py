import asyncio
import json
from lingxi_engine import LingxiBuilder, MultiProviderEngine, MedicalLingxi
from ruiku_engine import RuikuEngine

async def main():
    print("🚀 灵犀 (Lingxi) 统一调度中心 - 商业化演示\n")

    # 1. 模拟多 Provider 配置 (主: DeepSeek, 备: Ollama)
    primary_provider = LingxiBuilder.provider_openai(api_key="invalid-key", base_url="https://api.deepseek.com", model="deepseek-chat")
    backup_provider = LingxiBuilder.provider_ollama(base_url="http://localhost:11434", model="llama3")
    
    # 构建调度引擎 (Dispatcher)
    dispatcher = MultiProviderEngine([primary_provider, backup_provider])
    
    # 构建灵犀引擎 (Engine)
    engine = LingxiBuilder.build(dispatcher)

    print("【1. 自动故障转移 (Failover) 测试】")
    print("正在尝试调用 (预期主 Provider 失败并自动切换)...")
    
    # 任务：分析一段病历摘要
    medical_text = "患者，男，45岁，主诉持续性头痛3天，伴恶心，无呕吐。"
    result = await engine.analyze(medical_text, template_name="summarize")
    
    if result["success"]:
        print(f"✅ 调用成功！响应来源: {result['provider']} ({result.get('model', 'unknown')})")
        print(f"📝 总结结果: {result['content']}\n")
    else:
        print(f"❌ 调用失败: {result['error']}\n")

    # 2. 医疗垂直领域适配测试
    print("【2. 医疗垂直领域 (Medical Adapter) 测试】")
    medical_brain = MedicalLingxi(engine)
    
    patient_data = {
        "patient_info": "张三, 男, 45岁",
        "chief_complaint": "持续性头痛3天",
        "history": "3天前无明显诱因出现头痛，呈胀痛感，休息后不缓解。",
        "examination": "血压 150/95mmHg, 神志清，病理征阴性。"
    }
    
    print("正在进行 AI 临床诊断推理...")
    diag_result = await medical_brain.diagnose(patient_data)
    
    if diag_result["success"]:
        print("✅ 诊断建议已生成:")
        print(diag_result["content"])
    else:
        print(f"❌ 诊断失败: {diag_result['error']}")

    # 3. 工具调用 (Function Calling) 测试
    print("\n【3. 工具调用 (Function Calling) 测试】")
    
    async def get_weather(location: str):
        print(f"   [System] 正在查询 {location} 的天气...")
        return {"location": location, "weather": "晴朗", "temperature": "25°C"}
    
    engine.register_tool(
        name="get_weather",
        description="查询指定地点的实时天气",
        parameters={
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "城市名称，如北京"}
            },
            "required": ["location"]
        },
        func=get_weather
    )
    
    print("询问 AI：北京天气怎么样？")
    tool_result = await engine.chat("北京天气怎么样？")
    if tool_result["success"]:
        print(f"✅ AI 回复: {tool_result['content']}")
    else:
        print(f"❌ 工具调用失败: {tool_result['error']}")

    # 4. 会话历史 (Context History) 测试
    print("\n【4. 会话历史 (History) 测试】")
    print("第一轮：你好，我是王医生。")
    await engine.chat("你好，我是王医生。")
    
    print("第二轮：我刚才说我姓什么？")
    history_result = await engine.chat("我刚才说我姓什么？")
    if history_result["success"]:
        print(f"✅ AI 回复: {history_result['content']}")
    else:
        print(f"❌ 历史记录测试失败: {history_result['error']}")

    # 5. 流式输出演示
    print("\n【5. 流式响应 (Streaming) 演示】")
    print("AI 正在思考中: ", end="", flush=True)
    async for chunk in engine.chat_stream("请用三句话介绍一下你自己。"):
        print(chunk, end="", flush=True)
    # 6. 瑞库 (Ruiku) 联动测试 - RAG
    print("\n【6. 瑞库 (Ruiku) 知识库联动 (RAG) 测试】")
    ruiku = RuikuEngine(storage_path="./test_knowledge")
    
    # 注入一些知识
    ruiku.add("感冒常用药物：对乙酰氨基酚、布洛芬、连花清瘟。", metadata={"type": "medical_guide"})
    ruiku.add("高血压饮食建议：低盐低脂，多吃芹菜、黑木耳。", metadata={"type": "medical_guide"})
    
    # 挂载瑞库到灵犀
    engine.set_memory(ruiku)
    print("已挂载瑞库知识库，询问关于感冒药的问题...")
    
    rag_result = await engine.chat("感冒了吃什么药比较好？", use_rag=True)
    if rag_result["success"]:
        print(f"✅ AI (基于瑞库知识) 回复: {rag_result['content']}")
    else:
        print(f"❌ RAG 测试失败: {rag_result['error']}")

    print("\n\n✨ 演示结束。")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"演示出错: {e}")
