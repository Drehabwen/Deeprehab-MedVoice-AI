const API_BASE = `${window.location.protocol}//${window.location.host}`;
const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

// State Management
let rec; // Recorder 实例
let isRecording = false;
let streamSocket = null;
let timerInterval;
let startTime;
let lastProcessIndex = 0; // 用于流式发送音频的分片索引

// DOM Elements
const recordBtn = document.getElementById('record-btn');
const recordStatus = document.getElementById('record-status');
const timerDisplay = document.getElementById('recording-timer');
const transcriptContent = document.getElementById('transcript-content');
const structureBtn = document.getElementById('structure-btn');
const structuredView = document.getElementById('structured-view');
const exportDocxBtn = document.getElementById('export-docx');
const exportPdfBtn = document.getElementById('export-pdf');
const copyDataBtn = document.getElementById('copy-data');
const saveCaseBtn = document.getElementById('save-case');
const newCaseBtn = document.getElementById('new-case-btn');
const patientNameInput = document.getElementById('patient-name');
const patientAgeInput = document.getElementById('patient-age');
const patientGenderInput = document.getElementById('patient-gender');
const searchInput = document.getElementById('search-input');

// Tabs
const tabData = document.getElementById('tab-data');
const tabSuggestions = document.getElementById('tab-suggestions');
const tabReport = document.getElementById('tab-report');
const suggestionsView = document.getElementById('suggestions-view');
const reportView = document.getElementById('report-view');
const suggestionsContent = document.getElementById('suggestions-content');
const reportContent = document.getElementById('report-content');

// State Variables
let currentStructuredData = null;
let currentCaseId = null; // 记录当前正在查看的病例 ID
let allCases = []; // 存储所有病例用于前端搜索

// --- Utility Functions ---

/**
 * 适配 recorder-core 的音频处理逻辑
 * recorder-core 的 buffers 默认是 Int16Array (PCM)
 */
function processAudioStream(int16Buffer, inputSampleRate) {
    const targetSampleRate = 16000;
    const gain = 1.2; // 稍微增加一点音量，不宜过大防止削波
    
    // 类型检查：确保是 Int16Array
    if (!(int16Buffer instanceof Int16Array)) {
        console.warn('收到非 Int16Array 数据，尝试转换...');
        // 如果意外收到 Float32Array，进行转换
        if (int16Buffer instanceof Float32Array) {
            const newBuf = new Int16Array(int16Buffer.length);
            for(let i=0; i<int16Buffer.length; i++) {
                let s = Math.max(-1, Math.min(1, int16Buffer[i]));
                newBuf[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            int16Buffer = newBuf;
        } else {
            return new Int16Array(0);
        }
    }

    // 采样率一致的情况
    if (inputSampleRate === targetSampleRate) {
        if (gain === 1) return int16Buffer;
        const result = new Int16Array(int16Buffer.length);
        for (let i = 0; i < int16Buffer.length; i++) {
            let s = int16Buffer[i] * gain;
            result[i] = Math.max(-32768, Math.min(32767, s));
        }
        return result;
    }

    // 需要重采样 (线性插值)
    const ratio = inputSampleRate / targetSampleRate;
    const newLength = Math.floor(int16Buffer.length / ratio);
    const result = new Int16Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
        const offset = i * ratio;
        const leftIndex = Math.floor(offset);
        const rightIndex = Math.min(leftIndex + 1, int16Buffer.length - 1);
        const fraction = offset - leftIndex;
        
        // 插值计算
        const interpolatedValue = int16Buffer[leftIndex] + (int16Buffer[rightIndex] - int16Buffer[leftIndex]) * fraction;
        
        // 应用增益并限幅
        let s = interpolatedValue * gain;
        result[i] = Math.max(-32768, Math.min(32767, s));
    }
    return result;
}

// --- Recording Logic (Using Browser-side Recorder + WebSocket Streaming) ---

async function startRecording() {
    // 1. 初始化 WebSocket
    const wsUrl = `${WS_BASE}/ws/stream_transcribe`;
    console.log('正在启动流式转录服务...', wsUrl);
    
    try {
        streamSocket = new WebSocket(wsUrl);
        streamSocket.binaryType = 'arraybuffer';

        streamSocket.onopen = () => {
            console.log('WebSocket 连接成功，等待音频输入...');
            recordStatus.innerText = "正在聆听...";
        };

        streamSocket.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.status === 'update') {
                    transcriptContent.innerText = data.text;
                    transcriptContent.scrollTop = transcriptContent.scrollHeight;
                    // 只要有文字，就允许点击结构化按钮
                    if (data.text && data.text.length > 5) {
                        structureBtn.disabled = false;
                    }
                } else if (data.status === 'complete') {
                    transcriptContent.innerText = data.text;
                    structureBtn.disabled = false; // 确保完成时按钮可用
                    showToast("录音已完成，正在自动启动 AI 角色分析与结构化...");
                    handleStructure(); // 自动进入下一阶段
                } else if (data.status === 'error') {
                    console.error('ASR 后端错误:', data.message);
                    showToast("转录异常: " + data.message, "error");
                }
            } catch (err) {
                console.error('解析后端消息失败:', err);
            }
        };

        streamSocket.onerror = (err) => {
            console.error('WebSocket 通讯故障:', err);
            showToast("通讯链路异常，请刷新页面重试", "error");
        };

        streamSocket.onclose = () => console.log('WebSocket 链路已正常关闭');
    } catch (err) {
        console.error('WebSocket 初始化失败:', err);
        showToast("无法启动实时链路", "error");
        return;
    }

    // 2. 初始化录音引擎 (Recorder-Core)
    lastProcessIndex = 0;
    rec = Recorder({
        type: "wav",
        sampleRate: 16000,
        bitRate: 16,
        onProcess: function(buffers, powerLevel, bufferDuration, bufferSampleRate) {
            if (isRecording && streamSocket && streamSocket.readyState === WebSocket.OPEN) {
                while (lastProcessIndex < buffers.length) {
                    const buffer = buffers[lastProcessIndex];
                    const pcm = processAudioStream(buffer, bufferSampleRate);
                    if (pcm.length > 0) {
                        streamSocket.send(pcm.buffer);
                    }
                    lastProcessIndex++;
                }
            }
        }
    });

    rec.open(function() {
        rec.start();
        isRecording = true;
        updateUI(true);
        startTimer();
        transcriptContent.innerText = "正在初始化语音识别...";
    }, function(msg, isUserNotAllow) {
        showToast((isUserNotAllow ? "请授予麦克风访问权限" : "录音引擎启动失败：" + msg), "error");
        if (streamSocket) streamSocket.close();
    });
}

