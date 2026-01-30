import re
from typing import Dict, Optional


class CaseStructurer:
    FIELD_KEYWORDS = {
        "chief_complaint": ["主诉", "主要症状", "主诉："],
        "present_illness": ["现病史", "病史", "现病史："],
        "past_history": ["既往史", "过去史", "既往病史", "既往史："],
        "allergies": ["过敏史", "药物过敏", "过敏", "过敏史："],
        "physical_exam": ["体格检查", "体检", "查体", "体格检查："],
        "diagnosis": ["诊断", "初步诊断", "诊断：", "初步诊断："],
        "treatment_plan": ["治疗", "处置", "建议", "治疗方案", "治疗：", "处置：", "建议："]
    }

    GENDER_PATTERNS = [
        (r"患者\s*为?\s*([男女])", "gender"),
        (r"([男女])性患者", "gender"),
        (r"患者\s*\(([男女])\)", "gender")
    ]

    AGE_PATTERNS = [
        (r"(\d+)\s*岁", "age"),
        (r"(\d+)\s*周岁", "age"),
        (r"年龄\s*[:：]?\s*(\d+)", "age"),
        (r"(\d+)\s*岁\s*[男女]性", "age")
    ]

    def __init__(self):
        pass

    def structure(self, transcript: str, base_case: Dict = None) -> Dict:
        if base_case is None:
            base_case = {
                "patient_name": "",
                "gender": "",
                "age": 0,
                "chief_complaint": "",
                "present_illness": "",
                "past_history": "",
                "allergies": "",
                "physical_exam": "",
                "diagnosis": "",
                "treatment_plan": ""
            }
        
        structured = base_case.copy()
        text = transcript.strip()
        
        extracted = self._extract_fields(text)
        
        for field, value in extracted.items():
            if value:
                structured[field] = value
        
        if not structured["gender"] or not structured["age"]:
            self._infer_patient_info(text, structured)
        
        return structured

    def structure_with_speakers(self, speaker_transcripts: list, base_case: Dict = None, speaker_labels: Dict = None) -> Dict:
        if speaker_labels is None:
            speaker_labels = {"A": "医生", "B": "患者"}
        
        if base_case is None:
            base_case = {
                "patient_name": "",
                "gender": "",
                "age": 0,
                "chief_complaint": "",
                "present_illness": "",
                "past_history": "",
                "allergies": "",
                "physical_exam": "",
                "diagnosis": "",
                "treatment_plan": ""
            }
        
        structured = base_case.copy()
        
        speaker_a_text = "".join([s["text"] for s in speaker_transcripts if s["speaker"] == "A"])
        speaker_b_text = "".join([s["text"] for s in speaker_transcripts if s["speaker"] == "B"])
        
        full_text = speaker_a_text + speaker_b_text
        
        doctor_fields = ["diagnosis", "treatment_plan", "physical_exam"]
        patient_fields = ["chief_complaint", "present_illness", "past_history", "allergies"]
        
        for field in doctor_fields:
            extracted = self._extract_field_from_text(field, speaker_a_text)
            if extracted:
                structured[field] = extracted
        
        for field in patient_fields:
            extracted = self._extract_field_from_text(field, speaker_b_text)
            if not extracted:
                extracted = self._extract_field_from_text(field, full_text)
            if extracted:
                structured[field] = extracted
        
        if not structured["gender"] or not structured["age"]:
            self._infer_patient_info(full_text, structured)
        
        return structured

    def _extract_field_from_text(self, field: str, text: str) -> str:
        if field not in self.FIELD_KEYWORDS:
            return ""
        
        keywords = self.FIELD_KEYWORDS[field]
        for keyword in keywords:
            idx = text.find(keyword)
            if idx != -1:
                start_idx = idx + len(keyword)
                next_keyword_idx = len(text)
                for other_keywords in self.FIELD_KEYWORDS.values():
                    for kw in other_keywords:
                        kw_idx = text.find(kw, start_idx)
                        if kw_idx != -1 and kw_idx < next_keyword_idx:
                            next_keyword_idx = kw_idx
                content = text[start_idx:next_keyword_idx].strip()
                if content:
                    return content
        return ""

    def _extract_fields(self, text: str) -> Dict:
        result = {field: "" for field in self.FIELD_KEYWORDS.keys()}
        
        field_positions = []
        
        for field, keywords in self.FIELD_KEYWORDS.items():
            for keyword in keywords:
                idx = text.find(keyword)
                if idx != -1:
                    start_idx = idx + len(keyword)
                    next_keyword_idx = len(text)
                    for other_field, other_keywords in self.FIELD_KEYWORDS.items():
                        for kw in other_keywords:
                            if kw == keyword:
                                continue
                            kw_idx = text.find(kw, start_idx)
                            if kw_idx != -1 and kw_idx < next_keyword_idx:
                                next_keyword_idx = kw_idx
                    content = text[start_idx:next_keyword_idx].strip()
                    if content:
                        if content.startswith(':') or content.startswith('：'):
                            content = content[1:].strip()
                        field_positions.append((field, idx, content))
        
        field_positions.sort(key=lambda x: x[1])
        
        for field, start, content in field_positions:
            if content and content.strip():
                if not result[field]:
                    result[field] = content.strip()
        
        return result

    def _infer_patient_info(self, text: str, structured: Dict):
        for pattern, field in self.GENDER_PATTERNS:
            match = re.search(pattern, text)
            if match:
                structured["gender"] = match.group(1)
                break
        
        for pattern, field in self.AGE_PATTERNS:
            match = re.search(pattern, text)
            if match:
                try:
                    structured["age"] = int(match.group(1))
                except ValueError:
                    pass
                break

    def update_field(self, case: Dict, field: str, value: str) -> Dict:
        if field in case:
            case[field] = value
        return case

    def get_field_suggestions(self, transcript: str, field: str) -> list:
        suggestions = []
        
        if field == "gender":
            if "男" in transcript:
                suggestions.append("男")
            if "女" in transcript:
                suggestions.append("女")
        
        if field == "age":
            matches = re.findall(r"(\d+)\s*岁", transcript)
            suggestions.extend([int(m) for m in matches])
        
        return suggestions
