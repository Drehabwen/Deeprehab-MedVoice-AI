#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
语音转病例助手 - 全面测试脚本
测试所有核心功能，包括录音、NLP处理、病例管理和文档生成
"""

import os
import sys
import json
import traceback
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


class TestResult:
    def __init__(self, name):
        self.name = name
        self.success = False
        self.error = None
        self.duration = 0
        self.details = []

    def add_detail(self, detail):
        self.details.append(detail)

    def to_dict(self):
        return {
            "name": self.name,
            "success": self.success,
            "error": self.error,
            "duration": self.duration,
            "details": self.details
        }


def test_pyaudio():
    """测试 PyAudio 是否能正常工作"""
    result = TestResult("PyAudio 初始化测试")
    start_time = datetime.now()

    try:
        import pyaudio
        result.add_detail("✓ PyAudio 导入成功")

        p = pyaudio.PyAudio()
        result.add_detail("✓ PyAudio 初始化成功")

        # 列出音频设备
        input_devices = []
        for i in range(p.get_device_count()):
            info = p.get_device_info_by_index(i)
            if info['maxInputChannels'] > 0:
                input_devices.append(i)
                result.add_detail(f"  设备 {i}: {info['name']}")

        if not input_devices:
            result.error = "未找到可用的音频输入设备"
            result.success = False
            return result

        result.add_detail(f"✓ 找到 {len(input_devices)} 个音频输入设备")

        # 尝试打开音频流
        stream = p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=16000,
            input=True,
            frames_per_buffer=1024
        )
        result.add_detail("✓ 音频流打开成功")

        # 尝试读取音频数据
        data = stream.read(1024, exception_on_overflow=False)
        result.add_detail(f"✓ 成功读取音频数据，大小: {len(data)} 字节")

        stream.close()
        p.terminate()

        result.success = True
    except Exception as e:
        result.error = str(e)
        result.add_detail(f"❌ 错误: {traceback.format_exc()}")

    result.duration = (datetime.now() - start_time).total_seconds()
    return result


def test_voice_recognizer():
    """测试语音识别器"""
    result = TestResult("语音识别器测试")
    start_time = datetime.now()

    try:
        from voice import VoiceRecognizer

        # 测试初始化
        recognizer = VoiceRecognizer()
        result.add_detail("✓ VoiceRecognizer 初始化成功")

        # 检查配置
        if not recognizer.APPID or not recognizer.API_KEY or not recognizer.API_SECRET:
            result.error = "缺少讯飞 API 配置"
            result.success = False
            return result

        result.add_detail(f"✓ 讯飞 API 配置完整 (APPID: {recognizer.APPID})")

        # 测试认证 URL 生成
        auth_url = recognizer.generate_auth_url()
        result.add_detail(f"✓ 认证 URL 生成成功")

        result.success = True
    except Exception as e:
        result.error = str(e)
        result.add_detail(f"❌ 错误: {traceback.format_exc()}")

    result.duration = (datetime.now() - start_time).total_seconds()
    return result


def test_nlp_processor():
    """测试 NLP 处理器"""
    result = TestResult("NLP 处理器测试")
    start_time = datetime.now()

    try:
        from nlp_processor import NLPProcessor

        # 测试初始化
        processor = NLPProcessor()
        result.add_detail("✓ NLPProcessor 初始化成功")

        # 检查模型配置
        if not processor.spark_base or not processor.spark_pro:
            result.error = "星火模型配置不完整"
            result.success = False
            return result

        result.add_detail("✓ 星火模型配置完整")

        # 测试格式化功能
        test_dialogues = [
            {"speaker": "医生", "text": "你好"},
            {"speaker": "患者", "text": "头痛"}
        ]
        formatted = processor.format_speaker_dialogues(test_dialogues)
        result.add_detail(f"✓ 对话格式化成功: {formatted[:50]}...")

        result.success = True
    except Exception as e:
        result.error = str(e)
        result.add_detail(f"❌ 错误: {traceback.format_exc()}")

    result.duration = (datetime.now() - start_time).total_seconds()
    return result


def test_case_manager():
    """测试病例管理器"""
    result = TestResult("病例管理器测试")
    start_time = datetime.now()

    try:
        from case_manager import CaseManager

        # 创建测试配置
        test_config = {
            "hospital_name": "测试医院",
            "doctor_name": "测试医生",
            "cases_dir": "./test_cases",
            "exports_dir": "./test_exports"
        }

        # 测试初始化
        manager = CaseManager(test_config)
        result.add_detail("✓ CaseManager 初始化成功")

        # 测试创建新病例
        new_case = manager.create_new_case("张三", "男", 45)
        result.add_detail(f"✓ 创建新病例成功: {new_case['case_id']}")

        # 测试保存病例
        success, msg = manager.save_case(new_case)
        if not success:
            result.error = f"保存病例失败: {msg}"
            result.success = False
            return result
        result.add_detail("✓ 保存病例成功")

        # 测试加载病例
        loaded_case = manager.load_case(new_case['case_id'])
        if not loaded_case:
            result.error = "加载病例失败"
            result.success = False
            return result
        result.add_detail("✓ 加载病例成功")

        # 测试列出病例
        cases = manager.list_cases()
        result.add_detail(f"✓ 列出病例成功，共 {len(cases)} 个")

        # 测试删除病例
        success = manager.delete_case(new_case['case_id'])
        if not success:
            result.error = "删除病例失败"
            result.success = False
            return result
        result.add_detail("✓ 删除病例成功")

        result.success = True
    except Exception as e:
        result.error = str(e)
        result.add_detail(f"❌ 错误: {traceback.format_exc()}")

    result.duration = (datetime.now() - start_time).total_seconds()
    return result


def test_document_generator():
    """测试文档生成器"""
    result = TestResult("文档生成器测试")
    start_time = datetime.now()

    try:
        from document_generator import DocumentGenerator

        # 创建测试配置
        test_config = {
            "hospital_name": "测试医院",
            "doctor_name": "测试医生",
            "cases_dir": "./test_cases",
            "exports_dir": "./test_exports"
        }

        # 测试初始化
        generator = DocumentGenerator(test_config)
        result.add_detail("✓ DocumentGenerator 初始化成功")

        # 创建测试病例
        test_case = {
            "case_id": "TEST001",
            "patient_name": "张三",
            "gender": "男",
            "age": 45,
            "visit_date": "2026-01-25",
            "chief_complaint": "头痛3天",
            "present_illness": "患者3天前无明显诱因出现头痛",
            "past_history": "高血压病史5年",
            "allergies": "青霉素过敏",
            "physical_exam": "T 36.5℃，BP 140/90mmHg",
            "diagnosis": "高血压病",
            "treatment_plan": "继续降压治疗"
        }

        # 测试生成 Word 文档
        filepath = generator.generate_word(test_case)
        if not os.path.exists(filepath):
            result.error = "Word 文档未生成"
            result.success = False
            return result
        result.add_detail(f"✓ Word 文档生成成功: {filepath}")

        # 测试 PDF 生成（如果可用）
        try:
            pdf_filepath = generator.generate_pdf(test_case)
            if os.path.exists(pdf_filepath):
                result.add_detail(f"✓ PDF 文档生成成功: {pdf_filepath}")
        except ImportError:
            result.add_detail("⚠ PDF 生成不可用 (fpdf2 未安装)")
        except Exception as e:
            result.add_detail(f"⚠ PDF 生成失败: {str(e)}")

        result.success = True
    except Exception as e:
        result.error = str(e)
        result.add_detail(f"❌ 错误: {traceback.format_exc()}")

    result.duration = (datetime.now() - start_time).total_seconds()
    return result


def test_integration():
    """测试完整集成流程"""
    result = TestResult("集成测试")
    start_time = datetime.now()

    try:
        from case_manager import CaseManager
        from document_generator import DocumentGenerator

        # 创建测试配置
        test_config = {
            "hospital_name": "测试医院",
            "doctor_name": "测试医生",
            "cases_dir": "./test_cases",
            "exports_dir": "./test_exports"
        }

        manager = CaseManager(test_config)
        generator = DocumentGenerator(test_config)

        # 创建并保存病例
        test_case = manager.create_new_case("李四", "女", 30)
        test_case.update({
            "chief_complaint": "发热1天",
            "present_illness": "患者1天前出现发热",
            "past_history": "无特殊",
            "allergies": "无",
            "physical_exam": "T 38.5℃，咽充血",
            "diagnosis": "上呼吸道感染",
            "treatment_plan": "休息，多饮水"
        })

        success, msg = manager.save_case(test_case)
        if not success:
            result.error = f"保存病例失败: {msg}"
            result.success = False
            return result
        result.add_detail("✓ 创建并保存病例成功")

        # 生成文档
        filepath = generator.generate_word(test_case)
        if not os.path.exists(filepath):
            result.error = "Word 文档未生成"
            result.success = False
            return result
        result.add_detail("✓ 生成 Word 文档成功")

        # 清理
        manager.delete_case(test_case['case_id'])
        result.add_detail("✓ 清理测试数据成功")

        result.success = True
    except Exception as e:
        result.error = str(e)
        result.add_detail(f"❌ 错误: {traceback.format_exc()}")

    result.duration = (datetime.now() - start_time).total_seconds()
    return result


def cleanup():
    """清理测试文件"""
    import shutil

    if os.path.exists("./test_cases"):
        shutil.rmtree("./test_cases")

    if os.path.exists("./test_exports"):
        shutil.rmtree("./test_exports")


def main():
    """主函数"""
    print("
" + "="*80)
    print("语音转病例助手 - 全面测试")
    print("="*80)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
")

    # 运行所有测试
    tests = [
        test_pyaudio,
        test_voice_recognizer,
        test_nlp_processor,
        test_case_manager,
        test_document_generator,
        test_integration
    ]

    results = []
    for test_func in tests:
        print(f"
运行测试: {test_func.__doc__}")
        print("-"*80)
        result = test_func()
        results.append(result)

        # 打印测试详情
        for detail in result.details:
            print(detail)

        if result.success:
            print(f"
✅ {result.name} 通过 (耗时: {result.duration:.2f}秒)")
        else:
            print(f"
❌ {result.name} 失败")
            print(f"   错误: {result.error}")

    # 清理
    print("\n" + "-"*80)
    print("清理测试文件...")
    cleanup()
    print("✓ 清理完成")

    # 打印汇总
    print("\n" + "="*80)
    print("测试结果汇总")
    print("="*80)

    passed = sum(1 for r in results if r.success)
    failed = len(results) - passed
    total_duration = sum(r.duration for r in results)

    print(f"总计: {len(results)} 个测试")
    print(f"通过: {passed} 个")
    print(f"失败: {failed} 个")
    print(f"总耗时: {total_duration:.2f}秒")
    print("="*80)

    # 保存测试报告
    report = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": len(results),
        "passed": passed,
        "failed": failed,
        "total_duration": total_duration,
        "results": [r.to_dict() for r in results]
    }

    with open("test_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n测试报告已保存到: test_report.json")

    if failed == 0:
        print("\n🎉 所有测试通过！\n")
        return 0
    else:
        print(f"\n⚠️  有 {failed} 个测试失败
")
        return 1


if __name__ == "__main__":
    sys.exit(main())
