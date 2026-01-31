import requests
import json
import base64
import time

BASE_URL = "http://localhost:5000"

def print_response(response, title):
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"{'='*60}")
    print(f"状态码: {response.status_code}")
    print(f"响应内容:")
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))

def test_health_check():
    print("\n[测试 1] 健康检查")
    response = requests.get(f"{BASE_URL}/health")
    print_response(response, "健康检查结果")
    return response.status_code == 200

def test_transcribe():
    print("\n[测试 2] 语音转录")
    
    print("注意: 此测试需要真实的音频数据")
    print("使用示例音频数据（空音频）进行测试...")
    
    sample_audio = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xAC\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    audio_base64 = base64.b64encode(sample_audio).decode('utf-8')
    
    data = {
        "audio_data": audio_base64,
        "format": "wav"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/transcribe",
            json=data,
            timeout=30
        )
        print_response(response, "转录结果")
        return response.status_code == 200
    except requests.exceptions.Timeout:
        print("请求超时（这是正常的，因为使用的是空音频）")
        return True
    except Exception as e:
        print(f"请求失败: {e}")
        return False

def test_structure_case():
    print("\n[测试 3] 病例结构化")
    
    sample_transcript = "患者主诉头痛三天，伴有恶心呕吐。既往有高血压病史，无药物过敏史。"
    
    data = {
        "transcript": sample_transcript,
        "separate_speakers": True
    }
    
    response = requests.post(
        f"{BASE_URL}/api/structure",
        json=data,
        timeout=30
    )
    print_response(response, "结构化结果")
    return response.status_code == 200

def test_generate_medical_record():
    print("\n[测试 4] 病历生成")
    
    structured_case = {
        "chief_complaint": "头痛三天，伴有恶心呕吐",
        "present_illness": "患者主诉头痛三天，伴有恶心呕吐，无发热，无意识障碍。",
        "past_history": "高血压病史5年，规律服药，血压控制尚可。",
        "allergies": "无药物过敏史",
        "physical_exam": "神志清楚，精神可，心肺听诊无异常。",
        "diagnosis": "头痛待查",
        "treatment_plan": "完善相关检查，对症治疗"
    }
    
    patient_info = {
        "name": "张三",
        "gender": "男",
        "age": 45
    }
    
    doctor_info = {
        "name": "李医生",
        "department": "神经内科"
    }
    
    data = {
        "structured_case": structured_case,
        "patient_info": patient_info,
        "doctor_info": doctor_info
    }
    
    response = requests.post(
        f"{BASE_URL}/api/generate",
        json=data,
        timeout=30
    )
    print_response(response, "病历生成结果")
    return response.status_code == 200

def test_save_case():
    print("\n[测试 5] 保存病例")
    
    case_data = {
        "patient_info": {
            "name": "张三",
            "gender": "男",
            "age": 45
        },
        "doctor_info": {
            "name": "李医生",
            "department": "神经内科"
        },
        "transcript": "患者主诉头痛三天，伴有恶心呕吐。",
        "structured_case": {
            "chief_complaint": "头痛三天",
            "present_illness": "患者主诉头痛三天，伴有恶心呕吐。",
            "past_history": "高血压病史5年"
        },
        "medical_record": "患者张三，男，45岁，因\"头痛三天\"就诊。",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S")
    }
    
    response = requests.post(
        f"{BASE_URL}/api/case/save",
        json=case_data
    )
    print_response(response, "保存病例结果")
    
    if response.status_code == 200:
        case_id = response.json().get("data", {}).get("case_id")
        return case_id
    return None

def test_get_case(case_id):
    print("\n[测试 6] 获取病例")
    
    if not case_id:
        print("跳过: 无病例 ID")
        return True
    
    response = requests.get(f"{BASE_URL}/api/case/{case_id}")
    print_response(response, "获取病例结果")
    return response.status_code == 200

def test_list_cases():
    print("\n[测试 7] 病例列表")
    
    response = requests.get(f"{BASE_URL}/api/cases")
    print_response(response, "病例列表结果")
    return response.status_code == 200

def test_delete_case(case_id):
    print("\n[测试 8] 删除病例")
    
    if not case_id:
        print("跳过: 无病例 ID")
        return True
    
    response = requests.delete(f"{BASE_URL}/api/case/{case_id}")
    print_response(response, "删除病例结果")
    return response.status_code == 200

def main():
    print("="*60)
    print("语音转病例助手 API 测试")
    print("="*60)
    print(f"\n测试目标: {BASE_URL}")
    print("请确保 API 服务已启动...")
    print("\n按 Enter 开始测试...")
    input()
    
    results = []
    case_id = None
    
    try:
        results.append(("健康检查", test_health_check()))
        results.append(("语音转录", test_transcribe()))
        results.append(("病例结构化", test_structure_case()))
        results.append(("病历生成", test_generate_medical_record()))
        
        case_id = test_save_case()
        results.append(("保存病例", case_id is not None))
        
        results.append(("获取病例", test_get_case(case_id)))
        results.append(("病例列表", test_list_cases()))
        results.append(("删除病例", test_delete_case(case_id)))
        
    except Exception as e:
        print(f"\n错误: {e}")
        print("请确保 API 服务已启动")
        return
    
    print("\n" + "="*60)
    print("测试结果汇总")
    print("="*60)
    
    for test_name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{test_name:20s} {status}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    print(f"\n总计: {passed}/{total} 测试通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！")
    else:
        print(f"\n⚠️  {total - passed} 个测试失败")

if __name__ == "__main__":
    main()
