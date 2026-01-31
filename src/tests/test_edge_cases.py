
import unittest
import json
from unittest.mock import MagicMock
from case_structurer import CaseStructurer

class TestEdgeCases(unittest.TestCase):
    def setUp(self):
        self.mock_nlp = MagicMock()
        self.structurer = CaseStructurer(self.mock_nlp)

    def test_empty_input(self):
        """测试空输入情况"""
        # analyze_dialogue 处理空输入
        result = self.structurer.analyze_dialogue("")
        self.assertEqual(result, [])
        
        result = self.structurer.analyze_dialogue(None)
        self.assertEqual(result, [])

    def test_dirty_json_parsing(self):
        """测试包含杂质的 JSON 字符串清理"""
        dirty_json = "这里是一些废话 ```json\n{\"speaker\": \"医生\", \"text\": \"你好\"}\n``` 后面还有废话"
        cleaned = self.structurer._clean_json_content(dirty_json, is_list=False)
        self.assertEqual(cleaned, "{\"speaker\": \"医生\", \"text\": \"你好\"}")

        dirty_list = "文本开始 [{\"a\": 1}] 文本结束"
        cleaned_list = self.structurer._clean_json_content(dirty_list, is_list=True)
        self.assertEqual(cleaned_list, "[{\"a\": 1}]")

    def test_analyze_dialogue_fallback(self):
        """测试 analyze_dialogue 的降级逻辑（当 AI 返回非 JSON 格式但包含对话特征时）"""
        self.mock_nlp.model_base.chat.return_value = {
            "success": True,
            "content": "医生：最近哪里不舒服？\n患者：头有点疼。"
        }
        
        # 模拟 input_data 为字符串
        result = self.structurer.analyze_dialogue("原始转录文本")
        
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["speaker"], "医生")
        self.assertEqual(result[1]["speaker"], "患者")

    def test_structure_heuristic_extraction(self):
        """测试 structure 的启发式提取逻辑（当 JSON 解析彻底失败时）"""
        # 模拟 AI 返回了一个纯文本的 Markdown 病例，而不是 JSON
        markdown_content = """
        # 门诊病历
        姓名：张三
        性别：男
        年龄：45
        
        主诉：头痛三天。
        建议：建议查头颅CT。AI 建议：请及时就医。
        """
        self.mock_nlp.model_pro.chat.return_value = {
            "success": True,
            "content": markdown_content
        }
        
        result = self.structurer.structure([{"speaker": "医生", "text": "..."}])
        
        self.assertEqual(result["patient_name"], "张三")
        self.assertEqual(result["gender"], "男")
        self.assertEqual(result["age"], "45")
        self.assertIn("张三", result["markdown_content"])
        self.assertEqual(result["ai_suggestions"], "请及时就医。")

    def test_extreme_long_input(self):
        """测试超长输入（简单模拟，确保不崩溃）"""
        long_text = "对话内容" * 1000
        self.mock_nlp.model_base.chat.return_value = {"success": False, "error": "Timeout"}
        
        # 应该返回降级后的列表
        result = self.structurer.analyze_dialogue(long_text)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["speaker"], "系统")

if __name__ == "__main__":
    unittest.main()
