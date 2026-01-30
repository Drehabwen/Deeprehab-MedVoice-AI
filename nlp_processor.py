import json
from lingxi_engine import LingxiBuilder, LingxiEngine
import httpx
import os

class NLPProcessor:
    def __init__(self, config=None):
        self.config = config or {}
        self.engine = self._init_lingxi_engine()

    def _init_lingxi_engine(self) -> LingxiEngine:
        """
        使用灵犀引擎 (LingxiEngine) 统一调度 LLM
        """
        # 1. 获取主备配置
        p_api_key = self.config.get("llm_base_api_key") or self.config.get("llm_pro_api_key", "")
        p_base_url = self.config.get("llm_base_base_url") or self.config.get("llm_pro_base_url", "https://api.deepseek.com")
        p_model = self.config.get("llm_base_model") or self.config.get("llm_pro_model", "deepseek-chat")
        
        b_base_url = self.config.get("llm_backup_base_url", "http://localhost:11434")
        b_model = self.config.get("llm_backup_model", "llama3")

        # 2. 构建 Provider
        providers = []
        if p_api_key:
            providers.append(LingxiBuilder.provider_openai(
                api_key=p_api_key, 
                base_url=p_base_url, 
                model=p_model
            ))
        
        # 总是添加 Ollama 作为本地备份（如果配置了）
        providers.append(LingxiBuilder.provider_ollama(
            base_url=b_base_url,
            model=b_model
        ))

        # 3. 构建引擎
        dispatcher = LingxiBuilder.dispatcher(providers)
        engine = LingxiBuilder.build(dispatcher)
        
        # 4. 注册医疗专用模板或工具 (可选)
        # 这里可以预留一些工具注册逻辑
        
        return engine

    def chat(self, query, use_history=True, use_rag=False):
        """
        统一的聊天接口，对接灵犀引擎
        """
        import asyncio
        
        # 检查是否在异步环境中运行
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        # 包装异步调用
        coro = self.engine.chat(query, use_history=use_history, use_rag=use_rag)
        
        if loop.is_running():
            # 如果已经在运行（如在某些复杂的 GUI 线程中），可能需要特殊处理
            # 但在标准的 threading.Thread 中，我们可以使用 run_coroutine_threadsafe 或新的 loop
            import threading
            result_container = []
            def run_in_new_loop():
                new_loop = asyncio.new_event_loop()
                asyncio.set_event_loop(new_loop)
                res = new_loop.run_until_complete(coro)
                result_container.append(res)
                new_loop.close()
            
            t = threading.Thread(target=run_in_new_loop)
            t.start()
            t.join()
            return result_container[0] if result_container else {"success": False, "error": "Timeout or execution error"}
        else:
            return loop.run_until_complete(coro)

    def reset_history(self):
        """重置对话上下文"""
        self.engine.clear_history()

    def test_connection(self):
        return self.chat("hi", use_history=False)