async function stopRecording() {
    if (!isRecording || !rec) return;
    
    isRecording = false;
    updateUI(false);
    stopTimer();
    
    recordStatus.innerText = "正在完成转录...";
    
    // 发送停止指令
    if (streamSocket && streamSocket.readyState === WebSocket.OPEN) {
        streamSocket.send(JSON.stringify({ command: "stop" }));
    }

    rec.stop(function(blob, duration) {
        rec.close();
        rec = null;
        console.log('录音停止，时长:', duration);
        // 这里不需要再 fetch 转录接口，因为 WebSocket 会返回最终结果并触发 handleStructure
    }, function(msg) {
        showToast("录音停止失败：" + msg, "error");
    });
}

// --- Analysis Logic ---

async function handleStructure() {
    const transcript = transcriptContent.innerText;
    if (!transcript || transcript.length < 5 || transcript.includes("等待录音")) {
        showToast("暂无有效转录内容，无法分析", "error");
        return;
    }

    if (structureBtn.disabled && !isRecording) {
        // 防止重复点击，但如果是自动触发则继续
    }
    
    structureBtn.disabled = true;
    structureBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> 正在深度分析...';
    
    // 给用户一点视觉反馈，知道正在处理
    recordStatus.innerText = "AI 正在结构化处理...";
    
    try {
        console.log("开始请求结构化分析 API...");
        const startTime = Date.now();
        
        const response = await fetch(`${API_BASE}/api/structure`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript })
        });
        
        const result = await response.json();
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`结构化分析完成，耗时: ${duration}s`);

        if (result.status === 'success') {
            currentStructuredData = result.data.structured_case;
            displayStructuredData(result.data.structured_case);
            
            // 如果有对话分析结果，也可以更新 UI（可选）
            if (result.data.analyzed_dialogue) {
                // 可以在这里做更多事情，比如更新对话显示
            }

            exportDocxBtn.disabled = false;
            exportPdfBtn.disabled = false;
            copyDataBtn.disabled = false;
            saveCaseBtn.disabled = false;
            recordStatus.innerText = "分析完成";
            showToast(`病例结构化分析完成 (耗时 ${duration}s)`);
        } else {
            showToast("分析失败: " + result.message, "error");
            recordStatus.innerText = "分析失败";
        }
    } catch (err) {
        showToast("分析请求失败: " + err.message, "error");
        recordStatus.innerText = "请求异常";
    } finally {
        structureBtn.innerHTML = '<i class="fas fa-magic mr-1"></i> 结构化分析';
        structureBtn.disabled = false;
    }
}

