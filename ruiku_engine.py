import json
import os
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

class RuikuEngine:
    """
    瑞库 - 通用知识库引擎 (Schema-Driven)
    设计理念：
    1. Schema-Driven: 通过配置定义存储结构，适应不同场景（医疗、法律、个人知识等）
    2. Zero-Dependency: 仅依赖标准库，易于移植和部署
    3. Memory-Interface: 提供标准的 query/search 接口，对接 LLM
    """

    def __init__(self, storage_path: str, schema: Optional[Dict[str, Any]] = None):
        self.storage_path = storage_path
        self.index_file = os.path.join(storage_path, "index.json")
        self.schema = schema or {
            "name": "DefaultKnowledgeBase",
            "search_fields": ["content", "title"],
            "stats_dimensions": ["type"],
            "identity_field": "id"
        }
        self._init_storage()

    def _init_storage(self):
        """初始化存储目录和索引文件"""
        if not os.path.exists(self.storage_path):
            os.makedirs(self.storage_path)
        
        if not os.path.exists(self.index_file):
            self._save_index({"items": [], "metadata": {"created_at": str(datetime.now())}})

    def _load_index(self) -> Dict[str, Any]:
        with open(self.index_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_index(self, data: Dict[str, Any]):
        with open(self.index_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def add(self, content: Union[str, Dict[str, Any]], metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        向知识库添加内容
        """
        index_data = self._load_index()
        item_id = str(len(index_data["items"]) + 1).zfill(6)
        
        if isinstance(content, str):
            item_content = content
            item_data = {"id": item_id, "content": item_content}
        else:
            item_data = content
            if "id" not in item_data:
                item_data["id"] = item_id
            item_content = json.dumps(item_data, ensure_ascii=False)

        if metadata:
            item_data.update(metadata)
        
        item_data["_timestamp"] = str(datetime.now())
        
        # 保存具体文件
        file_path = os.path.join(self.storage_path, f"{item_data['id']}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(item_data, f, ensure_ascii=False, indent=2)
            
        # 更新索引
        summary = {k: v for k, v in item_data.items() if k in self.schema["search_fields"] or k == "id"}
        summary["_file"] = f"{item_data['id']}.json"
        index_data["items"].append(summary)
        self._save_index(index_data)
        
        return item_data["id"]

    def query(self, text: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        简单的关键词检索 (模拟向量搜索接口)
        """
        index_data = self._load_index()
        results = []
        
        search_terms = text.lower().split()
        
        for item in index_data["items"]:
            score = 0
            for field in self.schema["search_fields"]:
                field_val = str(item.get(field, "")).lower()
                for term in search_terms:
                    if term in field_val:
                        score += 1
            
            if score > 0:
                # 加载完整内容
                file_path = os.path.join(self.storage_path, item["_file"])
                if os.path.exists(file_path):
                    with open(file_path, "r", encoding="utf-8") as f:
                        full_item = json.load(f)
                        full_item["_score"] = score
                        results.append(full_item)
        
        # 按分数排序
        results.sort(key=lambda x: x["_score"], reverse=True)
        return results[:limit]

    def get_stats(self) -> Dict[str, Any]:
        """获取知识库统计信息"""
        index_data = self._load_index()
        stats = {
            "total_count": len(index_data["items"]),
            "dimensions": {}
        }
        
        for dim in self.schema["stats_dimensions"]:
            dim_stats = {}
            for item in index_data["items"]:
                val = item.get(dim, "unknown")
                dim_stats[val] = dim_stats.get(val, 0) + 1
            stats["dimensions"][dim] = dim_stats
            
        return stats
