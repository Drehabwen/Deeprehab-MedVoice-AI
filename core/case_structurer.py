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

    def analyze_dialogue(self, input_data):
        """
        第一步：角色分离节点 (Node 2)
        任务：仅将原始文本或初步转录内容整理为清晰的 [角色]: [对话内容] 格式列表
        """
        if not input_data:
            return []
            
        if isinstance(input_data, list):
            # 如果已经是列表，说明 ASR 已经尝试过角色分离，此时 AI 仅负责校验和格式统一
            prompt = f"""你是一位医疗对话整理助手。请对以下初步分好角色的对话进行深度校验与优化：

【优化任务】
1. **逻辑校验**：根据语境判断“医生”和“患者”的标签是否分配准确，修正归属错误。
2. **文本精简**：合并同一人连续的、语义碎片化的对话；去除冗余的语气词。
3. **格式规范**：确保输出为干净的 JSON 数组，无多余层级。

【初步对话数据】
{json.dumps(input_data, ensure_ascii=False, indent=2)}

【输出要求】
仅输出 JSON，不要有任何其他解释。格式：[{{"speaker": "医生", "text": "内容"}}, ...]"""
        else:
            # 如果是原始文本字符串
            prompt = f"""你是一位资深的医疗对话整理助手。请将以下原始语音转录文本精准地整理为“医生”和“患者”之间的对话列表。

【任务目标】
1. **角色识别**：根据语气、内容和医学逻辑，准确识别说话人（医生/患者）。
2. **文本清洗**：去除重复的字词、无意义的口癖（如：啊、那个、就是、嗯）。
3. **断句合并**：将属于同一个人的连续陈述合并为完整的段落。
4. **保持原意**：不要删减核心医疗信息，保留口语中的关键细节。

【原始文本】
{input_data}

【输出格式】
必须输出标准的 JSON 数组格式，禁止任何开场白 or 解释。
格式示例：
[
  {{"speaker": "医生", "text": "内容"}},
  {{"speaker": "患者", "text": "内容"}}
]"""
        
        print(f"DEBUG: 正在发送角色分离请求 (Node 2)...")
        result = self.nlp.model_base.chat(prompt)
        
        if result["success"]:
            content = result["content"]
            try:
                json_str = self._clean_json_content(content, is_list=True)
                return json.loads(json_str)
            except Exception as e:
                print(f"DEBUG: 角色分离解析失败: {e}, 原始内容: {content[:100]}...")
                # 终极降级：如果 JSON 彻底失败，但内容包含对话特征，尝试按行简单分割
                if isinstance(input_data, str) and ("医生" in content or "患者" in content):
                    lines = content.strip().split('\n')
                    fallback_list = []
                    for line in lines:
                        if "：" in line or ":" in line:
                            parts = line.replace(":", "：").split("：", 1)
                            fallback_list.append({"speaker": parts[0].strip(), "text": parts[1].strip()})
                    if fallback_list: return fallback_list
                
                if isinstance(input_data, str):
                    return [{"speaker": "系统", "text": input_data}]
                return input_data
        else:
            print(f"DEBUG: 角色分离请求失败: {result.get('error')}")
            if isinstance(input_data, str):
                return [{"speaker": "系统", "text": input_data}]
            return input_data if isinstance(input_data, list) else []

    def structure(self, speaker_dialogues):
        """
        第二步：将对话转化为结构化数据、规范病例正文以及 AI 临床建议
        """
        dialogue_text = ""
        for item in speaker_dialogues:
            dialogue_text += f"{item.get('speaker', '未知')}: {item.get('text', '')}\n"

        prompt = f"""你是一位资深的医疗病历书写专家与临床顾问。请根据以下医患对话，完成三个任务：
1. 提取患者基本信息（姓名、性别、年龄）。
2. 撰写一份符合医学文书规范的标准化病例。
3. 提供基于该对话的“AI 临床建议”（包括可能的诊断方向、检查建议或治疗提醒）。

【对话内容】
{dialogue_text}

【病例撰写要求】
- 包含：主诉、现病史、既往史、体格检查、初步诊断、处理意见。
- 语言要专业、精炼，符合病历书写规范。
- 如果某项内容在对话中未涉及，请标注为“未见异常”或“未诉”。
- 使用 Markdown 格式排版。

【AI 建议要求】
- 基于对话内容给出专业的临床辅助建议。
- 必须注明“该建议由 AI 生成，仅供医生参考”。

【输出要求】
必须直接输出一个 JSON 对象，包含以下字段：
{{
  "patient_name": "姓名",
  "gender": "男/女",
  "age": "年龄数字",
  "markdown_content": "完整的 Markdown 格式病例正文",
  "ai_suggestions": "AI 临床建议内容（包含来源说明）"
}}
不要输出任何其他文字或说明。"""
        
        print("DEBUG: 正在发送病例结构化请求...")
        result = self.nlp.model_pro.chat(prompt)
        
        if result["success"]:
            content = result["content"]
            try:
                json_str = self._clean_json_content(content, is_list=False)
                return json.loads(json_str)
            except Exception as e:
                print(f"DEBUG: 病例结构化 JSON 解析失败: {e}, 响应内容: {content[:100]}...")
                
                # 启发式提取：即使 JSON 失败，如果内容看起来像 Markdown，尝试从中提取
                extracted_data = {
                    "patient_name": "",
                    "gender": "男",
                    "age": "",
                    "markdown_content": content,
                    "ai_suggestions": ""
                }
                
                # 简单正则提取姓名、年龄
                import re
                name_match = re.search(r"姓名[：:]\s*([^\n\s,，]+)", content)
                if name_match: extracted_data["patient_name"] = name_match.group(1)
                
                age_match = re.search(r"年龄[：:]\s*(\d+)", content)
                if age_match: extracted_data["age"] = age_match.group(1)
                
                gender_match = re.search(r"性别[：:]\s*(男|女)", content)
                if gender_match: extracted_data["gender"] = gender_match.group(1)
                
                if "建议" in content:
                    # 优先匹配 AI 建议
                    ai_match = re.search(r"(?:AI\s*建议|AI\s*临床建议)[：:]\s*([\s\S]+)", content)
                    if ai_match:
                        extracted_data["ai_suggestions"] = ai_match.group(1).strip()
                    else:
                        # 退而求其次
                        parts = re.split(r"建议[：:]", content, maxsplit=1)
                        if len(parts) > 1:
                            extracted_data["ai_suggestions"] = parts[1].strip()
                        
                return extracted_data
        else:
            print(f"DEBUG: 病例结构化请求失败: {result.get('error', '未知错误')}")
            return {
                "patient_name": "",
                "gender": "男",
                "age": "",
                "markdown_content": f"AI 结构化失败: {result.get('error', '未知错误')}\n\n请尝试手动填写或重新生成。",
                "ai_suggestions": ""
            }

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
