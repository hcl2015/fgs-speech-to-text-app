// Add at the very top of speech-transcriber.js
console.log('Speech Transcriber JS loaded successfully!');

// speech-transcriber.js
class MicrosoftSpeechTranscriber {
    constructor() {
        this.recognizer = null;
        this.isListening = false;
        this.isLoggedIn = false;
        this.currentUser = null;
        this.configLoaded = false;
        
        // Azure API Configuration (will be loaded from backend API)
        this.azureConfig = {
            subscriptionKey: '',
            serviceRegion: '',
            useCustomModel: false,
            customEndpointId: ''
        };
        this.savedUseCustomModel = false;
        
        // Qwen API Configuration - OpenAI Compatible (will be loaded from backend API)
        this.qwenConfig = {
            apiKey: '',
            apiUrl: '',
            model: 'qwen-max'
        };
        
        // User credentials
        this.validUsers = {
            "fgsuser": "fgs2025",
            "admin": "admin123",
            "user": "password123"
        };
        
        // Relevant phrases for text rewriting
        this.relevantPhrases = "佛性,釋迦牟尼佛,般若波羅蜜多心經,戒定慧,空性,南無,眾生,三大阿僧祇劫";
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkLoginStatus();
        this.loadCustomModelPreference();
        this.loadRewritePreference();
        this.updateCustomModelAvailability(true);
        this.loadApiConfiguration();
    }
    
    initializeElements() {
        // DOM elements
        this.loginModal = document.getElementById('loginModal');
        this.appContainer = document.getElementById('appContainer');
        this.userInfo = document.getElementById('userInfo');
        this.userDisplayName = document.getElementById('userDisplayName');
        this.loginBtn = document.getElementById('loginBtn');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.loginError = document.getElementById('loginError');
        this.customModelOption = document.getElementById('customModelOption');
        
        // Debug: Check if elements are found
        console.log('Login button found:', this.loginBtn);
        console.log('Username input found:', this.usernameInput);   
        
        // Custom model checkbox
        this.useCustomModelCheckbox = document.getElementById('useCustomModel');
        this.enableRewriteCheckbox = document.getElementById('enableRewrite');
        this.relevantPhrasesInput = document.getElementById('relevantPhrases');
        this.customModelNotice = document.getElementById('customModelNotice');
        
        // Transcription elements
        this.transcriptElement = document.getElementById('transcript');
        this.statusElement = document.getElementById('status');
        this.wordCountElement = document.getElementById('wordCount');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.languageSelect = document.getElementById('language');
        
        // Transcript storage
        this.fullTranscript = '';
        this.rewrittenTranscript = '';
        this.lastOriginalText = '';
    }
    
    setupEventListeners() {
        // Login events - FIXED: Add proper event listeners
        if (this.loginBtn) {
            this.loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }
        
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        }
        
