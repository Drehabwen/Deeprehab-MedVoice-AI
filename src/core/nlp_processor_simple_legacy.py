import re
from typing import Dict, List, Optional

class SimpleNLPProcessor:
    def __init__(self):
        self.doctor_keywords = ["我", "我们", "医生", "建议", "诊断", "需要", "检查", "治疗", "症状", "病情", "问题"]
        self.patient_keywords = ["我", "痛", "不舒服", "难受", "症状", "感觉", "已经", "一直"]
        
    def separate_speakers(self, transcript: str) -> List[Dict[str, str]]:
        dialogues = []
        sentences = self._split_sentences(transcript)
        
        current_speaker = None
        current_text = []
        
        for sentence in sentences:
            speaker = self._detect_speaker(sentence)
            
            if speaker != current_speaker and current_speaker is not None:
                dialogues.append({
                    "speaker": current_speaker,
                    "text": "".join(current_text).strip()
                })
                current_text = []
            
            current_speaker = speaker
            current_text.append(sentence)
        
        if current_text:
            dialogues.append({
                "speaker": current_speaker or "未知",
                "text": "".join(current_text).strip()
            })
        
        return dialogues
    
    def structure_case(self, dialogues: List[Dict[str, str]]) -> Dict:
        case_data = {
            "patient_name": "",
            "gender": "",
            "age": "",
            "chief_complaint": "",
            "present_illness": "",
            "past_history": "",
            "diagnosis": "",
            "treatment_plan": "",
            "prescription": ""
        }
        
        full_text = " ".join([d["text"] for d in dialogues])
        
        case_data["patient_name"] = self._extract_patient_name(full_text)
        case_data["gender"] = self._extract_gender(full_text)
        case_data["age"] = self._extract_age(full_text)
        case_data["chief_complaint"] = self._extract_chief_complaint(full_text)
        case_data["present_illness"] = self._extract_present_illness(full_text)
        case_data["past_history"] = self._extract_past_history(full_text)
        case_data["diagnosis"] = self._extract_diagnosis(full_text, dialogues)
        case_data["treatment_plan"] = self._extract_treatment_plan(full_text, dialogues)
        case_data["prescription"] = self._extract_prescription(full_text, dialogues)
        
        return case_data
    
    def process_transcript(self, transcript: str) -> Dict:
        speaker_dialogues = self.separate_speakers(transcript)
        if not speaker_dialogues:
            return {"speaker_dialogues": [], "case": {}}
        
        case_data = self.structure_case(speaker_dialogues)
        
        return {
            "speaker_dialogues": speaker_dialogues,
            "case": case_data
        }
    
    def _split_sentences(self, text: str) -> List[str]:
        sentences = re.split(r'[。！？，；\n]', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def _detect_speaker(self, sentence: str) -> str:
        doctor_score = sum(1 for kw in self.doctor_keywords if kw in sentence)
        patient_score = sum(1 for kw in self.patient_keywords if kw in sentence)
        
        if "医生" in sentence or "我们" in sentence or "建议" in sentence or "诊断" in sentence:
            return "医生"
        elif "痛" in sentence or "不舒服" in sentence or "难受" in sentence or "感觉" in sentence:
            return "患者"
        elif doctor_score > patient_score:
            return "医生"
        elif patient_score > doctor_score:
            return "患者"
        else:
            return "未知"
    
    def _extract_patient_name(self, text: str) -> str:
        name_match = re.search(r'叫["\s]*([^，。\n]{2,4})["\s]*，', text)
        if name_match:
            return name_match.group(1)
        return ""
    
    def _extract_gender(self, text: str) -> str:
        if "男" in text and "女" not in text:
            return "男"
        elif "女" in text:
            return "女"
        return ""
    
    def _extract_age(self, text: str) -> str:
        age_match = re.search(r'(\d+)\s*[岁岁年]', text)
        if age_match:
            return age_match.group(1)
        return ""
    
    def _extract_chief_complaint(self, text: str) -> str:
        patterns = [
            r'主诉[:：]([^。\n]+)',
            r'主要症状[:：]([^。\n]+)',
            r'因为([^。\n]+)(?:而来|就诊)'
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        
        symptom_match = re.search(r'(?:头痛|胸痛|腹痛|咳嗽|发热|呕吐|腹泻|乏力|胸闷|心慌)', text)
        if symptom_match:
            return symptom_match.group(0)
        
        return ""
    
    def _extract_present_illness(self, text: str) -> str:
        patterns = [
            r'现病史[:：]([^。\n]+)',
            r'病史[:：]([^。\n]+)'
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        
        return ""
    
    def _extract_past_history(self, text: str) -> str:
        patterns = [
            r'既往史[:：]([^。\n]+)',
            r'过去史[:：]([^。\n]+)',
            r'有([^。\n]+)病史'
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        
        return ""
    
    def _extract_diagnosis(self, text: str, dialogues: List[Dict[str, str]]) -> str:
        patterns = [
            r'诊断[:：]([^。\n]+)',
            r'诊断为[:：]([^。\n]+)'
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        
        for dialogue in dialogues:
            if dialogue["speaker"] == "医生":
                if any(kw in dialogue["text"] for kw in ["可能是", "考虑是", "应该", "属于"]):
                    return dialogue["text"]
        
        return ""
    
    def _extract_treatment_plan(self, text: str, dialogues: List[Dict[str, str]]) -> str:
        patterns = [
            r'治疗方案[:：]([^。\n]+)',
            r'建议[:：]([^。\n]+)',
            r'需要([^。\n]+)'
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        
        for dialogue in dialogues:
            if dialogue["speaker"] == "医生":
                if any(kw in dialogue["text"] for kw in ["建议", "需要", "治疗", "康复", "注意"]):
                    return dialogue["text"]
        
        return ""
    
    def _extract_prescription(self, text: str, dialogues: List[Dict[str, str]]) -> str:
        patterns = [
            r'处方[:：]([^。\n]+)',
            r'用药[:：]([^。\n]+)'
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        
        for dialogue in dialogues:
            if dialogue["speaker"] == "医生":
                if any(kw in dialogue["text"] for kw in ["药", "片", "胶囊", "注射", "口服"]):
                    return dialogue["text"]
        
        return ""
    
    def format_speaker_dialogues(self, dialogues: List[Dict[str, str]]) -> str:
        formatted = []
        for dialogue in dialogues:
            speaker = dialogue.get("speaker", "未知")
            text = dialogue.get("text", "")
            formatted.append(f"{speaker}：{text}")
        return "\n\n".join(formatted)
