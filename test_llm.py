import json
import os
import httpx
from openai import OpenAI

def load_config():
    with open("config.json", "r", encoding="utf-8") as f:
        return json.load(f)

def test_deepseek():
    config = load_config()
    api_key = config.get("llm_base_api_key")
    base_url = config.get("llm_base_base_url")
    model = config.get("llm_base_model")
    
    print(f"Testing DeepSeek API...")
    print(f"Base URL: {base_url}")
    print(f"Model: {model}")
    print(f"API Key: {api_key[:10]}...{api_key[-4:]}")
    
    client = OpenAI(api_key=api_key, base_url=base_url)
    
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=10
        )
        print("Success!")
        print(f"Response: {response.choices[0].message.content}")
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    test_deepseek()
