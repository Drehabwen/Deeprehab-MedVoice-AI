import json
from openai import OpenAI
import httpx

class GenericOpenAILLM:
    def __init__(self, api_key, base_url, model, temperature=0.5, max_tokens=4096, proxy_url=None):
        http_client = None
        if proxy_url:
            http_client = httpx.Client(proxy=proxy_url)
        self.client = OpenAI(api_key=api_key, base_url=base_url, http_client=http_client)
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        
    def chat(self, query):
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": query}],
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )
            return {
                "content": response.choices[0].message.content,
                "success": True,
                "error": None
            }
        except Exception as e:
            return {
                "content": "",
                "success": False,
                "error": str(e)
            }

    def test_connection(self):
        return self.chat("hi")

class NLPProcessor:
    def __init__(self, config=None):
        self.config = config or {}
        
        temperature = float(self.config.get("llm_temperature", 0.5))
        max_tokens = int(self.config.get("llm_max_tokens", 4096))
        proxy_url = self.config.get("proxy_url", None)
        if proxy_url == "": proxy_url = None
        
        # 1. 初始化分析模型 (Base)
        self.model_base = self._init_model("base", temperature, max_tokens, proxy_url)
        # 2. 初始化生成模型 (Pro)
        self.model_pro = self._init_model("pro", temperature, max_tokens, proxy_url)

    def _init_model(self, type_prefix, temperature, max_tokens, proxy_url):
        """
        初始化 OpenAI 兼容模型 (DeepSeek 等)
        """
        api_key = self.config.get(f"llm_{type_prefix}_api_key", "")
        base_url = self.config.get(f"llm_{type_prefix}_base_url", "https://api.deepseek.com")
        model = self.config.get(f"llm_{type_prefix}_model", "deepseek-chat")
        
        return GenericOpenAILLM(api_key, base_url, model, temperature, max_tokens, proxy_url)

