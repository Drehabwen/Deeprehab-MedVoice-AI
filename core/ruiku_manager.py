import json
import os
import re
from typing import Dict, List, Optional, Any, Callable, Union

class RuikuEngine:
    """
    瑞库 (Ruiku) - 极致抽象的通用智能知识引擎
    
    设计理念：
    1. Schema-Driven: 通过数据模式定义行为，业务逻辑即配置。
    2. Provider-Agnostic: 不绑定存储或 AI 厂商，只定义交互协议。
    3. Plug & Play: 零依赖，单文件，导入即用。
    """
    
    def __init__(self, storage_path: str, schema: Optional[Dict[str, Any]] = None):
        """
        :param storage_path: 数据存储路径 (本地目录)
        :param schema: 定义数据结构、搜索字段和统计维度
            示例: {
                "search_fields": ["title", "content"],
                "stats_dimensions": ["category", "tags"],
                "identity_field": "id"
            }
        """
        self.storage_path = storage_path
        self.index_file = os.path.join(storage_path, "index.json")
        self.schema = schema or {
            "search_fields": [],
            "stats_dimensions": [],
            "identity_field": "id"
        }
        self._init_storage()

    def _init_storage(self):
        if not os.path.exists(self.storage_path):
            os.makedirs(self.storage_path, exist_ok=True)

    def load(self) -> List[Dict[str, Any]]:
        """从存储加载所有项"""
        if not os.path.exists(self.index_file):
            return []
        try:
            with open(self.index_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else data.get("items", [])
        except:
            return []

    def commit(self, items: List[Dict[str, Any]]):
        """持久化数据"""
        with open(self.index_file, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)

    def add(self, item: Dict[str, Any]):
        """新增或更新一个项"""
        items = self.load()
        identity_field = self.schema.get("identity_field", "id")
        item_id = item.get(identity_field)
        
        if not item_id:
            return False
            
        # 查找是否存在，存在则更新，否则新增
        updated = False
        for i, existing in enumerate(items):
            if existing.get(identity_field) == item_id:
                items[i] = item
                updated = True
                break
        
        if not updated:
            items.append(item)
            
        self.commit(items)
        return True

    def query(self, text: str = "", filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        标准查询接口
        :param text: 关键词搜索
        :param filters: 精确匹配过滤器，如 {"category": "AI"}
        """
        items = self.load()
        results = items

        # 1. 处理过滤器
        if filters:
            results = [
                item for item in results 
                if all(item.get(k) == v for k, v in filters.items())
            ]

        # 2. 处理关键词搜索
        if text:
            text = text.lower()
            search_fields = self.schema.get("search_fields", [])
            if not search_fields and items:
                # 自动探索模式：如果没有定义搜索字段，则搜索所有字符串类型的字段
                search_fields = [k for k, v in items[0].items() if isinstance(v, str)]
            
            final_results = []
            for item in results:
                if any(text in str(item.get(f, "")).lower() for f in search_fields):
                    final_results.append(item)
            results = final_results

        return results

    def stats(self, dimension: Optional[str] = None) -> Dict[str, Any]:
        """
        标准化统计接口
        :param dimension: 统计维度，若不指定则按 schema 定义的第一个维度统计
        """
        items = self.load()
        dim = dimension or (self.schema.get("stats_dimensions", ["category"])[0] if self.schema.get("stats_dimensions") else "category")
        
        counts = {}
        for item in items:
            val = item.get(dim, "Unknown")
            # 处理列表类型的字段（如 tags）
            if isinstance(val, list):
                for v in val:
                    counts[str(v)] = counts.get(str(v), 0) + 1
            else:
                counts[str(val)] = counts.get(str(val), 0) + 1
                
        return {
            "dimension": dim,
            "total": len(items),
            "distribution": sorted(counts.items(), key=lambda x: x[1], reverse=True)
        }

    def suggest(self, context: str, scorer: Callable[[str, Dict], float], limit: int = 3) -> List[Dict[str, Any]]:
        """
        智能推荐接口
        :param context: 当前上下文内容
        :param scorer: 评分函数，用于计算相关度
        """
        items = self.load()
        scored = [(item, scorer(context, item)) for item in items]
        scored = [x for x in scored if x[1] > 0]
        scored.sort(key=lambda x: x[1], reverse=True)
        return [x[0] for x in scored[:limit]]

    def insight(self, ai_invoker: Callable[[str], str], topic: str, prompt_template: Optional[str] = None) -> str:
        """
        AI 洞察接口
        :param ai_invoker: 接收 Prompt 返回字符串的函数/方法
        :param topic: 分析主题
        :param prompt_template: 自定义 Prompt 模板
        """
        items = self.load()
        if not items: return "暂无数据可供分析。"

        # 限制数据量以防 Token 溢出，仅分析最近 20 条
        data_summary = json.dumps(items[:20], ensure_ascii=False, indent=2)
        default_template = f"你是一个专业的深度洞察分析师。请针对主题 '{topic}' 分析以下数据，找出潜在规律、风险或建议：\n\n数据：\n{{data}}"
        
        final_prompt = (prompt_template or default_template).format(data=data_summary)
        
        try:
            return ai_invoker(final_prompt)
        except Exception as e:
            return f"AI 洞察失败: {str(e)}"

# --- 业务适配层：展示如何将 RuikuEngine 应用于具体领域 ---

class MedicalCaseLibrary:
    """医疗病历库适配器"""
    def __init__(self, storage_or_config: Union[str, Dict[str, Any]]):
        # 兼容性处理：支持传入路径字符串或配置字典
        if isinstance(storage_or_config, dict):
            storage_path = storage_or_config.get("cases_dir", "./cases")
        else:
            storage_path = storage_or_config
            
        # 仅仅通过 Schema 就定义了医疗领域的业务逻辑
        schema = {
            "search_fields": ["patient_name", "diagnosis", "case_id", "complaint"],
            "stats_dimensions": ["diagnosis", "gender"],
            "identity_field": "case_id"
        }
        self.engine = RuikuEngine(storage_path, schema)

    def find_similar_cases(self, text: str):
        """基于症状和诊断的相似病历匹配"""
        def scorer(ctx, item):
            score = 0
            # 1. 诊断匹配 (高权重)
            diagnosis = item.get("diagnosis", "")
            if diagnosis and diagnosis in ctx: score += 10
            
            # 2. 关键词匹配
            keywords = re.findall(r'[\u4e00-\u9fa5]{2,}', ctx)
            for kw in keywords:
                if kw in str(item.get("complaint", "")): score += 2
                if kw in str(item.get("diagnosis", "")): score += 5
            return score
            
        return self.engine.suggest(text, scorer)

    def get_overview(self):
        """获取概览统计"""
        stats = self.engine.stats("diagnosis")
        # 适配旧版接口字段名
        return {
            "total_cases": stats["total"],
            "top_diagnoses": stats["distribution"],
            "total": stats["total"],
            "distribution": stats["distribution"]
        }

    def search(self, text: str):
        """搜索病历"""
        return self.engine.query(text)
        
    def get_ai_trends(self, ai_client):
        """趋势分析"""
        # 定义一个简单的适配器函数来调用 AI
        def ai_invoker(prompt):
            if hasattr(ai_client, "chat"):
                res = ai_client.chat(prompt)
                return res.get("content", str(res)) if isinstance(res, dict) else str(res)
            return str(ai_client(prompt))
            
        return self.engine.insight(ai_invoker, "临床病例分布与诊断趋势深度报告")

# 向后兼容别名
MedicalRuiku = MedicalCaseLibrary

# --- 使用示例 (README / Usage Examples) ---
"""
人人可用的 RuikuEngine 快速入门：

1. 基础用法 (通用知识库):
    engine = RuikuEngine("./my_data", schema={
        "search_fields": ["title", "content"],
        "identity_field": "id"
    })
    
    # 添加数据
    engine.add({"id": "001", "title": "瑞库介绍", "content": "这是一个通用的智能知识引擎。"})
    
    # 搜索
    results = engine.query("知识引擎")

2. AI 洞察 (集成任意模型):
    # 只要有一个接收字符串返回字符串的函数即可
    def my_ai(prompt):
        return "AI 分析结果: " + prompt[:10]
        
    insight = engine.insight(my_ai, "数据趋势分析")

3. 业务适配 (如医疗、法律、项目管理):
    class MyBusinessLibrary(MedicalCaseLibrary): # 可以继承适配器
        pass
"""

