#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
语音转病例助手 - 完整测试套件
运行所有测试并生成测试报告
"""

import unittest
import sys
import os
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def run_all_tests():
    print("="*80)
    print("语音转病例助手 - 完整测试套件")
    print("="*80)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    print("正在加载测试模块...")
    
    try:
        from test_core_modules import (
            TestCaseStructurer, 
            TestCaseManager, 
            TestDocumentGenerator,
            TestIntegration
        )
        suite.addTests(loader.loadTestsFromTestCase(TestCaseStructurer))
        suite.addTests(loader.loadTestsFromTestCase(TestCaseManager))
        suite.addTests(loader.loadTestsFromTestCase(TestDocumentGenerator))
        suite.addTests(loader.loadTestsFromTestCase(TestIntegration))
        print("✅ 核心模块测试加载成功")
    except Exception as e:
        print(f"❌ 核心模块测试加载失败: {e}")
    
    try:
        from test_nlp_processor import TestNLPProcessor
        suite.addTests(loader.loadTestsFromTestCase(TestNLPProcessor))
        print("✅ NLP处理测试加载成功")
    except Exception as e:
        print(f"❌ NLP处理测试加载失败: {e}")
    
    print()
    print("="*80)
    print("开始运行测试...")
    print("="*80)
    print()
    
    start_time = time.time()
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    end_time = time.time()
    
    print()
    print("="*80)
    print("测试结果汇总")
    print("="*80)
    print(f"运行测试: {result.testsRun}")
    print(f"成功: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"失败: {len(result.failures)}")
    print(f"错误: {len(result.errors)}")
    print(f"跳过: {len(result.skipped)}")
    print(f"耗时: {end_time - start_time:.2f}秒")
    print("="*80)
    
    if result.failures:
        print("\n失败的测试:")
        for test, traceback in result.failures:
            print(f"  ❌ {test}")
            print(f"     {traceback}")
    
    if result.errors:
        print("\n错误的测试:")
        for test, traceback in result.errors:
            print(f"  ❌ {test}")
            print(f"     {traceback}")
    
    print()
    print("="*80)
    if result.wasSuccessful():
        print("🎉 所有测试通过！")
    else:
        print("⚠️  部分测试失败，请检查上述错误信息")
    print("="*80)
    
    return result.wasSuccessful()


def run_specific_test(test_name):
    print(f"运行特定测试: {test_name}")
    print("="*80)
    
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    if test_name == "core":
        from test_core_modules import (
            TestCaseStructurer, 
            TestCaseManager, 
            TestDocumentGenerator,
            TestIntegration
        )
        suite.addTests(loader.loadTestsFromTestCase(TestCaseStructurer))
        suite.addTests(loader.loadTestsFromTestCase(TestCaseManager))
        suite.addTests(loader.loadTestsFromTestCase(TestDocumentGenerator))
        suite.addTests(loader.loadTestsFromTestCase(TestIntegration))
    elif test_name == "nlp":
        from test_nlp_processor import TestNLPProcessor
        suite.addTests(loader.loadTestsFromTestCase(TestNLPProcessor))
    elif test_name == "structurer":
        from test_core_modules import TestCaseStructurer
        suite.addTests(loader.loadTestsFromTestCase(TestCaseStructurer))
    elif test_name == "manager":
        from test_core_modules import TestCaseManager
        suite.addTests(loader.loadTestsFromTestCase(TestCaseManager))
    elif test_name == "generator":
        from test_core_modules import TestDocumentGenerator
        suite.addTests(loader.loadTestsFromTestCase(TestDocumentGenerator))
    elif test_name == "integration":
        from test_core_modules import TestIntegration
        suite.addTests(loader.loadTestsFromTestCase(TestIntegration))
    else:
        print(f"未知的测试名称: {test_name}")
        print("可用的测试名称: core, nlp, structurer, manager, generator, integration")
        return False
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


def main():
    if len(sys.argv) > 1:
        test_name = sys.argv[1]
        success = run_specific_test(test_name)
    else:
        success = run_all_tests()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
