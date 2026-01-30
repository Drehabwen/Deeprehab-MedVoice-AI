from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import base64
import tempfile
from datetime import datetime
import logging

from voice import VoiceRecorder
from nlp_processor import NLPProcessor
from case_structurer import CaseStructurer
from document_generator import DocumentGenerator
from case_manager import CaseManager

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 加载配置
def load_config():
    config_path = "config.json"
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    else:
        return {
            "hospital_name": "XX社区卫生服务中心",
            "doctor_name": "王医生",
            "audio_sample_rate": 16000,
            "audio_channels": 1,
            "cases_dir": "./cases",
            "exports_dir": "./exports"
        }

config = load_config()

recorder = VoiceRecorder()
nlp_processor = NLPProcessor()
case_structurer = CaseStructurer(nlp_processor)
doc_generator = DocumentGenerator(config)
case_manager = CaseManager(config)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'success',
        'message': 'API服务运行正常',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'status': 'error',
                'message': '请求数据为空'
            }), 400
        
        audio_data = data.get('audio_data')
        audio_format = data.get('format', 'wav')
        
        if not audio_data:
            return jsonify({
                'status': 'error',
                'message': '缺少音频数据'
            }), 400
        
        try:
            audio_bytes = base64.b64decode(audio_data)
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': f'音频数据解码失败: {str(e)}'
            }), 400
        
        with tempfile.NamedTemporaryFile(suffix=f'.{audio_format}', delete=False) as temp_file:
            temp_file.write(audio_bytes)
            temp_file_path = temp_file.name
        
        try:
            transcript = recorder.transcribe_file(temp_file_path)
            
            return jsonify({
                'status': 'success',
                'data': {
                    'transcript': transcript,
                    'timestamp': datetime.now().isoformat()
                }
            })
        finally:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
    
    except Exception as e:
        logger.error(f'转录失败: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'转录失败: {str(e)}'
        }), 500

@app.route('/api/structure', methods=['POST'])
def structure_case():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'status': 'error',
                'message': '请求数据为空'
            }), 400
        
        transcript = data.get('transcript')
        
        if not transcript:
            return jsonify({
                'status': 'error',
                'message': '缺少转录文本'
            }), 400
        
        separate_speakers = data.get('separate_speakers', True)
        
        # 使用新的模块化工作流：分析 -> 结构化
        analyzed_dialogue = case_structurer.analyze_dialogue(transcript)
        structured_case = case_structurer.structure(analyzed_dialogue)
        
        return jsonify({
            'status': 'success',
            'data': {
                'analyzed_dialogue': analyzed_dialogue,
                'structured_case': structured_case,
                'timestamp': datetime.now().isoformat()
            }
        })
    
    except Exception as e:
        logger.error(f'病例结构化失败: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'病例结构化失败: {str(e)}'
        }), 500

@app.route('/api/generate', methods=['POST'])
def generate_medical_record():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'status': 'error',
                'message': '请求数据为空'
            }), 400
        
        structured_case = data.get('structured_case')
        
        if not structured_case:
            return jsonify({
                'status': 'error',
                'message': '缺少结构化病例数据'
            }), 400
        
        patient_info = data.get('patient_info', {})
        doctor_info = data.get('doctor_info', {})
        
        # 合并信息
        case_data = {**structured_case, **patient_info}
        config_info = {**config, **doctor_info}
        
        medical_record = case_structurer.generate_report(
            case_data,
            config_info
        )
        
        return jsonify({
            'status': 'success',
            'data': {
                'medical_record': medical_record,
                'timestamp': datetime.now().isoformat()
            }
        })
    
    except Exception as e:
        logger.error(f'病历生成失败: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'病历生成失败: {str(e)}'
        }), 500

@app.route('/api/export', methods=['POST'])
def export_document():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'status': 'error',
                'message': '请求数据为空'
            }), 400
        
        medical_record = data.get('medical_record')
        patient_info = data.get('patient_info', {})
        doctor_info = data.get('doctor_info', {})
        
        if not medical_record:
            return jsonify({
                'status': 'error',
                'message': '缺少病历数据'
            }), 400
        
        docx_path = doc_generator.generate_document(
            medical_record,
            patient_info,
            doctor_info
        )
        
        if not docx_path:
            return jsonify({
                'status': 'error',
                'message': '文档生成失败'
            }), 500
        
        with open(docx_path, 'rb') as f:
            docx_base64 = base64.b64encode(f.read()).decode('utf-8')
        
        return jsonify({
            'status': 'success',
            'data': {
                'document_base64': docx_base64,
                'filename': os.path.basename(docx_path),
                'timestamp': datetime.now().isoformat()
            }
        })
    
    except Exception as e:
        logger.error(f'文档导出失败: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'文档导出失败: {str(e)}'
        }), 500

@app.route('/api/case/save', methods=['POST'])
def save_case():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'status': 'error',
                'message': '请求数据为空'
            }), 400
        
        case_data = data.get('case_data')
        
        if not case_data:
            return jsonify({
                'status': 'error',
                'message': '缺少病例数据'
            }), 400
        
        case_id = case_manager.save_case(case_data)
        
        return jsonify({
            'status': 'success',
            'data': {
                'case_id': case_id,
                'timestamp': datetime.now().isoformat()
            }
        })
    
    except Exception as e:
        logger.error(f'病例保存失败: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'病例保存失败: {str(e)}'
        }), 500

@app.route('/api/case/<case_id>', methods=['GET'])
def get_case(case_id):
    try:
        case_data = case_manager.load_case(case_id)
        
        if not case_data:
            return jsonify({
                'status': 'error',
                'message': '病例不存在'
            }), 404
        
        return jsonify({
            'status': 'success',
            'data': case_data
        })
    
    except Exception as e:
        logger.error(f'病例加载失败: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'病例加载失败: {str(e)}'
        }), 500

@app.route('/api/cases', methods=['GET'])
def list_cases():
    try:
        cases = case_manager.list_cases()
        
        return jsonify({
            'status': 'success',
            'data': {
                'cases': cases,
                'total': len(cases)
            }
        })
    
    except Exception as e:
        logger.error(f'病例列表获取失败: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'病例列表获取失败: {str(e)}'
        }), 500

@app.route('/api/case/<case_id>', methods=['DELETE'])
def delete_case(case_id):
    try:
        success = case_manager.delete_case(case_id)
        
        if not success:
            return jsonify({
                'status': 'error',
                'message': '病例不存在或删除失败'
            }), 404
        
        return jsonify({
            'status': 'success',
            'message': '病例删除成功'
        })
    
    except Exception as e:
        logger.error(f'病例删除失败: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'病例删除失败: {str(e)}'
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'status': 'error',
        'message': '请求的资源不存在'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'status': 'error',
        'message': '服务器内部错误'
    }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
