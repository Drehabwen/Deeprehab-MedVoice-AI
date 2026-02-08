import json
import base64
import hashlib
import hmac
import threading
import websocket
import ssl
import queue
import time
import email.utils
from datetime import datetime
from urllib.parse import urlencode, urlparse

# 尝试导入 pyaudio，如果失败则禁用本地录音功能
try:
    import pyaudio
    HAS_PYAUDIO = True
except ImportError:
    HAS_PYAUDIO = False

class VoiceRecognizer:
    def __init__(self, config=None):
        if config is None:
            try:
                with open("config.json", "r", encoding="utf-8") as f:
                    config = json.load(f)
            except:
                config = {}

        self.config = config
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
        self.structured_transcript = []
        
        self.audio_queue = queue.Queue() # 用于非 pyaudio 模式下的音频流
        self.use_pyaudio = True

    def generate_auth_url(self, date=None):
        if date is None:
            # 强制使用英文格式的 GMT 时间，避免本地语言干扰
            date = email.utils.formatdate(timeval=None, localtime=False, usegmt=True)
        
        host = urlparse(self.URL).netloc
        path = urlparse(self.URL).path
        
        # 严格按照讯飞官方格式拼接签名原始字符串
        signature_origin = f"host: {host}\ndate: {date}\nGET {path} HTTP/1.1"
        
        signature_sha = hmac.new(self.API_SECRET.encode('utf-8'), 
                                signature_origin.encode('utf-8'), 
                                digestmod=hashlib.sha256).digest()
        signature = base64.b64encode(signature_sha).decode('utf-8')
        
        # Authorization 字符串：逗号后保留空格，符合官方标准
        auth_str = f'api_key="{self.API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="{signature}"'
        authorization = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
        
        params = {
            "authorization": authorization,
            "date": date,
            "host": host
        }
        
        return self.URL + "?" + urlencode(params)

    def start(self, on_update=None, on_complete=None, on_error=None, use_pyaudio=True):
        self.on_update = on_update
        self.on_complete = on_complete
        self.on_error = on_error
        self.is_running = True
        self.use_pyaudio = use_pyaudio and HAS_PYAUDIO
        self.is_recording_manual_stop = False
        self.callback_done = False 
        self.full_transcript = ""
        self.temp_transcript = ""
        self.session_count = 0
        
        # 清空音频队列
        while not self.audio_queue.empty():
            try:
                self.audio_queue.get_nowait()
            except queue.Empty:
                break
        
        self._start_new_session()

    def push_audio(self, chunk):
        """外部推送音频切片"""
        if self.is_running:
            self.audio_queue.put(chunk)

    def _start_new_session(self):
        if not self.is_running:
            return
            
        self.session_count += 1
        current_session = self.session_count
        
        # 统一使用 email.utils 获取时间，确保格式一致
        date = email.utils.formatdate(timeval=None, localtime=False, usegmt=True)
        auth_url = self.generate_auth_url(date=date)
        
        # 提取 host 用于握手头
        host = urlparse(self.URL).netloc
        headers = {
            "Host": host,
            "Date": date
        }
        
        self.ws = websocket.WebSocketApp(auth_url,
                                       header=headers,
                                       on_open=lambda ws: self._on_open(ws, current_session),
                                       on_message=self._on_message,
                                       on_error=self._on_error,
                                       on_close=self._on_close)
        
        thread = threading.Thread(target=self.ws.run_forever, kwargs={"sslopt": {"cert_reqs": ssl.CERT_NONE}})
        thread.daemon = True
        thread.start()

    def stop(self):
        self.is_recording_manual_stop = True
        self.is_running = False
        # 发送一个结束信号到队列
        self.audio_queue.put(None)
        # print("🛑 停止录音信号已发送")

    def _on_message(self, ws, message):
        try:
            data = json.loads(message)
            code = data.get("code")
            if code != 0:
                if self.on_error:
                    self.on_error(f"讯飞API错误 {code}: {data.get('message')}")
                ws.close()
                return

            if data.get("data", {}).get("result"):
                result = data["data"]["result"]
                ws_list = result["ws"]
                text = "".join([w["cw"][0]["w"] for w in ws_list])
                
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
                    if self.is_recording_manual_stop:
                        if self.on_complete and not self.callback_done:
                            self.callback_done = True
                            self.on_complete(self.full_transcript)
                    else:
                        threading.Timer(0.1, self._start_new_session).start()
        except Exception as e:
            print(f"Message processing error: {e}")

    def _on_error(self, ws, error):
        if not isinstance(error, websocket.WebSocketConnectionClosedException):
            if self.on_error:
                self.on_error(str(error))

    def _on_close(self, ws, close_status_code, close_msg):
        pass

    def _on_open(self, ws, session_id):
        threading.Thread(target=self._send_audio, args=(ws, session_id), daemon=True).start()

    def _send_audio(self, ws, session_id):
        stream = None
        p = None
        if self.use_pyaudio:
            p = pyaudio.PyAudio()
        
        try:
            sample_rate = self.config.get("audio_sample_rate", 16000)
            vad_eos = self.config.get("vad_eos", 10000)
            language = self.config.get("iat_language", "zh_cn")
            
            if self.use_pyaudio:
                stream = p.open(format=pyaudio.paInt16, channels=1, rate=sample_rate, input=True, frames_per_buffer=1024)
            
            business_params = {
                "language": "zh_cn", 
                "domain": "iat",
                "accent": "mandarin",
                "vad_eos": 3000, 
                "nunum": 1,
                "speex_size": 70, 
                "pd": "medical"
            }
            if self.config.get("enable_diarization", False):
                business_params["role_type"] = 2
                
            params = {
                "common": {"app_id": self.APPID},
                "business": business_params,
                "data": {"status": 0, "format": f"audio/L16;rate={sample_rate}", "encoding": "raw", "audio": ""}
            }
            ws.send(json.dumps(params))
            
            status = 1
            while (self.is_running or not self.is_recording_manual_stop) and self.session_count == session_id:
                if not ws.sock or not ws.sock.connected:
                    break
                
                if self.use_pyaudio:
                    try:
                        data = stream.read(1024, exception_on_overflow=False)
                    except:
                        break
                else:
                    try:
                        data = self.audio_queue.get(timeout=1.0)
                        if data is None: # 结束信号
                            break
                    except queue.Empty:
                        continue
                    
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
            
            if ws.sock and ws.sock.connected:
                end_frame = {"data": {"status": 2, "format": f"audio/L16;rate={sample_rate}", "audio": "", "encoding": "raw"}}
                ws.send(json.dumps(end_frame))
                
        except Exception as e:
            if self.is_running:
                print(f"发送音频异常: {e}")
        finally:
            if stream:
                stream.stop_stream()
                stream.close()
            if p:
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
    def __init__(self, config=None):
        self.recognizer = VoiceRecognizer(config)
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
        import threading
        import time
        
        try:
            # 读取音频文件
            try:
                wf = wave.open(audio_file_path, 'rb')
            except Exception as e:
                # 保底方案：尝试修复 WAV 头部
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

            audio_data = wf.readframes(wf.getnframes())
            wf.close()
            
            if audio_file_path.endswith(".fixed.wav") and os.path.exists(audio_file_path):
                try: os.remove(audio_file_path)
                except: pass
            
            transcript_container = {"text": ""}
            complete_event = threading.Event()
            error_container = {"error": None}
            
            def on_complete(text):
                transcript_container["text"] = text
                complete_event.set()
            
            def on_error(error):
                error_container["error"] = error
                complete_event.set()
            
            # 使用识别器推送模式，禁用本地 PyAudio
            self.recognizer.start(on_complete=on_complete, on_error=on_error, use_pyaudio=False)
            
            # 等待连接建立
            max_wait = 50
            while not (self.recognizer.ws and self.recognizer.ws.sock and self.recognizer.ws.sock.connected) and max_wait > 0:
                time.sleep(0.1)
                max_wait -= 1
            
            if not (self.recognizer.ws and self.recognizer.ws.sock and self.recognizer.ws.sock.connected):
                self.recognizer.stop()
                raise Exception("无法建立 ASR WebSocket 连接")

            # 分片推送音频
            chunk_size = 1280 # 讯飞推荐的分片大小
            for i in range(0, len(audio_data), chunk_size):
                if error_container["error"]: break
                chunk = audio_data[i:i + chunk_size]
                self.recognizer.push_audio(chunk)
                time.sleep(0.04) # 模拟实时流速
            
            # 停止识别并等待结果
            self.recognizer.stop()
            if complete_event.wait(timeout=30):
                if error_container["error"]:
                    raise Exception(error_container["error"])
                return transcript_container["text"]
            else:
                raise Exception("转录超时")
            
        except Exception as e:
            print(f"文件转录失败: {str(e)}")
            raise e
