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

    def analyze_and_structure(self, input_data):
        """
        合并步骤：一键完成角色分析与病历结构化
        """
        if not input_data:
            return [], {}
            
        prompt = f"""你是一位极其专业的全科医生和医疗速记员。请根据以下原始转录文本，完成对话还原与病历结构化。

【第一部分：对话还原要求】
1. **角色标注**：识别说话人：[医生]、[患者]、[家属]。
2. **术语修正**：修正医疗词汇错误（如“血压高”->“高血压”）。
3. **内容提炼**：去除口癖，保持逻辑连贯。

【第二部分：病历结构化要求】
提取以下标准字段：
- 主诉：最主要原因及持续时间。
- 现病史：疾病发生、演变过程。
- 既往史：健康状况、过敏史等。
- 体格检查：提到的检查结果（血压、心率等）。
- 诊断建议：初步诊断意见。
- 处理意见：用药或检查计划。

【原始转录】
{input_data}

【输出格式要求】
必须输出标准的 JSON 对象，包含两个字段：
1. "analyzed_dialogue": 角色对话列表，格式为 [{{"speaker": "角色", "text": "内容"}}]。
2. "structured_case": 结构化病历对象，包含：主诉、现病史、既往史、体格检查、诊断建议、处理意见。

禁止任何开场白或解释。"""
        
        print(f"DEBUG: 正在进行一键式 AI 角色分析与病历结构化...")
        result = self.nlp.model_pro.chat(prompt)
        
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

    def generate_report(self, case_data, config):
        """
        根据病例数据生成正式的医疗报告/病历文书
        """
        hospital = config.get("hospital_name", "XX医院")
        doctor = config.get("doctor_name", "王医生")
        
        prompt = f"""你是一位资深的医疗病历书写专家。请根据以下提取的病例数据，生成一份正式、规范、专业的入院/门诊记录。
【医院名称】：{hospital}
【医生姓名】：{doctor}
【病例数据】：
{json.dumps(case_data, ensure_ascii=False, indent=2)}

【要求】：
1. 语言要医学化、专业化。
2. 包含医院名称、基本信息、主诉、现病史、既往史、查体、诊断、处理意见等标准板块。
3. 排版工整，直接输出正文内容。
4. 使用 Markdown 格式。"""
        
        print("DEBUG: 正在生成正式报告...")
        result = self.nlp.model_pro.chat(prompt)
        if result["success"]:
            return result["content"].strip()
        else:
            print(f"DEBUG: 报告生成失败: {result.get('error', '未知错误')}")
            return ""
