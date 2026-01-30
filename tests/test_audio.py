#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
音频设备测试脚本
用于诊断录音初始化失败的问题
"""

import pyaudio
import sys

def test_pyaudio():
    """测试 PyAudio 是否能正常工作"""
    print("="*60)
    print("测试 PyAudio 初始化")
    print("="*60)

    try:
        p = pyaudio.PyAudio()
        print("✓ PyAudio 初始化成功")

        # 列出所有音频输入设备
        print("
可用的音频输入设备:")
        input_devices = []
        for i in range(p.get_device_count()):
            info = p.get_device_info_by_index(i)
            if info['maxInputChannels'] > 0:
                input_devices.append(i)
                print(f"  设备 {i}: {info['name']}")
                print(f"    采样率: {info['defaultSampleRate']}")
                print(f"    通道数: {info['maxInputChannels']}")

        if not input_devices:
            print("
❌ 未找到可用的音频输入设备")
            return False

        # 尝试打开默认输入流
        print("
尝试打开音频流...")
        stream = p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=16000,
            input=True,
            frames_per_buffer=1024
        )
        print("✓ 音频流打开成功")

        # 尝试读取一小段音频数据
        print("
尝试读取音频数据...")
        try:
            data = stream.read(1024, exception_on_overflow=False)
            print(f"✓ 成功读取音频数据，大小: {len(data)} 字节")
        except Exception as e:
            print(f"❌ 读取音频数据失败: {e}")
            return False

        stream.close()
        p.terminate()
        print("
✅ 所有测试通过")
        return True

    except Exception as e:
        print(f"
❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_pyaudio()
    sys.exit(0 if success else 1)
