import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send, Paperclip, X, QrCode } from 'lucide-react';
import { initializePeer, connectToPeer, getDeterministicId } from './peerUtils';
import { QRCodeSVG } from 'qrcode.react';
import { saveMessage, getAllMessages, initDB } from './idbUtils';
import AudioMessage from './components/AudioMessage';

function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [myPeerId, setMyPeerId] = useState('');
  const [remotePeerId, setRemotePeerId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [replyContext, setReplyContext] = useState(null); // { parentId, timestamp }
  const [myEmail, setMyEmail] = useState('');
  const [isProfileCreated, setIsProfileCreated] = useState(false);
  const [remoteEmail, setRemoteEmail] = useState('');
  const [showQR, setShowQR] = useState(false);

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    // Load local messages
    loadMessages();

    // Setup PeerJS
    const storedEmail = localStorage.getItem('teta-user-email');
    if (storedEmail) {
      setMyEmail(storedEmail);
      setIsProfileCreated(true);
      initPeerWithEmail(storedEmail);
    }

    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  const initPeerWithEmail = async (email) => {
    const customId = await getDeterministicId(email);
    const peer = initializePeer(customId, handleIncomingMessage, handleConnectionEstablished);
    peer.on('open', (id) => setMyPeerId(id));
    peerRef.current = peer;
  };

  const handleCreateProfile = (e) => {
    e.preventDefault();
    if (!myEmail.trim()) return;
    localStorage.setItem('teta-user-email', myEmail.trim());
    setIsProfileCreated(true);
    initPeerWithEmail(myEmail.trim());
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    const msgs = await getAllMessages();
    // Reconstruct replies properly for UI mapping
    // This is simple for now, we just pass all messages to the state
    setMessages(msgs || []);
  };

  const handleConnectionEstablished = (conn) => {
    setIsConnected(true);
    connRef.current = conn;
    console.log('Connected to peer');
  };

  const handleIncomingMessage = async (data) => {
    const newMessage = {
      ...data,
      isOwn: false,
      timestamp: data.timestamp || Date.now(),
    };
    
    // If it's an audio blob, it comes as an ArrayBuffer or Blob
    if (data.type === 'audio' && data.audioBuffer) {
      newMessage.audioBlob = new Blob([data.audioBuffer], { type: 'audio/webm' });
    }

    await saveMessage(newMessage);
    setMessages(prev => [...prev, newMessage]);
  };

  const handleConnect = async (e) => {
    e?.preventDefault();
    if (!remoteEmail) return;
    const customRemoteId = await getDeterministicId(remoteEmail);
    const conn = connectToPeer(peerRef.current, customRemoteId, handleIncomingMessage, handleConnectionEstablished);
    connRef.current = conn;
    setRemotePeerId(customRemoteId);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer(); // To send over peerjs
        
        const message = {
          id: Date.now().toString(),
          type: 'audio',
          audioBuffer: arrayBuffer, // Send buffer over WebRTC
          timestamp: Date.now(),
          replyContext: replyContext,
        };

        sendMessageOverPeer(message);
        
        // Save locally
        const localMessage = {
          ...message,
          isOwn: true,
          audioBlob: audioBlob,
        };
        await saveMessage(localMessage);
        setMessages(prev => [...prev, localMessage]);
        
        setReplyContext(null);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone', err);
      alert('Microphone access denied. Please allow it to record voice notes.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendTextMessage = async () => {
    if (!inputText.trim()) return;

    const message = {
      id: Date.now().toString(),
      type: 'text',
      content: inputText,
      timestamp: Date.now(),
      replyContext: replyContext,
    };

    sendMessageOverPeer(message);

    const localMessage = { ...message, isOwn: true };
    await saveMessage(localMessage);
    setMessages(prev => [...prev, localMessage]);
    
    setInputText('');
    setReplyContext(null);
  };

  const sendMessageOverPeer = (message) => {
    if (connRef.current && isConnected) {
      connRef.current.send(message);
    } else {
      console.warn("Message not sent. Not connected to any peer.");
      // In a real app we'd queue this to send later if offline.
    }
  };

  const handleReplyToTimestamp = (parentId, timestamp) => {
    setReplyContext({ parentId, timestamp });
  };

  // Group replies for visual display on waveforms
  const processedMessages = messages.map(msg => {
    const reliesToThisMsg = messages.filter(m => m.replyContext && m.replyContext.parentId === msg.id);
    return {
      ...msg,
      replies: reliesToThisMsg.map(r => ({ id: r.id, timestamp: r.replyContext.timestamp }))
    };
  });

  if (!isProfileCreated) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="connection-panel" style={{ position: 'relative', width: '100%', padding: '20px' }}>
          <div className="conn-box">
            <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Welcome to TeTa</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Set up your profile to start sending voice notes.
            </p>
            <form onSubmit={handleCreateProfile}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px', textAlign: 'left' }}>Your Email</label>
                <input 
                  type="email" 
                  className="conn-input"
                  style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left', width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  placeholder="name@example.com" 
                  value={myEmail}
                  onChange={(e) => setMyEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px' }}>Continue</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {!isConnected && (
        <div className="connection-panel">
          <div className="conn-box">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Connect</h2>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Your Email</p>
                <p style={{ fontSize: '1rem', fontWeight: 'bold' }}>{myEmail}</p>
              </div>
              <button className="action-btn btn-secondary" onClick={() => setShowQR(!showQR)} style={{ width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <QrCode size={20} />
              </button>
            </div>

            {showQR && myPeerId && (
              <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                <QRCodeSVG value={myEmail} size={150} />
              </div>
            )}
            
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '8px', marginBottom: '8px', textAlign: 'left' }}>
              Connect to a contact:
            </p>
            <form onSubmit={handleConnect} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="email" 
                className="conn-input"
                style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left', flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                placeholder="Contact's email" 
                value={remoteEmail}
                onChange={(e) => setRemoteEmail(e.target.value)}
                required
              />
              <button type="submit" className="btn-primary" style={{ padding: '0 20px', borderRadius: '8px' }}>Connect</button>
            </form>
            
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '16px', textAlign: 'center' }}>
              P2P Mode: Both devices must be online to chat.
            </p>
          </div>
        </div>
      )}

      <div className="header">
        <div className="header-title">TeTa</div>
        <div className="header-status">
          {isConnected ? (
            <><span className="status-dot"></span> Connected</>
          ) : (
            <><span className="status-dot offline"></span> Waiting</>
          )}
        </div>
      </div>

      <div className="chat-area">
        {processedMessages.map(msg => (
          <div key={msg.id} className={`message-bubble ${msg.isOwn ? 'message-sent' : 'message-received'}`}>
            {msg.type === 'text' ? (
              <div>
                {msg.replyContext && (
                  <div className="reply-context">
                    Replying to {msg.replyContext.timestamp.toFixed(1)}s
                  </div>
                )}
                {msg.content}
              </div>
            ) : (
              <AudioMessage 
                message={msg} 
                isOwn={msg.isOwn} 
                onReplyToTimestamp={handleReplyToTimestamp} 
              />
            )}
            <div className="message-time">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {replyContext && (
        <div style={{ padding: '8px 20px', background: 'var(--panel-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            Replying to marker at {replyContext.timestamp.toFixed(1)}s
          </span>
          <button onClick={() => setReplyContext(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="input-area">
        <button className="action-btn btn-secondary">
          <Paperclip size={20} />
        </button>
        
        <input 
          type="text" 
          className="text-input"
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendTextMessage()}
        />

        {inputText ? (
          <button className="action-btn btn-record" onClick={sendTextMessage}>
            <Send size={20} />
          </button>
        ) : (
          <button 
            className={`action-btn ${isRecording ? 'btn-recording' : 'btn-record'}`}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            title="Hold to record voice note"
          >
            <Mic size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
