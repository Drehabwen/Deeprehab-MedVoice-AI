import sys
import os
import json

# 添加当前目录到路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sdk import AIsciClient

def test_sdk():
    print("=== AIsci SDK 连通性测试 ===")
    client = AIsciClient(base_url="http://localhost:5000")
    
    # 1. 健康检查
    print("\n1. 测试健康检查...")
    health = client.health_check()
    print(f"结果: {json.dumps(health, indent=2, ensure_ascii=False)}")
    
    if health.get('status') != 'success':
        print("错误: 服务器未就绪，请确保 python src/api_server.py 正在运行")
        return

    # 2. 测试病例结构化
    print("\n2. 测试病例结构化...")
    test_transcript = "医生：你好，哪里不舒服？患者：医生你好，我最近头痛得厉害，已经三天了。"
    structure_result = client.structure_case(test_transcript)
    if structure_result.get('status') == 'success':
        print("成功: 结构化数据已获取")
        # print(json.dumps(structure_result['data']['structured_case'], indent=2, ensure_ascii=False))
        
        # 3. 测试报告生成
        print("\n3. 测试报告生成...")
        structured_data = structure_result['data']['structured_case']
        report_result = client.generate_report(structured_data, patient_info={"姓名": "张三", "年龄": "45"})
        if report_result.get('status') == 'success':
            print("成功: 病历报告已生成")
            # print(report_result['data']['medical_record'])
        else:
            print(f"失败: {report_result.get('message')}")
    else:
        print(f"失败: {structure_result.get('message')}")

    print("\n=== 测试完成 ===")

if __name__ == "__main__":
    test_sdk()