        // Allow login on Enter key
        if (this.passwordInput) {
            this.passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleLogin();
                }
            });
        }

        if (this.usernameInput) {
            this.usernameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleLogin();
                }
            });
        }
        
        // Custom model checkbox event
        if (this.useCustomModelCheckbox) {
            this.useCustomModelCheckbox.addEventListener('change', () => this.saveCustomModelPreference());
        }
        if (this.enableRewriteCheckbox) {
            this.enableRewriteCheckbox.addEventListener('change', () => this.saveRewritePreference());
        }
        if (this.relevantPhrasesInput) {
            this.relevantPhrasesInput.addEventListener('change', () => this.saveRelevantPhrases());
        }

        if (this.languageSelect) {
            this.languageSelect.addEventListener('change', () => this.handleLanguageChange());
        }
        
        // Transcription events
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => this.startTranscription());
        }
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => this.stopTranscription());
        }
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.clearTranscript());
        }
        if (this.downloadBtn) {
            this.downloadBtn.addEventListener('click', () => this.downloadTranscript());
        }
    }
    
    checkLoginStatus() {
        const savedUser = sessionStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = savedUser;
            this.isLoggedIn = true;
            this.showApplication();
        } else {
            this.showLogin();
        }
    }
    
    handleLogin() {
        console.log('Login button clicked');
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value;
        
        console.log('Username:', username, 'Password:', password ? '***' : 'empty');
        
        if (this.authenticateUser(username, password)) {
            this.currentUser = username;
            this.isLoggedIn = true;
            sessionStorage.setItem('currentUser', username);
            this.showApplication();
            this.hideLoginError();
            console.log('Login successful for user:', username);
        } else {
            this.showLoginError();
            console.log('Login failed for user:', username);
        }
    }
    
    handleLogout() {
        console.log('Logout clicked');
        this.currentUser = null;
        this.isLoggedIn = false;
        sessionStorage.removeItem('currentUser');
        this.stopTranscription();
        this.showLogin();
    }
    
    authenticateUser(username, password) {
        return this.validUsers[username] === password;
    }
    
    showLogin() {
        console.log('Showing login modal');
        if (this.loginModal) this.loginModal.style.display = 'flex';
        if (this.appContainer) this.appContainer.style.display = 'none';
        if (this.userInfo) this.userInfo.style.display = 'none';
        if (this.usernameInput) {
            this.usernameInput.value = '';
            this.usernameInput.focus();
        }
        if (this.passwordInput) this.passwordInput.value = '';
    }
    
    showApplication() {
        console.log('Showing application for user:', this.currentUser);
        if (this.loginModal) this.loginModal.style.display = 'none';
        if (this.appContainer) this.appContainer.style.display = 'block';
        if (this.userInfo) this.userInfo.style.display = 'block';
        if (this.userDisplayName) this.userDisplayName.textContent = this.currentUser;
        this.updateUI();
    }
    
    showLoginError() {
        console.log('Showing login error');
        if (this.loginError) {
            this.loginError.style.display = 'block';
            this.loginError.textContent = 'Invalid username or password 用戶名或密碼錯誤';
        }
    }
    
    hideLoginError() {
        if (this.loginError) this.loginError.style.display = 'none';
    }
    
    loadCustomModelPreference() {
        const useCustomModel = localStorage.getItem('useCustomModel');
        this.savedUseCustomModel = useCustomModel === 'true';
    }
    
    saveCustomModelPreference() {
        if (!this.useCustomModelCheckbox) return;
        if (!this.isSimplifiedChineseSelected()) {
            this.useCustomModelCheckbox.checked = false;
            this.azureConfig.useCustomModel = false;
            return;
        }
        this.azureConfig.useCustomModel = this.useCustomModelCheckbox.checked;
        this.savedUseCustomModel = this.azureConfig.useCustomModel;
        localStorage.setItem('useCustomModel', this.azureConfig.useCustomModel.toString());
    }

    handleLanguageChange() {
        this.updateCustomModelAvailability();
    }

    isSimplifiedChineseSelected() {
        return this.languageSelect && this.languageSelect.value === 'zh-CN';
    }

    updateCustomModelAvailability(initialLoad = false) {
        if (!this.useCustomModelCheckbox) return;
        const isSimplified = this.isSimplifiedChineseSelected();
        this.useCustomModelCheckbox.disabled = !isSimplified;
        if (this.customModelOption) {
            this.customModelOption.style.display = isSimplified ? 'block' : 'none';
        }
        if (!isSimplified) {
            if (this.useCustomModelCheckbox.checked) {
                this.useCustomModelCheckbox.checked = false;
            }
            this.azureConfig.useCustomModel = false;
        } else {
            const shouldUse = this.savedUseCustomModel;
            this.useCustomModelCheckbox.checked = shouldUse;
            this.azureConfig.useCustomModel = shouldUse;
        }

        const checkboxGroup = this.useCustomModelCheckbox.closest('.checkbox-group');
        if (checkboxGroup) {
            checkboxGroup.classList.toggle('disabled', !isSimplified);
        }

        if (this.customModelNotice) {
            this.customModelNotice.textContent = isSimplified
                ? 'Custom model option enabled for Simplified Chinese.'
                : 'Custom model is available only when Simplified Chinese is selected.';
        }
    }
    
    loadRewritePreference() {
        const enableRewrite = localStorage.getItem('enableRewrite');
        if (enableRewrite === 'true' && this.enableRewriteCheckbox) {
            this.enableRewriteCheckbox.checked = true;
        }
        
        const savedPhrases = localStorage.getItem('relevantPhrases');
        if (savedPhrases && this.relevantPhrasesInput) {
            this.relevantPhrases = savedPhrases;
            this.relevantPhrasesInput.value = savedPhrases;
        }
    }
    
    saveRewritePreference() {
        localStorage.setItem('enableRewrite', this.enableRewriteCheckbox.checked);
    }
    
    saveRelevantPhrases() {
        this.relevantPhrases = this.relevantPhrasesInput.value;
        localStorage.setItem('relevantPhrases', this.relevantPhrases);
    }

    async loadApiConfiguration() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) {
                console.error('Failed to load API configuration:', await response.text());
                this.updateStatus('Failed to load API configuration from server.', 'error');
                return;
            }

            const config = await response.json();
            console.log('Loaded API configuration from backend:', config);

            this.azureConfig.subscriptionKey = config.azureSubscriptionKey || '';
            this.azureConfig.serviceRegion = config.azureServiceRegion || 'eastus';
            this.azureConfig.customEndpointId = config.azureCustomEndpointId || '';

            this.qwenConfig.apiKey = config.qwenApiKey || '';
            this.qwenConfig.apiUrl = config.qwenApiUrl ||
                'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

            this.configLoaded = !!(this.azureConfig.subscriptionKey && this.azureConfig.serviceRegion);
            if (!this.configLoaded) {
                this.updateStatus('Speech API configuration is incomplete. Please contact the administrator.', 'error');
            }
        } catch (error) {
            console.error('Error loading API configuration:', error);
            this.updateStatus('Error loading API configuration from server.', 'error');
        }
    }
    
    async rewriteContent(inputText) {
        if (!inputText.trim()) return inputText;
        
        try {
            // Call backend rewrite API instead of Qwen directly from browser
            const response = await fetch('/api/rewrite-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: inputText,
                    relevantPhrases: this.relevantPhrases
                })
            });
            
            console.log('Rewrite API response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Rewrite API error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
            }
            
            const result = await response.json();
            console.log('Rewrite API success response:', result);

            if (result && typeof result.rewrittenText === 'string') {
                return result.rewrittenText;
            }

            console.log('Unexpected rewrite API response format:', result);
            return inputText;
        } catch (error) {
            console.error('Error occurred while calling rewrite API:', error);
            this.updateStatus('Text rewriting service error. Using original text instead.', 'error');
            return inputText;
        }
    }
    
    async startTranscription() {
        try {
            if (!this.configLoaded) {
                this.updateStatus('Configuration not loaded. Please wait and try again.', 'error');
                return;
            }
            const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
                this.azureConfig.subscriptionKey, 
                this.azureConfig.serviceRegion
            );
            
            speechConfig.speechRecognitionLanguage = this.languageSelect.value;
            
            // 修复自定义模型配置
            if (this.azureConfig.useCustomModel && this.azureConfig.customEndpointId) {
                // 方法1: 使用自定义端点ID
                speechConfig.endpointId = this.azureConfig.customEndpointId;
                console.log('Using custom speech model with endpoint ID:', this.azureConfig.customEndpointId);
            }
            
            const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
            this.recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
            
            this.recognizer.recognizing = (s, e) => {
                this.updateTranscript(e.result.text, false, false);
            };
            
            this.recognizer.recognized = async (s, e) => {
                if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
                    const originalText = e.result.text;
                    
                    // Display original text immediately
                    this.updateTranscript(originalText, true, false);
                    
                    // If rewrite is enabled, process with Qwen API
                    if (this.enableRewriteCheckbox && this.enableRewriteCheckbox.checked) {
                        try {
                            const rewrittenText = await this.rewriteContent(originalText);
                            this.updateTranscript(rewrittenText, true, true);
                        } catch (error) {
                            console.error('Error in text rewriting:', error);
                            // Continue with original text if rewriting fails
                        }
                    }
                }
            };
            
            this.recognizer.canceled = (s, e) => {
                console.log(`CANCELED: Reason=${e.reason}`);
                
                if (e.reason === SpeechSDK.CancellationReason.Error) {
                    console.log(`CANCELED: ErrorCode=${e.errorCode}, ErrorDetails=${e.errorDetails}`);
                    this.updateStatus(`Recognition error: ${e.errorDetails}`, 'error');
                }
                
                this.stopTranscription();
            };
            
            this.recognizer.sessionStarted = (s, e) => {
                console.log('Session started');
                const modelType = this.azureConfig.useCustomModel ? 'Custom Model' : 'Standard Model';
                console.log(`Using ${modelType}`);
            };
            
            this.recognizer.startContinuousRecognitionAsync(
                () => {
                    this.isListening = true;
                    this.updateUI();
                    const modelType = this.azureConfig.useCustomModel ? 'Custom Model' : 'Standard Model';
                    const rewriteStatus = this.enableRewriteCheckbox.checked ? ' + Text Rewriting' : '';
                    this.updateStatus(`Listening... Speak now! (${modelType}${rewriteStatus})`, 'listening');
                },
                (err) => {
                    console.error('Error starting recognition:', err);
                    this.updateStatus('Error starting speech recognition', 'error');
                }
            );
            
        } catch (error) {
            console.error('Error initializing speech recognition:', error);
            this.updateStatus('Error initializing speech recognition. Please check console for details.', 'error');
        }
    }
    
    stopTranscription() {
        if (this.recognizer) {
            this.recognizer.stopContinuousRecognitionAsync(
                () => {
                    this.isListening = false;
                    this.updateUI();
                    this.updateStatus('Transcription stopped', 'stopped');
                    this.recognizer.close();
                    this.recognizer = null;
                },
                (err) => {
                    console.error('Error stopping recognition:', err);
                    this.updateStatus('Error stopping recognition', 'error');
                }
            );
        } else {
            this.isListening = false;
            this.updateUI();
            this.updateStatus('Transcription stopped 轉錄已停止', 'stopped');
        }
    }
    
    updateTranscript(text, isFinal, isRewritten) {
        if (!text || !this.transcriptElement) return;
        
        const existingInterim = this.transcriptElement.querySelector('.interim');
        // Always clear any interim text once we append a final segment
        if (existingInterim) {
            existingInterim.remove();
        }
        
        if (isFinal) {
            if (!isRewritten) {
                // Avoid duplicating the same recognized text twice
                if (text === this.lastOriginalText) {
                    return;
                }
                if (this.enableRewriteCheckbox && this.enableRewriteCheckbox.checked) {
                    this.fullTranscript += text + ' ';
                    this.updateWordCount();
                    return;
                }
                // Original text
                this.fullTranscript += text + ' ';
                this.lastOriginalText = text;
                
                const finalElement = document.createElement('div');
                finalElement.textContent = `RECO: ${text}`;
                finalElement.className = 'final original';
                this.transcriptElement.appendChild(finalElement);
            } else {
                // Rewritten text
                this.rewrittenTranscript += text + ' ';
                
                const rewrittenElement = document.createElement('div');
                //rewrittenElement.textContent = `REWRITE: ${text}`;
                rewrittenElement.textContent = `${text}`;
                rewrittenElement.className = 'final rewritten';
                rewrittenElement.style.color = '#107c10'; // Green color for rewritten text
                rewrittenElement.style.fontWeight = 'bold';
                this.transcriptElement.appendChild(rewrittenElement);
                
                // Add separator
                //const separator = document.createElement('div');
                //separator.innerHTML = '----------------------';
                //separator.style.textAlign = 'center';
                //separator.style.color = '#ccc';
                //separator.style.margin = '0px 0px';
                //this.transcriptElement.appendChild(separator);
            }
        } else {
            // Interim results
            const interimElement = document.createElement('div');
            interimElement.textContent = text;
            interimElement.className = 'interim';
            this.transcriptElement.appendChild(interimElement);
        }
        
        this.transcriptElement.scrollTop = this.transcriptElement.scrollHeight;
        this.updateWordCount();
    }
    
    updateWordCount() {
        if (!this.wordCountElement) return;
        const wordCount = this.fullTranscript.trim() ? this.fullTranscript.trim().split(/\s+/).length : 0;
        this.wordCountElement.textContent = `${wordCount} words`;
    }
    
    clearTranscript() {
        if (!this.transcriptElement) return;
        this.transcriptElement.innerHTML = '';
        this.fullTranscript = '';
        this.rewrittenTranscript = '';
        this.updateWordCount();
        this.updateStatus('Transcript cleared 文稿已清除', 'success');
    }
    
    downloadTranscript() {
        if (!this.fullTranscript.trim() && !this.rewrittenTranscript.trim()) {
            this.updateStatus('No transcript to download 沒有可下載的文字稿', 'error');
            return;
        }
        
        let content = '';
        if (this.fullTranscript.trim()) {
            content += 'RAW TRANSCRIPT:\n' + this.fullTranscript + '\n\n';
        }
        if (this.rewrittenTranscript.trim()) {
            content += 'REWRITTEN TRANSCRIPT:\n' + this.rewrittenTranscript;
        }
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcript-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.updateStatus('Transcript downloaded', 'success');
    }
    
    updateStatus(message, type) {
        if (!this.statusElement) return;
        
        this.statusElement.textContent = message;
        this.statusElement.classList.remove('status-listening');
        
        if (type === 'listening') {
            this.statusElement.classList.add('status-listening');
        } else if (type === 'error') {
            this.statusElement.style.background = '#fde7e9';
            this.statusElement.style.color = '#a4262c';
        } else if (type === 'success') {
            this.statusElement.style.background = '#dff6dd';
            this.statusElement.style.color = '#107c10';
        } else {
            this.statusElement.style.background = '#f3f2f1';
            this.statusElement.style.color = '#323130';
        }
    }
    
    updateUI() {
        if (this.startBtn) this.startBtn.disabled = this.isListening || !this.isLoggedIn;
        if (this.stopBtn) this.stopBtn.disabled = !this.isListening;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing MicrosoftSpeechTranscriber');
    try {
        new MicrosoftSpeechTranscriber();
        console.log('MicrosoftSpeechTranscriber initialized successfully');
    } catch (error) {
        console.error('Error initializing MicrosoftSpeechTranscriber:', error);
    }
});