function displayStructuredData(data) {
    structuredView.innerHTML = '';
    
    // 1. 显示结构化要素
    const sections = [
        { key: '主诉', icon: 'fa-comment-dots' },
        { key: '现病史', icon: 'fa-history' },
        { key: '既往史', icon: 'fa-notes-medical' },
        { key: '体格检查', icon: 'fa-user-md' },
        { key: '诊断', icon: 'fa-stethoscope' },
        { key: '处理意见', icon: 'fa-pills' }
    ];

    sections.forEach(sec => {
        const val = data[sec.key] || '未提取';
        const card = document.createElement('div');
        card.className = 'p-4 bg-slate-50 rounded-xl border border-slate-100 group transition-all hover:shadow-md';
        card.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center space-x-2">
                    <i class="fas ${sec.icon} text-blue-500 text-xs"></i>
                    <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">${sec.key}</span>
                </div>
                <span class="text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">点击可直接修改</span>
            </div>
            <textarea class="w-full bg-transparent border-none text-sm text-slate-700 leading-relaxed resize-none focus:ring-0 p-0 overflow-hidden" 
                      rows="1"
                      placeholder="未输入...">${val === '未提取' ? '' : val}</textarea>
        `;
        
        const textarea = card.querySelector('textarea');
        
        // 自动调整高度
        const autoHeight = () => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        };
        
        textarea.addEventListener('input', () => {
            autoHeight();
            if (!currentStructuredData) {
                currentStructuredData = {
                    patient_name: patientNameInput.value,
                    gender: patientGenderInput.value,
                    age: patientAgeInput.value,
                    markdown_content: "",
                    ai_suggestions: ""
                };
            }
            currentStructuredData[sec.key] = textarea.value;
            saveCaseBtn.disabled = false;
        });
        
        // 初始高度
        setTimeout(autoHeight, 0);
        
        structuredView.appendChild(card);
    });

    // 2. 更新 AI 建议
    suggestionsContent.innerText = data.ai_suggestions || "暂无建议";
    
    // 3. 更新病历报告 (改为可编辑)
    reportContent.value = data.markdown_content || "暂无完整病历";
    
    // 监听报告编辑
    reportContent.oninput = () => {
        if (currentStructuredData) {
            currentStructuredData.markdown_content = reportContent.value;
            saveCaseBtn.disabled = false;
        }
    };
}

// --- Export & Save Logic ---

async function handleExportDocx() {
    await handleExport('docx', exportDocxBtn);
}

async function handleExportPdf() {
    await handleExport('pdf', exportPdfBtn);
}

async function handleExport(format, btn) {
    if (!currentStructuredData) return;

    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i> ${format.toUpperCase()}`;

    try {
        const patientInfo = {
            patient_name: patientNameInput.value || "匿名",
            age: patientAgeInput.value || "未知",
            gender: patientGenderInput.value || "未知"
        };

        const response = await fetch(`${API_BASE}/api/export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                case_data: {
                    ...(currentStructuredData || {}),
                    ...patientInfo,
                    case_id: currentCaseId || "NEW"
                },
                export_format: format
            })
        });

        const result = await response.json();
        if (result.status === 'success') {
            showToast(`${format.toUpperCase()} 文档导出成功`);
            console.log("File saved at:", result.data.file_path);
        } else {
            showToast("导出失败: " + result.message, "error");
        }
    } catch (err) {
        showToast("导出请求失败: " + err.message, "error");
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

function handleCopy() {
    if (!currentStructuredData) return;

    let copyText = `患者信息：\n姓名：${patientNameInput.value || "匿名"}  年龄：${patientAgeInput.value || "未知"}  性别：${patientGenderInput.value || "未知"}\n\n`;
    
    const sections = ['主诉', '现病史', '既往史', '体格检查', '诊断', '处理意见'];
    sections.forEach(sec => {
        if (currentStructuredData[sec]) {
            copyText += `【${sec}】\n${currentStructuredData[sec]}\n\n`;
        }
    });

    if (currentStructuredData.ai_suggestions) {
        copyText += `【AI 临床建议】\n${currentStructuredData.ai_suggestions}\n`;
    }

    navigator.clipboard.writeText(copyText).then(() => {
        showToast("病历内容已复制到剪贴板");
    }).catch(err => {
        console.error('复制失败:', err);
        showToast("复制失败", "error");
    });
}

async function handleSaveCase() {
    if (!currentStructuredData) return;

    saveCaseBtn.disabled = true;
    saveCaseBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> 正在保存...';

    try {
        const patientInfo = {
            patient_name: patientNameInput.value || "匿名",
            age: patientAgeInput.value || "未知",
            gender: patientGenderInput.value || "未知"
        };

        const response = await fetch(`${API_BASE}/api/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                case_data: {
                    ...currentStructuredData,
                    ...patientInfo,
                    case_id: currentCaseId // 如果是编辑，会带上 ID
                }
            })
        });

        const result = await response.json();
        if (result.status === 'success') {
            currentCaseId = result.data.case_id; // 保存返回的新 ID 或原始 ID
            showToast("病例已保存到服务器");
            loadHistory(); // 刷新侧边栏历史记录
        } else {
            showToast("保存失败: " + result.message, "error");
        }
    } catch (err) {
        showToast("保存失败: " + err.message, "error");
    } finally {
        saveCaseBtn.innerHTML = '<i class="fas fa-save mr-2"></i> 保存病例';
        saveCaseBtn.disabled = false;
    }
}

