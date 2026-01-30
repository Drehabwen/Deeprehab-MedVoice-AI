import unittest
import json
import os
import sys
from unittest.mock import Mock, patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from nlp_processor import NLPProcessor, GenericOpenAILLM

class TestGenericOpenAILLM(unittest.TestCase):
    @patch('nlp_processor.OpenAI')
    def test_chat_success(self, mock_openai):
        # 模拟 OpenAI 客户端
        mock_client = MagicMock()
        mock_openai.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="AI Response"))]
        mock_client.chat.completions.create.return_value = mock_response
        
        llm = GenericOpenAILLM(api_key="test", base_url="test", model="test")
        result = llm.chat("hello")
        
        self.assertTrue(result["success"])
        self.assertEqual(result["content"], "AI Response")
        self.assertIsNone(result["error"])

    @patch('nlp_processor.OpenAI')
    def test_chat_error(self, mock_openai):
        mock_client = MagicMock()
        mock_openai.return_value = mock_client
        mock_client.chat.completions.create.side_effect = Exception("API Error")
        
        llm = GenericOpenAILLM(api_key="test", base_url="test", model="test")
        result = llm.chat("hello")
        
        self.assertFalse(result["success"])
        self.assertEqual(result["error"], "API Error")

class TestNLPProcessor(unittest.TestCase):
    def test_initialization(self):
        config = {
            "llm_base_api_key": "key1",
            "llm_pro_api_key": "key2",
            "llm_temperature": 0.7
        }
        processor = NLPProcessor(config)
        self.assertEqual(processor.model_base.temperature, 0.7)
        self.assertEqual(processor.model_pro.temperature, 0.7)

if __name__ == "__main__":
    unittest.main()
