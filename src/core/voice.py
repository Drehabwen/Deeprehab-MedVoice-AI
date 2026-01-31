import json
import base64
import hashlib
import hmac
import pyaudio
import threading
import websocket
import ssl
from datetime import datetime
from urllib.parse import urlencode

class VoiceRecognizer:
    def __init__(self, config=None):
        if config is None:
            try:
                with open("config.json", "r", encoding="utf-8") as f:
                    config = json.load(f)
            except:
                config = {}

        self.config = config
        # 使用 or 确保当 asr_appid 为空字符串时能正确回退到 spark_appid
        self.APPID = str(config.get("asr_appid") or config.get("spark_appid") or "").strip()
        self.API_KEY = str(config.get("asr_api_key") or config.get("spark_api_key") or "").strip()
        self.API_SECRET = str(config.get("asr_api_secret") or config.get("spark_api_secret") or "").strip()
        self.URL = "wss://iat-api.xfyun.cn/v2/iat"
        
        self.is_running = False
        self.ws = None
        self.on_update = None
        self.on_complete = None
        self.on_error = None
        self.full_transcript = ""
        self.temp_transcript = ""
        self.current_speaker = None
        self.structured_transcript = []  # 存储结构化对话列表 [{speaker: "医生", text: "..."}]

    def generate_auth_url(self, date=None):
        import hashlib
        import hmac
        import time
        from urllib.parse import urlencode, urlparse
        
        # 1. 生成符合 RFC1123 格式的 GMT 时间
        # 必须使用 time.gmtime() 确保是标准 GMT 时间，不受本地时区影响
        if date is None:
            date = time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())
        
        # 2. 构造待签名字符串 (signature_origin)
        host = urlparse(self.URL).netloc
        path = urlparse(self.URL).path
        signature_origin = f"host: {host}\ndate: {date}\nGET {path} HTTP/1.1"
        
        # 3. HMAC-SHA256 加密并进行 Base64 编码
        signature_sha = hmac.new(self.API_SECRET.encode('utf-8'), 
                                signature_origin.encode('utf-8'), 
                                digestmod=hashlib.sha256).digest()
        signature = base64.b64encode(signature_sha).decode('utf-8')
        
        # 4. 构造 Authorization 原始字符串
        # 注意：部分严谨的网关要求字段间不能有空格，这里采用最通用的格式
        auth_str = f'api_key="{self.API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="{signature}"'
        
        # 5. 对 Authorization 字符串进行 Base64 编码
        authorization = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
        
        # 6. 构造最终的 URL 参数
        params = {
            "authorization": authorization,
            "date": date,
            "host": host
        }
        
        return self.URL + "?" + urlencode(params)

    def start(self, on_update=None, on_complete=None, on_error=None):
        self.on_update = on_update
        self.on_complete = on_complete
        self.on_error = on_error
        self.is_running = True
        self.is_recording_manual_stop = False # 重置手动停止标志
        self.callback_done = False 
        self.full_transcript = ""
        self.temp_transcript = ""
        self.current_speaker = None
        self.structured_transcript = []
        self.session_count = 0 # 用于标识当前会话序号
        
        # 强制清除角色标识相关的显示缓存
        if hasattr(self, "_last_display_speaker"):
            delattr(self, "_last_display_speaker")
        
        self._start_new_session()

    def _start_new_session(self):
        if not self.is_running:
            return
            
        self.session_count += 1
        current_session = self.session_count
        
        # 显式同步签名中的 date 和握手头中的 date
        from urllib.parse import urlparse
        import time
        
        host = urlparse(self.URL).netloc
        date = time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())
        auth_url = self.generate_auth_url(date=date)
        
        # 讯飞 IAT v2 鉴权：
        # 1. host, date, authorization 必须在 URL 参数中（generate_auth_url 已处理）
        # 2. 握手头中必须包含 date，host 由 websocket 库自动处理，通常不需要手动传
        headers = {
            "Date": date
        }
        
        print(f"DEBUG: Connecting to ASR with AppID={self.APPID}, Host={host}")
        
        self.ws = websocket.WebSocketApp(auth_url,
                                       header=headers,
                                       on_open=lambda ws: self._on_open(ws, current_session),
                                       on_message=self._on_message,
                                       on_error=self._on_error,
                                       on_close=self._on_close)
        
        # 在新线程中运行 WebSocket
        thread = threading.Thread(target=self.ws.run_forever, kwargs={"sslopt": {"cert_reqs": ssl.CERT_NONE}})
        thread.daemon = True
        thread.start()

    def stop(self):
        self.is_recording_manual_stop = True # 标记为手动停止
        self.is_running = False
        # 不立即关闭 ws，让 _send_audio 发送结束帧，由服务器返回最后结果后再由 on_message 关闭
        print("🛑 停止录音信号已发送，等待服务器处理剩余音频...")

    def _on_message(self, ws, message):
        try:
            data = json.loads(message)
            code = data.get("code")
            if code != 0:
                print(f"Error: {code} {data.get('message')}")
                if self.on_error:
                    self.on_error(f"讯飞API错误 {code}: {data.get('message')}")
                ws.close()
                return

            if data.get("data", {}).get("result"):
                result = data["data"]["result"]
                ws_list = result["ws"]
                text = "".join([w["cw"][0]["w"] for w in ws_list])
                
                # pgs: rpl 意味着替换之前的文本（用于修正）
                pgs = result.get("pgs")
                if pgs == "rpl":
                    self.temp_transcript = text
                else:
                    if self.temp_transcript:
                        self.full_transcript += self.temp_transcript
                        self.temp_transcript = ""
                    self.full_transcript += text
                
                current_display = self.full_transcript + self.temp_transcript
                
                if self.on_update:
                    self.on_update(current_display)
                
                if data["data"]["status"] == 2:
                    ws.close()
                    
                    # 只有手动停止后才触发完成回调，否则自动续期
                    if self.is_recording_manual_stop:
                        if self.on_complete and not self.callback_done:
                            self.callback_done = True
                            self.on_complete(self.full_transcript)
                    else:
                        print("🔄 会话超时，自动续期录音...")
                        # 延迟一小会儿再重连，避免并发冲突
                        threading.Timer(0.1, self._start_new_session).start()
        except Exception as e:
            print(f"Message processing error: {e}")

    def _on_error(self, ws, error):
        # 忽略 websocket.WebSocketConnectionClosedException 错误，因为我们手动关闭它
        if not isinstance(error, websocket.WebSocketConnectionClosedException):
            print(f"❌ 错误: {error}")
            if self.on_error:
                self.on_error(str(error))

    def _on_close(self, ws, close_status_code, close_msg):
        # print("\n🔌 连接已关闭")
        pass

    def _on_open(self, ws, session_id):
        # print(f"✅ 已连接讯飞API (会话 {session_id})")
        threading.Thread(target=self._send_audio, args=(ws, session_id), daemon=True).start()

    def _send_audio(self, ws, session_id):
        p = pyaudio.PyAudio()
        stream = None
        try:
            # 使用配置中的采样率
            sample_rate = self.config.get("audio_sample_rate", 16000)
            # 延长静音检测时间，减少长录音时的断开频率 (最大 10000ms)
            vad_eos = self.config.get("vad_eos", 10000)
            language = self.config.get("iat_language", "zh_cn")
            
            stream = p.open(format=pyaudio.paInt16, channels=1, rate=sample_rate, input=True, frames_per_buffer=1024)
            print(f"🎙️ 正在录音... (采样率: {sample_rate})")
            
            business_params = {
                "language": language,
                "domain": "iat",
                "accent": "mandarin",
                "vad_eos": vad_eos,
                "nunum": 1,
                "speex_size": 60
            }
            
            # 只有在配置开启且支持时才添加 role_type
            if self.config.get("enable_diarization", False):
                business_params["role_type"] = 2
                
            params = {
                "common": {"app_id": self.APPID},
                "business": business_params,
                "data": {"status": 0, "format": f"audio/L16;rate={sample_rate}", "encoding": "raw", "audio": ""}
            }
            ws.send(json.dumps(params))
            
            status = 1
            while self.is_running and self.session_count == session_id:
                if not ws.sock or not ws.sock.connected:
                    break
                
                try:
                    data = stream.read(1024, exception_on_overflow=False)
                except Exception:
                    break
                    
                frame = {
                    "data": {
                        "status": status,
                        "format": f"audio/L16;rate={sample_rate}",
                        "audio": base64.b64encode(data).decode('utf-8'),
                        "encoding": "raw"
                    }
                }
                ws.send(json.dumps(frame))
                status = 1
            
            # 发送结束帧
            if ws.sock and ws.sock.connected:
                end_frame = {"data": {"status": 2, "format": f"audio/L16;rate={sample_rate}", "audio": "", "encoding": "raw"}}
                ws.send(json.dumps(end_frame))
                
        except Exception as e:
            if self.is_running: # 只有在非手动停止的情况下才报错
                print(f"发送音频异常: {e}")
                if self.on_error:
                    self.on_error(f"录音异常: {e}")
        finally:
            if stream:
                stream.stop_stream()
                stream.close()
            p.terminate()

