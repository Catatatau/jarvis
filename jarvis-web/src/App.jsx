import React, { useState, useEffect, useRef } from 'react';
import AtlasOrb from './components/AtlasOrb/AtlasOrb.jsx';

function Ti({ name, className = '' }) {
  return <i className={`ti ti-${name} ${className}`.trim()} aria-hidden="true" />;
}

function PanelButton({ icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      className={`panel-btn${danger ? ' panel-btn-danger' : ''}`}
      onClick={onClick}
    >
      <Ti name={icon} />
      <span>{label}</span>
    </button>
  );
}

const isLocalWebHost = () => ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

const getDefaultApiUrl = () => {
  if (isLocalWebHost()) return 'http://127.0.0.1:5001';
  return `http://${window.location.hostname}:5001`;
};

function AppContent() {
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('jarvis_api_url') || getDefaultApiUrl());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempApiUrl, setTempApiUrl] = useState(apiUrl);

  const [isOnline, setIsOnline] = useState(false);
  const [isLiveScreenOpen, setIsLiveScreenOpen] = useState(false);
  const [liveFrame, setLiveFrame] = useState(null);
  const [models, setModels] = useState([]);
  const [currentModel, setCurrentModel] = useState('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [logs, setLogs] = useState([
    { id: 1, sender: 'system', text: 'Olá, sou o ATLAS. Como posso te ajudar hoje?' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(() => {
    const saved = localStorage.getItem('atlas_panel_open');
    return saved !== 'false';
  });

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const orbState = isListening ? 'listening' : isTyping ? 'responding' : 'idle';

  const statusText = (() => {
    if (isListening) return 'Ouvindo...';
    if (isTyping) return 'Processando...';
    if (!isOnline) return 'Sistema Desconectado';
    const active = models.find(m => m.key === currentModel);
    return active ? `${active.name} • Conectado` : 'Sistema Conectado';
  })();

  const stateLabel = (() => {
    if (isListening) return 'escutando';
    if (isTyping) return 'respondendo';
    if (!isOnline) return 'aguardando conexão';
    return 'em espera';
  })();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, isTyping]);

  useEffect(() => {
    if (!isPanelOpen) setIsModelDropdownOpen(false);
  }, [isPanelOpen]);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${apiUrl}/health`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (res.ok) {
          setIsOnline(true);
          const data = await res.json();
          if (data.current_model) setCurrentModel(data.current_model);
        } else {
          setIsOnline(false);
        }
      } catch {
        const fallbackUrl = getDefaultApiUrl();
        if (isLocalWebHost() && apiUrl !== fallbackUrl) {
          try {
            const res = await fetch(`${fallbackUrl}/health`, {
              headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            if (res.ok) {
              const data = await res.json();
              setApiUrl(fallbackUrl);
              localStorage.setItem('jarvis_api_url', fallbackUrl);
              setIsOnline(true);
              if (data.current_model) setCurrentModel(data.current_model);
              return;
            }
          } catch { /* usa estado offline abaixo */ }
        }
        setIsOnline(false);
      }
    };

    const fetchModels = async () => {
      try {
        const res = await fetch(`${apiUrl}/models`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (res.ok) {
          const data = await res.json();
          setModels(data.models);
          setCurrentModel(data.current);
        }
      } catch { /* silencioso */ }
    };

    checkHealth();
    fetchModels();
    const interval = setInterval(() => { checkHealth(); fetchModels(); }, 5000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  useEffect(() => {
    let interval;
    if (isLiveScreenOpen) {
      const fetchFrame = async () => {
        try {
          const res = await fetch(`${apiUrl}/frame`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
          });
          const data = await res.json();
          if (data.success && data.frame) {
            setLiveFrame(`data:image/jpeg;base64,${data.frame}`);
          }
        } catch {
          console.error('Falha ao puxar tela ao vivo');
        }
      };
      fetchFrame();
      interval = setInterval(fetchFrame, 800);
    } else {
      setLiveFrame(null);
    }
    return () => clearInterval(interval);
  }, [isLiveScreenOpen, apiUrl]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'pt-BR';
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        handleMessageSubmit(transcript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('[ATLAS Mic] Erro:', event.error);
        if (event.error === 'not-allowed') {
          alert('Microfone bloqueado! Verifique: 1) Permissões do site no navegador. 2) Configurações de Privacidade do Windows (Permitir que apps acessem microfone).');
        } else if (event.error === 'no-speech') {
          // Ignora, apenas não detectou som
        } else if (event.error === 'network') {
          alert('Erro de rede: O reconhecimento de voz do navegador precisa de internet.');
        } else {
          alert(`Erro no microfone: ${event.error}`);
        }
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleMic = (e) => {
    e?.stopPropagation();
    if (!recognitionRef.current) {
      alert('Seu navegador não suporta microfone. Use Google Chrome no PC ou Android.');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error('Erro ao iniciar microfone', err);
      }
    }
  };

  const speak = (text) => {
    if (!text) return;
    let cleanText = text.replace(/\[SCREENSHOT_DATA\].*$/, '');
    cleanText = cleanText.replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, '');
    if (!cleanText.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'pt-BR';
    window.speechSynthesis.speak(utterance);
  };

  const addMessage = (sender, text) => {
    setLogs(prev => [...prev, { id: Date.now(), sender, text }]);
  };

  const readJsonSafely = async (res) => {
    try {
      return await res.json();
    } catch {
      return {};
    }
  };

  const getVisionDiagnostics = async () => {
    const lines = [`API: ${apiUrl}`];
    let sawPython = false;
    let sawNewBackend = false;

    try {
      const res = await fetch(`${apiUrl}/vision/status`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await readJsonSafely(res);
      if ('available' in data) {
        sawNewBackend = true;
        lines.push(`Vision available: ${data.available ? 'sim' : 'nao'}`);
      }
      if (data.error) lines.push(`Vision error: ${data.error}`);
      if (data.python) {
        sawPython = true;
        lines.push(`Python do Agent: ${data.python}`);
        if (!data.python.toLowerCase().includes('.venv')) {
          lines.push('Aviso: o Agent nao esta usando python-agent\\.venv. Feche o Agent antigo e rode scripts\\start-tudo.bat atualizado.');
        }
      }
    } catch {
      lines.push('Nao consegui ler /vision/status.');
    }

    try {
      const res = await fetch(`${apiUrl}/health`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await readJsonSafely(res);
      if (data.python && !sawPython) {
        sawPython = true;
        lines.push(`Python do Agent: ${data.python}`);
      }
      if (data.vision_error) lines.push(`Health vision_error: ${data.vision_error}`);
      if ('vision_available' in data && !sawNewBackend) {
        sawNewBackend = true;
        lines.push(`Health vision_available: ${data.vision_available ? 'sim' : 'nao'}`);
      }
    } catch {
      lines.push('Nao consegui ler /health.');
    }

    if (!sawNewBackend) {
      lines.push('Backend sem diagnostico novo. Atualize o repo, feche os Agents antigos e rode scripts\\start-tudo.bat.');
    }

    return lines.join('\n');
  };

  const handleMessageSubmit = async (textToSend) => {
    if (!textToSend.trim()) return;
    addMessage('user', textToSend);
    setInputValue('');
    setIsTyping(true);
    try {
      const payload = { message: textToSend };

      const res = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.text) {
        addMessage('system', data.text);
        speak(data.text);
      }
      if (data.action_result?.screenshot) {
        addMessage('system', `[SCREENSHOT_DATA]${data.action_result.screenshot}`);
      }
    } catch {
      addMessage('system', 'Desculpe, não consegui conectar ao servidor.');
      speak('Desculpe, não consegui conectar ao servidor.');
    } finally {
      setIsTyping(false);
    }
  };

  const togglePcVision = async (action) => {
    addMessage('user', action === 'start' ? 'Ligar camera/gestos' : 'Desligar camera');
    setIsTyping(true);
    try {
      const res = await fetch(`${apiUrl}/vision/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });
      const data = await readJsonSafely(res);
      const resultText = data.result || data.text || 'Resposta vazia do servidor de visao.';
      addMessage('system', resultText);
      speak(resultText);

      if (!res.ok || data.success === false) {
        const diagnostics = await getVisionDiagnostics();
        addMessage('system', `Diagnostico da visao:\n${diagnostics}`);
      }
    } catch {
      addMessage('system', `Erro ao alterar visao do PC. API configurada: ${apiUrl}`);
    } finally {
      setIsTyping(false);
    }
  };

  const executeDirectAction = async (action, target = '') => {
    addMessage('user', `Executar ação: ${action}`);
    setIsTyping(true);
    try {
      const res = await fetch(`${apiUrl}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ action, target })
      });
      const data = await res.json();
      addMessage('system', data.result);
      speak(data.result);
      if (data.screenshot) {
        addMessage('system', `[SCREENSHOT_DATA]${data.screenshot}`);
      }
    } catch {
      addMessage('system', 'Erro na conexão direta.');
    } finally {
      setIsTyping(false);
    }
  };

  const renderMessageContent = (msg) => {
    if (msg.text.includes('[SCREENSHOT_DATA]')) {
      const textPart = msg.text.split('[SCREENSHOT_DATA]')[0];
      const b64 = msg.text.split('[SCREENSHOT_DATA]')[1];
      return (
        <>
          {textPart && <p>{textPart}</p>}
          <img src={`data:image/png;base64,${b64}`} alt="Screenshot" className="message-image" />
        </>
      );
    }
    return <p>{msg.text}</p>;
  };

  const switchModel = async (modelKey) => {
    try {
      const res = await fetch(`${apiUrl}/models/switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ model: modelKey })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentModel(data.current);
        addMessage('system', data.result);
        speak(data.result);
      }
    } catch {
      addMessage('system', 'Erro ao trocar modelo.');
    }
    setIsModelDropdownOpen(false);
  };

  const activeModel = models.find(m => m.key === currentModel);
  const statusOnline = isOnline || isListening || isTyping;

  const togglePanel = () => {
    setIsPanelOpen((open) => {
      const next = !open;
      localStorage.setItem('atlas_panel_open', String(next));
      return next;
    });
  };

  return (
    <div className={`atlas-app${isPanelOpen ? ' panel-open' : ''}`}>
      <main className="main-area">
        <div className="atlas-label">
          <div className="atlas-name">ATLAS</div>
          <div className="atlas-sub">
            <span className={`sdot${statusOnline ? ' on' : ''}`} />
            <span>{statusText}</span>
          </div>
        </div>

        <AtlasOrb state={orbState} stateLabel={stateLabel} />

        <div className="main-stack">
          <div className="chat-history" id="chat">
            {logs.map(msg => (
              <div
                key={msg.id}
                className={msg.sender === 'user' ? 'chat-msg-user' : 'chat-msg-system'}
              >
                {renderMessageContent(msg)}
              </div>
            ))}
            {isTyping && (
              <div className="chat-msg-system chat-typing" aria-label="ATLAS está respondendo">
                <span /><span /><span />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            className="message-input-form"
            onSubmit={(e) => { e.preventDefault(); handleMessageSubmit(inputValue); }}
          >
            <div className="pill">
              <button
                type="button"
                className={`ibtn${isListening ? ' mic-active' : ''}`}
                onClick={toggleMic}
                aria-label="Microfone"
              >
                <Ti name="microphone" />
              </button>
              <input
                type="text"
                className="message-input"
                placeholder="Fale ou digite um comando..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <button type="submit" className="ibtn send" aria-label="Enviar">
                <Ti name="send" />
              </button>
            </div>
          </form>
        </div>
      </main>

      <button
        type="button"
        className="panel-toggle"
        onClick={togglePanel}
        title={isPanelOpen ? 'Ocultar controles' : 'Mostrar controles'}
        aria-expanded={isPanelOpen}
        aria-label={isPanelOpen ? 'Ocultar painel de controles' : 'Mostrar painel de controles'}
      >
        <Ti name={isPanelOpen ? 'chevron-right' : 'chevron-left'} />
      </button>

      <aside className="right-panel" aria-hidden={!isPanelOpen}>
        <div className="rph">
          <button type="button" className="rph-btn" onClick={() => setIsSettingsOpen(true)} title="Configurações">
            <Ti name="adjustments-horizontal" />
          </button>
          <span className="rph-t">Controles</span>
        </div>

        {isLiveScreenOpen ? (
          <div className="live-panel">
            <div className="live-panel-header">
              <span className="section-label">Tela ao Vivo</span>
              <button type="button" className="live-close" onClick={() => setIsLiveScreenOpen(false)}>
                <Ti name="x" />
              </button>
            </div>
            {liveFrame ? (
              <img src={liveFrame} alt="Tela ao vivo" className="live-img" />
            ) : (
              <p className="live-loading">Conectando ao PC...</p>
            )}
          </div>
        ) : (
          <>
            {/* ── ATLAS Vision section ── */}
            <section className="panel-section">
              <span className="section-label">Controle de Visão do PC</span>
              <PanelButton icon="camera" label="Ligar Câmera/Gestos" onClick={() => togglePcVision('start')} />
              <PanelButton icon="camera-off" label="Desligar Câmera" onClick={() => togglePcVision('stop')} />
            </section>

            <div className="vision-divider" />

            <section className="panel-section">
              <span className="section-label">Apps & Web</span>
              <PanelButton icon="brand-chrome" label="Chrome" onClick={() => executeDirectAction('open_app', 'chrome')} />
              <PanelButton icon="brand-youtube" label="YouTube" onClick={() => executeDirectAction('open_url', 'youtube.com')} />
            </section>

            <section className="panel-section">
              <span className="section-label">Mídia</span>
              <PanelButton icon="player-play" label="Play / Pause" onClick={() => executeDirectAction('play_pause')} />
              <PanelButton icon="player-skip-forward" label="Próxima" onClick={() => executeDirectAction('next_track')} />
              <PanelButton icon="volume" label="Vol +" onClick={() => executeDirectAction('volume_up')} />
              <PanelButton icon="volume-off" label="Vol −" onClick={() => executeDirectAction('volume_down')} />
            </section>

            <section className="panel-section">
              <span className="section-label">Sistema</span>
              <PanelButton icon="adjustments" label="Configurações (Ngrok)" onClick={() => setIsSettingsOpen(true)} />
              <PanelButton icon="layout-dashboard" label="Resumo" onClick={() => executeDirectAction('system_info', 'all')} />
              <PanelButton icon="screenshot" label="Print" onClick={() => executeDirectAction('screenshot')} />
              <PanelButton icon="device-tv" label="Tela ao Vivo" onClick={() => setIsLiveScreenOpen(true)} />
            </section>
            <section className="panel-section">
              <span className="section-label">Energia</span>
              <PanelButton icon="power" label="Desligar Atlas" danger onClick={() => executeDirectAction('shutdown_atlas')} />
            </section>

            <section className="panel-section panel-section-model">
              <span className="section-label">Modelo de IA</span>
              <div className="model-select-wrap">
                <button
                  type="button"
                  className="model-select-btn"
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                >
                  <Ti name="brain" />
                  <span className="model-select-label">{activeModel?.name || currentModel || 'Selecionar...'}</span>
                </button>
                {isModelDropdownOpen && models.length > 0 && (
                  <div className="model-select-dropdown">
                    {models.map(m => (
                      <button
                        key={m.key}
                        type="button"
                        className={`model-select-option${m.key === currentModel ? ' active' : ''}`}
                        onClick={() => switchModel(m.key)}
                      >
                        <span>{m.name}</span>
                        <span className="model-size">{m.size}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </aside>

      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Configurações</h2>
              <button type="button" className="modal-close" onClick={() => setIsSettingsOpen(false)}>
                <Ti name="x" />
              </button>
            </div>
            <p className="modal-text">
              Acesso remoto (Netlify): cole o link do túnel (ngrok, localtunnel).
            </p>
            <input
              type="text"
              className="modal-input"
              value={tempApiUrl}
              onChange={e => setTempApiUrl(e.target.value)}
              placeholder="https://exemplo.ngrok.app"
            />
            <button
              type="button"
              className="modal-save"
              onClick={() => {
                const cleanUrl = tempApiUrl.replace(/\/$/, '');
                setApiUrl(cleanUrl);
                localStorage.setItem('jarvis_api_url', cleanUrl);
                setIsSettingsOpen(false);
              }}
            >
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return <AppContent />;
}

export default App;