async function loadHistory() {
    try {
        const response = await fetch(`${API_BASE}/api/cases`);
        const result = await response.json();
        
        if (result.status === 'success') {
            allCases = result.data.cases;
            renderHistoryList(allCases);
        }
    } catch (err) {
        console.error("加载历史记录失败:", err);
    }
}

function renderHistoryList(cases) {
    const historyList = document.getElementById('history-list');
    
    if (cases.length === 0) {
        historyList.innerHTML = '<div class="px-4 py-3 text-sm text-slate-500 italic">暂无匹配记录</div>';
        return;
    }
    
    historyList.innerHTML = '';
    // 按日期倒序排列
    const displayCases = [...cases].reverse();
    
    displayCases.forEach(c => {
        const item = document.createElement('div');
        item.className = 'px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors border-b border-slate-50 last:border-0';
        // 如果是当前选中的病例，添加高亮样式
        if (currentCaseId === c.case_id) {
            item.classList.add('bg-blue-50', 'border-blue-100');
        }
        item.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <span class="font-semibold text-slate-800">${c.patient_name}</span>
                <span class="text-[10px] text-slate-400">${c.visit_date}</span>
            </div>
            <div class="text-xs text-slate-400 truncate">${c.diagnosis}</div>
        `;
        item.onclick = () => handleLoadCase(c.case_id);
        historyList.appendChild(item);
    });
}

// 搜索监听
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allCases.filter(c => 
        c.patient_name.toLowerCase().includes(query) || 
        c.diagnosis.toLowerCase().includes(query)
    );
    renderHistoryList(filtered);
});

async function handleLoadCase(caseId) {
    try {
        const response = await fetch(`${API_BASE}/api/cases/${caseId}`);
        const result = await response.json();
        
        if (result.status === 'success') {
            const caseData = result.data.case;
            currentCaseId = caseId; // 设置当前病例 ID
            
            // 1. 更新患者信息
            patientNameInput.value = caseData.patient_name || "";
            patientAgeInput.value = caseData.age || "";
            patientGenderInput.value = caseData.gender || "未知";
            
            // 2. 更新结构化数据
            currentStructuredData = {
                '主诉': caseData['主诉'],
                '现病史': caseData['现病史'],
                '既往史': caseData['既往史'],
                '体格检查': caseData['体格检查'],
                '诊断': caseData['诊断'],
                '处理意见': caseData['处理意见'],
                'ai_suggestions': caseData['ai_suggestions'] || "",
                'markdown_content': caseData['markdown_content'] || ""
            };
            displayStructuredData(currentStructuredData);
            exportDocxBtn.disabled = false;
            exportPdfBtn.disabled = false;
            copyDataBtn.disabled = false;
            saveCaseBtn.disabled = false;
            
            // 3. 刷新列表显示选中状态
            renderHistoryList(allCases);
            
            // 4. 更新原始对话（如果有的话）
            if (caseData.transcript) {
                transcriptContent.innerText = caseData.transcript;
            } else {
                transcriptContent.innerText = "（历史病例无原始录音文本）";
            }
            
            // 5. 启用相关按钮
            exportDocxBtn.disabled = false;
            saveCaseBtn.disabled = false;
            
            showToast("病例已加载");
        } else {
            showToast("加载病例失败: " + result.message, "error");
        }
    } catch (err) {
        console.error("加载病例详情失败:", err);
        showToast("加载病例详情失败", "error");
    }
}

// --- Event Listeners & Initialization ---

recordBtn.addEventListener('click', () => {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
});

structureBtn.addEventListener('click', handleStructure);
exportDocxBtn.addEventListener('click', handleExportDocx);
exportPdfBtn.addEventListener('click', handleExportPdf);
copyDataBtn.addEventListener('click', handleCopy);
saveCaseBtn.addEventListener('click', handleSaveCase);
newCaseBtn.addEventListener('click', () => {
    if (confirm("确定要开始新病例吗？当前未保存的数据将丢失。")) {
        resetUI();
    }
});

// Tab switching logic
function switchTab(activeTab) {
    const tabs = [tabData, tabSuggestions, tabReport];
    const views = [structuredView, suggestionsView, reportView];
    
    tabs.forEach((tab, i) => {
        if (tab === activeTab) {
            tab.classList.add('border-blue-600', 'text-blue-600');
            tab.classList.remove('border-transparent', 'text-slate-400');
            views[i].classList.remove('hidden');
        } else {
            tab.classList.remove('border-blue-600', 'text-blue-600');
            tab.classList.add('border-transparent', 'text-slate-400');
            views[i].classList.add('hidden');
        }
    });
}

tabData.addEventListener('click', () => switchTab(tabData));
tabSuggestions.addEventListener('click', () => switchTab(tabSuggestions));
tabReport.addEventListener('click', () => switchTab(tabReport));

// Health Check and Initial Load
window.addEventListener('load', async () => {
    loadHistory();
    try {
        const res = await fetch(`${API_BASE}/health`);
        const data = await res.json();
        if (data.status === 'success') {
            console.log("Backend Connected");
        }
    } catch (e) {
        showToast("无法连接到后端服务，请检查服务器是否启动", "error");
    }
});

function resetUI() {
    currentStructuredData = null;
    currentCaseId = null;
    patientNameInput.value = "";
    patientAgeInput.value = "";
    patientGenderInput.value = "男";
    transcriptContent.innerText = "等待录音或手动输入对话内容...";
    renderHistoryList(allCases); // 刷新列表取消高亮
    structuredView.innerHTML = `
        <div class="text-center col-span-2 py-12 text-slate-400">
            <i class="fas fa-file-medical text-4xl mb-4 block"></i>
            <p>分析完成后在此展示详细病历要素</p>
        </div>
    `;
    suggestionsContent.innerText = "分析完成后在此展示 AI 建议";
    reportContent.value = "";
    reportContent.placeholder = "分析完成后在此展示完整病历";
    switchTab(tabData);
    structureBtn.disabled = true;
    exportDocxBtn.disabled = true;
    exportPdfBtn.disabled = true;
    copyDataBtn.disabled = true;
    saveCaseBtn.disabled = true;
    recordStatus.innerText = "准备接诊";
    timerDisplay.innerText = "00:00";
    timerDisplay.classList.add('hidden');
}

// --- UI Utilities ---

function updateUI(recording) {
    if (recording) {
        recordBtn.classList.add('bg-red-500', 'hover:bg-red-600', 'recording-pulse');
        recordBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        recordBtn.innerHTML = '<i class="fas fa-stop"></i>';
        recordStatus.innerText = "正在录音...";
        timerDisplay.classList.remove('hidden');
    } else {
        recordBtn.classList.remove('bg-red-500', 'hover:bg-red-600', 'recording-pulse');
        recordBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        recordBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        recordStatus.innerText = "录音结束";
        // timerDisplay.classList.add('hidden');
    }
}

function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const diff = Date.now() - startTime;
        const mins = Math.floor(diff / 60000).toString().padStart(2, '0');
        const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        timerDisplay.innerText = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    const toastIcon = document.getElementById('toast-icon');
    
    toastMsg.innerText = msg;
    if (type === 'error') {
        toastIcon.className = 'fas fa-exclamation-circle text-red-400';
    } else {
        toastIcon.className = 'fas fa-check-circle text-green-400';
    }
    
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}
