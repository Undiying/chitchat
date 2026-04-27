import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause } from 'lucide-react';

const AudioMessage = ({ message, isOwn, onReplyToTimestamp }) => {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    let audioUrl = '';
    if (message.audioBlob) {
        // If it's a blob from indexedDb
        audioUrl = URL.createObjectURL(message.audioBlob);
    } else if (message.audioUrl) {
        // If we just got it or recorded it
        audioUrl = message.audioUrl;
    } else {
        return;
    }

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: isOwn ? 'rgba(255, 255, 255, 0.4)' : '#64748b',
      progressColor: isOwn ? '#ffffff' : '#3b82f6',
      height: 40,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={togglePlay} className="action-btn" style={{ width: '36px', height: '36px', background: isOwn ? 'rgba(0,0,0,0.2)' : 'var(--accent-color)' }}>
          {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
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
      </div>
    </div>
  );
};

export default AudioMessage;
