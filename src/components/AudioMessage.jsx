import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause } from 'lucide-react';

const AudioMessage = ({ message, isOwn, onReplyToTimestamp }) => {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    let audioUrl = '';
    if (message.audioData) {
        // Base64 Data URI from the new recording logic
        audioUrl = message.audioData;
    } else if (message.audioBlob) {
        // Legacy support for previously saved blobs
        audioUrl = URL.createObjectURL(message.audioBlob);
    } else {
        setHasError(true);
        return;
    }

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: isOwn ? 'rgba(255, 255, 255, 0.5)' : '#94a3b8',
      progressColor: '#ff5500', // SoundCloud Orange
      height: 48, // Slightly taller for better visualization
      barWidth: 3, // Thicker bars like SoundCloud
      barGap: 2,
      barRadius: 3,
      cursorWidth: 0,
      normalize: true,
    });

    ws.load(audioUrl);

    ws.on('ready', () => {
      setDuration(ws.getDuration());
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));
    ws.on('error', (err) => {
      console.error("WaveSurfer Error:", err);
      setHasError(true);
    });

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
      if (message.audioBlob) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [message, isOwn]);

  const togglePlay = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const handleWaveformClick = (e) => {
    if (!wavesurferRef.current) return;
    // Let wavesurfer handle its built-in click to seek.
    // If they shift-click or double-click to reply:
    if (e.detail === 2 || e.shiftKey) { // Double click to reply at timestamp
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = x / rect.width;
      const timestamp = percent * duration;
      onReplyToTimestamp(message.id, timestamp);
    }
  };

  return (
    <div className={`audio-message`}>
      {message.replyContext && (
        <div className="reply-context">
          Replying to {message.replyContext.timestamp.toFixed(1)}s
        </div>
      )}
      
      {hasError ? (
        <div style={{ padding: '8px', color: '#ff5500', fontSize: '0.85rem' }}>
          Audio unavailable or format unsupported.
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={togglePlay} className="action-btn" style={{ width: '40px', height: '40px', background: '#ff5500', flexShrink: 0, boxShadow: '0 4px 10px rgba(255, 85, 0, 0.3)' }}>
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
        <div 
            className="waveform-container" 
            ref={containerRef} 
            onClick={handleWaveformClick}
            title="Double click to reply at timestamp"
            style={{flex: 1}}
        >
          {message.replies && message.replies.map(r => (
            <div 
              key={r.id} 
              className="waveform-marker"
              style={{ left: `${(r.timestamp / duration) * 100}%` }}
              title="Reply marker"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AudioMessage;
