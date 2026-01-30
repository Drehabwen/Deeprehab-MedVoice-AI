import json
import asyncio
from typing import Any, Dict, List, Optional, Callable, Union, AsyncGenerator
from abc import ABC, abstractmethod
import httpx
from openai import OpenAI, AsyncOpenAI


class LLMProvider(ABC):
    """
    LLM Provider 抽象基类
    """

    @abstractmethod
    async def chat(
        self, 
        messages: List[Dict[str, str]], 
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        pass

    @abstractmethod
    async def chat_stream(self, messages: List[Dict[str, str]], **kwargs) -> AsyncGenerator[str, None]:
        pass

    @abstractmethod
    async def test_connection(self) -> Dict[str, Any]:
        pass


class OpenAIProvider(LLMProvider):
    """
    OpenAI 兼容 Provider (支持 DeepSeek、Qwen、Ollama 等)
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.openai.com/v1",
        model: str = "gpt-3.5-turbo",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        proxy_url: Optional[str] = None
    ):
        http_client = httpx.AsyncClient(proxy=proxy_url) if proxy_url else None
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url, http_client=http_client)
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens

    async def chat(
        self, 
        messages: List[Dict[str, str]], 
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        try:
            params = {
                "model": kwargs.get("model", self.model),
                "messages": messages,
                "temperature": kwargs.get("temperature", self.temperature),
                "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            }
            if tools:
                params["tools"] = tools
                if tool_choice:
                    params["tool_choice"] = tool_choice

            response = await self.client.chat.completions.create(**params)
            
            message = response.choices[0].message
            result = {
                "content": message.content,
                "success": True,
                "error": None,
                "provider": self.__class__.__name__,
                "model": self.model,
                "tool_calls": None
            }
            
            if hasattr(message, "tool_calls") and message.tool_calls:
                result["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": tc.type,
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    } for tc in message.tool_calls
                ]
                
            return result
        except Exception as e:
            return {
                "content": "",
                "success": False,
                "error": str(e),
                "provider": self.__class__.__name__
            }

    async def chat_stream(self, messages: List[Dict[str, str]], **kwargs) -> AsyncGenerator[str, None]:
        try:
            stream = await self.client.chat.completions.create(
                model=kwargs.get("model", self.model),
                messages=messages,
                temperature=kwargs.get("temperature", self.temperature),
                max_tokens=kwargs.get("max_tokens", self.max_tokens),
                stream=True
            )
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            yield f"Error: {str(e)}"

    async def test_connection(self) -> Dict[str, Any]:
        return await self.chat([{"role": "user", "content": "hi"}])


class OllamaProvider(LLMProvider):
    """
    Ollama 本地模型 Provider
    """

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "llama3",
        temperature: float = 0.7,
        max_tokens: int = 4096
    ):
        self.base_url = base_url
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.http_client = httpx.AsyncClient(timeout=60.0)

    async def chat(
        self, 
        messages: List[Dict[str, str]], 
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        try:
            payload = {
                "model": kwargs.get("model", self.model),
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": kwargs.get("temperature", self.temperature),
                    "num_predict": kwargs.get("max_tokens", self.max_tokens)
                }
            }
            if tools:
                payload["tools"] = tools # Ollama 0.1.40+ 支持 tools
                
            response = await self.http_client.post(
                f"{self.base_url}/api/chat",
                json=payload
            )
            response.raise_for_status()
            data = response.json()
            message = data.get("message", {})
            
            result = {
                "content": message.get("content", ""),
                "success": True,
                "error": None,
                "provider": self.__class__.__name__,
                "model": self.model,
                "tool_calls": message.get("tool_calls")
            }
            return result
        except Exception as e:
            return {
                "content": "",
                "success": False,
                "error": str(e),
                "provider": self.__class__.__name__
            }

    async def chat_stream(self, messages: List[Dict[str, str]], **kwargs) -> AsyncGenerator[str, None]:
        try:
            async with self.http_client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={
                    "model": kwargs.get("model", self.model),
                    "messages": messages,
                    "stream": True,
                    "options": {
                        "temperature": kwargs.get("temperature", self.temperature),
                        "num_predict": kwargs.get("max_tokens", self.max_tokens)
                    }
                }
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        data = json.loads(line)
                        if data.get("message", {}).get("content"):
                            yield data["message"]["content"]
                        if data.get("done"):
                            break
        except Exception as e:
            yield f"Error: {str(e)}"

    async def test_connection(self) -> Dict[str, Any]:
        return await self.chat([{"role": "user", "content": "hi"}])


class MultiProviderEngine(LLMProvider):
    """
    多 Provider 调度引擎 (调度中心)
    支持主备切换、负载均衡逻辑
    """

    def __init__(self, providers: List[LLMProvider]):
        self.providers = providers

    async def chat(
        self, 
        messages: List[Dict[str, str]], 
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        last_error = None
        for provider in self.providers:
            result = await provider.chat(messages, tools=tools, tool_choice=tool_choice, **kwargs)
            if result["success"]:
                return result
            last_error = result["error"]
            print(f"[Lingxi] Provider {provider.__class__.__name__} 失败: {last_error}, 尝试下一个...")
        
        return {
            "content": "",
            "success": False,
            "error": f"所有 Provider 均调用失败。最后一次错误: {last_error}",
            "provider": "MultiProviderEngine"
        }

    async def chat_stream(self, messages: List[Dict[str, str]], **kwargs) -> AsyncGenerator[str, None]:
        # 流式调用暂不支持自动 failover（因为已经开始输出了），默认使用第一个
        if self.providers:
            async for chunk in self.providers[0].chat_stream(messages, **kwargs):
                yield chunk

    async def test_connection(self) -> Dict[str, Any]:
        return await self.chat([{"role": "user", "content": "hi"}])


class PromptTemplate:
    """
    Prompt 模板管理器
    支持变量插值和链式组合
    """

    def __init__(self, template: str, variables: Optional[List[str]] = None):
        self.template = template
        self.variables = variables or self._extract_variables(template)

    def _extract_variables(self, template: str) -> List[str]:
        import re
        return list(set(re.findall(r"\{(\w+)\}", template)))

    def render(self, **kwargs) -> str:
        return self.template.format(**kwargs)

    def to_message(self, role: str = "user", **kwargs) -> Dict[str, str]:
        return {"role": role, "content": self.render(**kwargs)}


class TemplateLibrary:
    """
    Prompt 模板库
    集中管理所有预置模板
    """

    def __init__(self):
        self.templates: Dict[str, PromptTemplate] = {}
        self._init_default_templates()

    def _init_default_templates(self):
        """
        初始化默认模板库
        """
        self.templates.update({
            "summarize": PromptTemplate(
                "请总结以下内容的核心要点：\n\n{content}",
                variables=["content"]
            ),
            "extract_structured": PromptTemplate(
                """请从以下文本中提取结构化信息：
任务目标：{goal}
输入文本：{content}

输出要求：
- 仅输出 JSON 格式
- 字段必须包含：{fields}
""",
                variables=["goal", "content", "fields"]
            ),
            "dialogue_to_structured": PromptTemplate(
                """你是一位资深的医疗病历书写专家。请根据以下医患对话，完成三个任务：
1. 提取患者基本信息（姓名、性别、年龄）。
2. 撰写一份符合医学文书规范的标准化病例。
3. 提供基于该对话的"AI 临床建议"。

【对话内容】
{dialogue}

【输出要求】
必须直接输出一个 JSON 对象，包含以下字段：
{{
  "patient_name": "姓名",
  "gender": "男/女",
  "age": "年龄数字",
  "markdown_content": "完整的 Markdown 格式病例正文",
  "ai_suggestions": "AI 临床建议内容"
}}
""",
                variables=["dialogue"]
            ),
            "rag_enhanced_qa": PromptTemplate(
                """你是一个专业的知识助手。请基于以下上下文回答用户的问题。

【上下文信息】
{context}

【用户问题】
{question}

【回答要求】
1. 优先基于上下文信息回答
2. 如果上下文中没有相关信息，请明确说明
3. 保持专业、准确、简洁
""",
                variables=["context", "question"]
            ),
            "synthesis": PromptTemplate(
                """请对以下多个文档进行综合分析，生成一份深度综述。

【文档列表】
{documents}

【综述要求】
1. 提取所有文档的核心主题和关键观点
2. 识别文档之间的关联和矛盾
3. 生成一份结构化的综述报告，包含：
   - 核心主题摘要
   - 关键发现
   - 关联分析
   - 建议结论
""",
                variables=["documents"]
            )
        })

    def get(self, name: str) -> Optional[PromptTemplate]:
        return self.templates.get(name)

    def add(self, name: str, template: PromptTemplate):
        self.templates[name] = template

    def list_templates(self) -> List[str]:
        return list(self.templates.keys())


class Tool:
    """
    工具定义装饰器和辅助类
    """
    @staticmethod
    def define(name: str, description: str, parameters: Dict[str, Any]):
        """
        定义一个工具的 JSON Schema
        """
        return {
            "type": "function",
            "function": {
                "name": name,
                "description": description,
                "parameters": parameters
            }
        }


class ContextMemory:
    """
    会话历史上下文管理器
    """
    def __init__(self, max_messages: int = 20):
        self.messages: List[Dict[str, str]] = []
        self.max_messages = max_messages

    def add(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})
        if len(self.messages) > self.max_messages:
            # 保持系统提示词（如果有）并修剪中间的消息
            if self.messages[0]["role"] == "system":
                self.messages = [self.messages[0]] + self.messages[-(self.max_messages-1):]
            else:
                self.messages = self.messages[-self.max_messages:]

    def get_messages(self) -> List[Dict[str, str]]:
        return self.messages

    def clear(self):
        self.messages = []


class LingxiEngine:
    """
    灵犀 - 极致抽象的通用逻辑引擎
    设计理念：
    1. Provider-Agnostic: 统一抽象层，支持多种 LLM Provider
    2. Template-Driven: Prompt 模板化，支持变量插值和链式组合
    3. Memory-Aware: 原生支持与 RuikuEngine 的记忆联动
    4. Zero-Dependency: 零依赖，单文件，导入即用
    """

    def __init__(
        self,
        provider: LLMProvider,
        templates: Optional[TemplateLibrary] = None,
        max_history: int = 20
    ):
        self.provider = provider
        self.templates = templates or TemplateLibrary()
        self.memory = None # 瑞库引擎 (RAG)
        self.context = ContextMemory(max_history) # 会话历史
        self.tools: Dict[str, Dict[str, Any]] = {} # 工具定义 {name: {"func": callable, "schema": dict}}

    def set_memory(self, memory_engine):
        """
        挂载记忆引擎 (RuikuEngine)
        """
        self.memory = memory_engine

    def register_tool(self, name: str, func: Callable, description: str, parameters: Dict[str, Any]):
        """
        注册工具函数及其 Schema
        """
        self.tools[name] = {
            "func": func,
            "schema": Tool.define(name, description, parameters)
        }

    async def chat(
        self,
        messages: Union[str, List[Dict[str, str]]],
        use_rag: bool = False,
        rag_top_k: int = 5,
        use_history: bool = True,
        execute_tools: bool = True,
        **kwargs
    ) -> Dict[str, Any]:
        """
        增强版聊天接口：支持 RAG、历史记录和工具自动执行
        """
        # 1. 处理输入消息
        current_messages = []
        if isinstance(messages, str):
            user_content = messages
            if use_history:
                current_messages = self.context.get_messages().copy()
            current_messages.append({"role": "user", "content": user_content})
        else:
            current_messages = messages.copy()

        # 2. RAG 增强
        if use_rag and self.memory:
            user_query = current_messages[-1]["content"]
            context_text = await self._retrieve_context(user_query, top_k=rag_top_k)
            if context_text:
                rag_template = self.templates.get("rag_enhanced_qa")
                current_messages[-1] = rag_template.to_message(context=context_text, question=user_query)

        # 3. 准备工具
        # 优先使用注册的工具，除非 kwargs 中明确指定了 tools
        final_tools = kwargs.pop("tools", None) or ([t["schema"] for t in self.tools.values()] if self.tools else None)

        # 4. 调用 Provider
        response = await self.provider.chat(current_messages, tools=final_tools, **kwargs)

        # 5. 处理响应与工具执行
        if response["success"]:
            # 记录历史
            if use_history and isinstance(messages, str):
                self.context.add("user", user_content)
                if response["content"]:
                    self.context.add("assistant", response["content"])

            # 自动执行工具
            if execute_tools and response.get("tool_calls"):
                tool_results = []
                for tc in response["tool_calls"]:
                    tool_name = tc["function"]["name"]
                    if tool_name in self.tools:
                        try:
                            args = json.loads(tc["function"]["arguments"])
                            print(f"[Lingxi] 执行工具: {tool_name}({args})")
                            func = self.tools[tool_name]["func"]
                            result = await func(**args) if asyncio.iscoroutinefunction(func) else func(**args)
                            
                            tool_results.append({
                                "tool_call_id": tc["id"],
                                "role": "tool",
                                "name": tool_name,
                                "content": json.dumps(result, ensure_ascii=False)
                            })
                        except Exception as e:
                            print(f"[Lingxi] 工具执行失败: {tool_name}, 错误: {e}")

                if tool_results:
                    # 将工具执行结果喂回 LLM
                    current_messages.append({
                        "role": "assistant",
                        "content": response["content"],
                        "tool_calls": response["tool_calls"]
                    })
                    current_messages.extend(tool_results)
                    # 递归调用 chat 获取最终回复
                    return await self.chat(current_messages, use_rag=False, use_history=use_history, execute_tools=execute_tools, **kwargs)

        return response

    async def chat_stream(
        self,
        messages: Union[str, List[Dict[str, str]]],
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        流式聊天接口
        """
        if isinstance(messages, str):
            messages = [{"role": "user", "content": messages}]
        
        async for chunk in self.provider.chat_stream(messages, **kwargs):
            yield chunk

    async def think(
        self,
        task: str,
        template_name: Optional[str] = None,
        template_vars: Optional[Dict[str, Any]] = None,
        use_memory: bool = True,
        **kwargs
    ) -> Dict[str, Any]:
        """
        思考接口 - 更高层次的推理入口
        """
        messages = []

        if use_memory and self.memory:
            context = await self._retrieve_context(task, top_k=3)
            if context:
                messages.append({
                    "role": "system",
                    "content": f"以下是相关的上下文信息：\n\n{context}"
                })

        if template_name and self.templates.get(template_name):
            template = self.templates.get(template_name)
            vars_dict = template_vars or {}
            messages.append(template.to_message(**vars_dict))
        else:
            messages.append({"role": "user", "content": task})

        result = await self.provider.chat(messages, **kwargs)
        return result

    async def _retrieve_context(self, query: str, top_k: int = 5) -> str:
        """
        从记忆引擎检索相关上下文
        """
        if not self.memory:
            return ""

        try:
            # 兼容旧版本和新版本的 RuikuEngine
            if hasattr(self.memory, "query"):
                results = await self.memory.query(query, limit=top_k) if asyncio.iscoroutinefunction(self.memory.query) else self.memory.query(query, limit=top_k)
            elif hasattr(self.memory, "search"):
                results = await self.memory.search(query, limit=top_k) if asyncio.iscoroutinefunction(self.memory.search) else self.memory.search(query, limit=top_k)
            else:
                return ""

            if not results:
                return ""

            context_parts = []
            for item in results:
                if isinstance(item, dict):
                    content = item.get("content", item.get("text", str(item)))
                else:
                    content = str(item)
                context_parts.append(content)

            return "\n\n---\n\n".join(context_parts)
        except Exception as e:
            print(f"[Lingxi] 记忆检索失败: {e}")
            return ""

    async def analyze(
        self,
        input_data: Any,
        template_name: str = "summarize",
        **kwargs
    ) -> Dict[str, Any]:
        """
        分析接口 - 使用模板对输入数据进行分析
        """
        template = self.templates.get(template_name)
        if not template:
            return {"content": "", "success": False, "error": f"模板不存在: {template_name}"}

        if isinstance(input_data, (list, dict)):
            input_str = json.dumps(input_data, ensure_ascii=False, indent=2)
        else:
            input_str = str(input_data)

        return await self.chat(template.render(content=input_str), **kwargs)

    async def test(self) -> Dict[str, Any]:
        """
        测试引擎连接和功能
        """
        results = {
            "provider": self.provider.__class__.__name__,
            "connection": await self.provider.test_connection(),
            "templates": len(self.templates.list_templates()),
            "memory_connected": self.memory is not None,
            "tools_registered": list(self.tools.keys())
        }
        return results

    def synthesize(
        self,
        documents: List[Any],
        focus: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        综合接口 - 对多个文档进行综合分析
        """
        if not documents:
            return {"content": "", "success": False, "error": "文档列表为空"}

        documents_text = ""
        for i, doc in enumerate(documents, 1):
            if isinstance(doc, dict):
                doc_str = json.dumps(doc, ensure_ascii=False, indent=2)
            else:
                doc_str = str(doc)
            documents_text += f"【文档 {i}】\n{doc_str}\n\n"

        task = documents_text
        if focus:
            task += f"\n\n【关注焦点】{focus}"

        return self.think(task, template_name="synthesis", template_vars={"documents": documents_text}, **kwargs)

    def test(self) -> Dict[str, Any]:
        """
        测试引擎连接和功能
        """
        results = {
            "provider": self.provider.__class__.__name__,
            "connection": self.provider.test_connection(),
            "templates": len(self.templates.list_templates()),
            "memory_connected": self.memory is not None,
            "tools_registered": list(self.tools.keys())
        }
        return results


class LingxiBuilder:
    """
    灵犀引擎构建器 - 提供便捷的构建接口
    """

    @staticmethod
    def provider_openai(api_key: str, base_url: str = "https://api.openai.com/v1", model: str = "gpt-3.5-turbo", **kwargs) -> OpenAIProvider:
        return OpenAIProvider(api_key, base_url, model, **kwargs)

    @staticmethod
    def provider_ollama(base_url: str = "http://localhost:11434", model: str = "llama3", **kwargs) -> OllamaProvider:
        return OllamaProvider(base_url, model, **kwargs)

    @staticmethod
    def dispatcher(providers: List[LLMProvider]) -> MultiProviderEngine:
        return MultiProviderEngine(providers)

    @staticmethod
    def build(provider: LLMProvider, **kwargs) -> LingxiEngine:
        return LingxiEngine(provider, **kwargs)

    # 快捷方法保持返回 LingxiEngine 以便链式调用，但修正内部逻辑
    @staticmethod
    def openai(api_key: str, **kwargs) -> LingxiEngine:
        return LingxiEngine(OpenAIProvider(api_key, **kwargs))

    @staticmethod
    def deepseek(api_key: str, **kwargs) -> LingxiEngine:
        base_url = kwargs.pop("base_url", "https://api.deepseek.com")
        model = kwargs.pop("model", "deepseek-chat")
        return LingxiEngine(OpenAIProvider(api_key, base_url=base_url, model=model, **kwargs))

    @staticmethod
    def ollama(base_url: str = "http://localhost:11434", model: str = "llama3", **kwargs) -> LingxiEngine:
        return LingxiEngine(OllamaProvider(base_url, model, **kwargs))


class MedicalLingxi:
    """
    医疗领域专用灵犀 - 行业适配器示例
    """

    def __init__(self, base_engine: LingxiEngine):
        self.engine = base_engine
        self._init_medical_templates()

    def _init_medical_templates(self):
        """
        初始化医疗专用 Prompt 模板
        """
        medical_templates = {
            "clinical_diagnosis": PromptTemplate(
                """你是一位资深临床医生。请基于以下信息提供诊断建议：

【患者信息】
{patient_info}

【主诉】
{chief_complaint}

【现病史】
{history}

【体格检查】
{examination}

【诊断建议要求】
1. 提供初步诊断（1-3 个）
2. 列出鉴别诊断
3. 建议进一步检查
4. 治疗方案建议

输出格式：JSON，包含 diagnosis, differential_diagnosis, recommended_tests, treatment_plan
""",
                variables=["patient_info", "chief_complaint", "history", "examination"]
            ),
            "medical_qa": PromptTemplate(
                """你是一位医学专家。请回答以下医学问题：

【问题】
{question}

【回答要求】
1. 基于循证医学原则
2. 提供准确、专业的解释
3. 如有争议点，请说明
4. 注明"仅供参考，请咨询专业医生"
""",
                variables=["question"]
            )
        }

        for name, template in medical_templates.items():
            self.engine.templates.add(name, template)

    def diagnose(self, patient_data: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """
        医疗诊断推理
        """
        return self.engine.think(
            "",
            template_name="clinical_diagnosis",
            template_vars=patient_data,
            **kwargs
        )

    def medical_qa(self, question: str, **kwargs) -> Dict[str, Any]:
        """
        医学问答
        """
        return self.engine.think(
            "",
            template_name="medical_qa",
            template_vars={"question": question},
            **kwargs
        )


class Lingxi:
    """
    Lingxi 别名 - 向后兼容
    """
    def __new__(cls, *args, **kwargs):
        return LingxiEngine(*args, **kwargs)


if __name__ == "__main__":
    print("=== 灵犀 (Lingxi) - 通用逻辑引擎 ===\n")

    print("【使用示例 1: DeepSeek Provider】")
    engine = LingxiBuilder.deepseek(
        api_key="your-api-key",
        model="deepseek-chat"
    )
    print(f"引擎测试: {engine.test()}")

    print("\n【使用示例 2: Prompt 模板】")
    template = PromptTemplate("你好，{name}！今天天气如何？")
    print(f"渲染结果: {template.render(name='张三')}")

    print("\n【使用示例 3: 医疗领域适配】")
    medical_engine = MedicalLingxi(engine)
    print(f"可用模板: {engine.templates.list_templates()}")

    print("\n【使用示例 4: 与瑞库联动】")
    print("lingxi.set_memory(ruiku_engine)  # 挂载瑞库引擎")
    print("result = lingxi.think('患者张三的病历', use_memory=True)")