# 兼容旧代码的接口（如果需要的话，但建议直接改调用方）
def record_transcript():
    recognizer = VoiceRecognizer()
    result_container = {"text": ""}
    event = threading.Event()
    
    def on_complete(text):
        result_container["text"] = text
        event.set()
        
    recognizer.start(on_complete=on_complete)
    # 这里模拟阻塞，但实际上没有停止机制，所以这个兼容接口其实很有问题
    # 为了简单测试，我们假设录音5秒
    import time
    time.sleep(5)
    recognizer.stop()
    event.wait()
    return result_container["text"]

if __name__ == "__main__":
    r = VoiceRecognizer()
    def print_update(text):
        print(f"\r{text}", end="")
    r.start(on_update=print_update)
    import time
    time.sleep(10)
    r.stop()

class VoiceRecorder:
    def __init__(self):
        self.recognizer = VoiceRecognizer()
        self.is_recording = False
        self.last_result = ""
        self.error = None
        self._complete_event = threading.Event()

    def start_recording(self, on_update=None):
        if self.is_recording:
            return
        
        self.is_recording = True
        self.last_result = ""
        self.error = None
        self._complete_event.clear()

        def on_complete(text):
            self.last_result = text
            self.is_recording = False
            self._complete_event.set()

        def on_error(err):
            self.error = err
            self.is_recording = False
            self._complete_event.set()

        self.recognizer.start(
            on_update=on_update,
            on_complete=on_complete,
            on_error=on_error
        )

    def stop_recording(self, timeout=30):
        if not self.is_recording:
            return self.last_result

        self.recognizer.stop()
        # 等待转录完成
        self._complete_event.wait(timeout=timeout)
        self.is_recording = False
        
        if self.error:
            raise Exception(self.error)
        
        return self.last_result

    def transcribe_file(self, audio_file_path):
        import wave
        import base64
        import os
        
        try:
            # 前端现在发送的是标准的 16k 16bit 单声道 WAV
            # 直接使用 wave 模块读取
            try:
                wf = wave.open(audio_file_path, 'rb')
            except Exception as e:
                # 保底方案：如果还是报错，尝试修复头部
                print(f"标准读取失败，尝试修复 WAV 头部: {e}")
                with open(audio_file_path, 'rb') as f:
                    content = f.read()
                    riff_pos = content.find(b'RIFF')
                    if riff_pos != -1:
                        fixed_path = audio_file_path + ".fixed.wav"
                        with open(fixed_path, 'wb') as fixed_f:
                            fixed_f.write(content[riff_pos:])
                        wf = wave.open(fixed_path, 'rb')
                        audio_file_path = fixed_path
                    else:
                        raise e

            sample_rate = wf.getframerate()
            frames = wf.getnframes()
            audio_data = wf.readframes(frames)
            wf.close()
            
            # 如果是修复过的临时文件，读取完就删掉
            if audio_file_path.endswith(".fixed.wav") and os.path.exists(audio_file_path):
                try:
                    os.remove(audio_file_path)
                except:
                    pass
            
            transcript_container = {"text": ""}
            complete_event = threading.Event()
            error_container = {"error": None}
            
            def on_complete(text):
                transcript_container["text"] = text
                complete_event.set()
            
            def on_error(error):
                error_container["error"] = error
                complete_event.set()
            
            self.recognizer.start(on_complete=on_complete, on_error=on_error)
            
            # 等待 WebSocket 连接就绪
            import time
            max_wait = 30
            while not (self.recognizer.ws and self.recognizer.ws.sock and self.recognizer.ws.sock.connected) and max_wait > 0:
                time.sleep(0.1)
                max_wait -= 1
            
            ws = self.recognizer.ws
            if ws and ws.sock and ws.sock.connected:
                params = {
                    "common": {"app_id": self.recognizer.APPID},
                    "business": {
                        "language": "zh_cn",
                        "domain": "iat",
                        "accent": "mandarin",
                        "vad_eos": 5000,
                        "nunum": 1,
                        "speex_size": 60
                    },
                    "data": {"status": 0, "format": "audio/L16;rate=16000", "encoding": "raw", "audio": ""}
                }
                ws.send(json.dumps(params))
                
                chunk_size = 1024
                status = 1
                total_chunks = len(audio_data) // chunk_size
                
                for i in range(total_chunks):
                    if not ws.sock or not ws.sock.connected:
                        break
                    
                    chunk = audio_data[i * chunk_size:(i + 1) * chunk_size]
                    frame = {
                        "data": {
                            "status": status,
                            "format": "audio/L16;rate=16000",
                            "audio": base64.b64encode(chunk).decode('utf-8'),
                            "encoding": "raw"
                        }
                    }
                    ws.send(json.dumps(frame))
                    status = 1
                    
                    import time
                    time.sleep(0.01)
                
                if ws.sock and ws.sock.connected:
                    end_frame = {"data": {"status": 2, "format": "audio/L16;rate=16000", "audio": "", "encoding": "raw"}}
                    ws.send(json.dumps(end_frame))
                
                complete_event.wait(timeout=30)
                
                if error_container["error"]:
                    raise Exception(error_container["error"])
                
                return transcript_container["text"]
            else:
                raise Exception("WebSocket连接失败")
            
        except Exception as e:
            print(f"文件转录失败: {str(e)}")
            raise e
