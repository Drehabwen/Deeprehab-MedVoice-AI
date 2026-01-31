import json

class CaseStructurer:
    def __init__(self, nlp_processor):
        self.nlp = nlp_processor

    def _clean_json_content(self, content, is_list=False):
        """
        通用的 JSON 强力清理工具
        """
        if not content:
            return ""
            
        json_str = content.strip()
        
        # 1. 处理 Markdown 代码块
        if "```" in json_str:
            import re
            # 尝试匹配 ```json ... ``` 或 ``` ... ```
            pattern = r"```(?:json)?\s*([\s\S]*?)\s*```"
            match = re.search(pattern, json_str)
            if match:
                json_str = match.group(1).strip()
        
        # 2. 尝试定位括号界定范围
        start_char = "[" if is_list else "{"
        end_char = "]" if is_list else "}"
        
        start_idx = json_str.find(start_char)
        end_idx = json_str.rfind(end_char)
        
        if start_idx != -1 and end_idx != -1:
            json_str = json_str[start_idx:end_idx+1]
            
        return json_str

    def analyze_and_structure(self, input_data, stream=False):
        if not input_data:
            if stream:
                return iter([])
            return [], {}
            
        prompt = f"""你是一名医疗速记员。分析以下对话，提取病历信息并标注角色。

【任务】
1. 角色标注：[医生]、[患者]、[家属]
2. 修正医学术语
3. 提取字段：主诉、现病史、既往史、体格检查、诊断建议、处理意见

【原始转录】
{input_data}

【输出格式】
JSON: {{"analyzed_dialogue": [{{"speaker": "角色", "text": "内容"}}], "structured_case": {{"主诉": "", "现病史": "", "既往史": "", "体格检查": "", "诊断建议": "", "处理意见": ""}}}}
仅输出JSON，无其他内容。"""
        
        print(f"DEBUG: 正在进行一键式 AI 角色分析与病历结构化...")
        result = self.nlp.model_pro.chat(prompt, stream=stream)
        
        if stream:
            if result["success"]:
                return result["content"]
            return iter([])
        else:
            if result["success"]:
                content = result["content"]
                try:
                    json_str = self._clean_json_content(content, is_list=False)
                    data = json.loads(json_str)
                    return data.get("analyzed_dialogue", []), data.get("structured_case", {})
                except Exception as e:
                    print(f"DEBUG: 综合分析解析失败: {e}")
                    return [], {}
            return [], {}

    def analyze_dialogue(self, input_data):
        """
        保留旧接口以兼容测试，底层调用新合并逻辑
        """
        dialogue, _ = self.analyze_and_structure(input_data)
        return dialogue

    def structure(self, dialogue_list):
        """
        保留旧接口以兼容测试，由于合并逻辑需要原始文本，此接口单独调用时会较慢
        """
        # 如果传入的是列表，说明是旧流程调用
        if isinstance(dialogue_list, list):
            dialogue_text = "\n".join([f"{d['speaker']}: {d['text']}" for d in dialogue_list])
            _, structured = self.analyze_and_structure(dialogue_text)
            return structured
        return {}

    def generate_suggestions(self, case_data):
        prompt = f"""根据病例提供临床建议：
{json.dumps(case_data, ensure_ascii=False, indent=2)}

要求：
1. 进一步检查建议
2. 用药注意事项  
3. 生活方式建议
4. Markdown列表格式
直接输出，无开场白。"""
        
        print("DEBUG: 正在生成 AI 临床建议...")
        result = self.nlp.model_pro.chat(prompt)
        if result["success"]:
            return result["content"].strip()
        else:
            print(f"DEBUG: 建议生成失败: {result.get('error', '未知错误')}")
            return ""

    def generate_report(self, case_data, config):
        hospital = config.get("hospital_name", "XX医院")
        doctor = config.get("doctor_name", "王医生")
        
        prompt = f"""生成病历报告：
医院：{hospital}，医生：{doctor}
{json.dumps(case_data, ensure_ascii=False, indent=2)}

要求：
1. 医学专业语言
2. 包含：基本信息、主诉、现病史、既往史、查体、诊断、处理意见
3. Markdown格式
直接输出，无开场白。"""
        
        print("DEBUG: 正在生成正式报告...")
        result = self.nlp.model_pro.chat(prompt)
        if result["success"]:
            return result["content"].strip()
        else:
            print(f"DEBUG: 报告生成失败: {result.get('error', '未知错误')}")
            return ""
