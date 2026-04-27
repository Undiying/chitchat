import Peer from 'peerjs';

// Helper to create a deterministic ID from an email/identifier
export const getDeterministicId = async (identifier) => {
  if (!identifier) return null;
  const msgUint8 = new TextEncoder().encode(identifier.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  // Use a prefix to avoid collisions with other PeerJS users
  return `teta-v1-${hashHex.substring(0, 16)}`; // Using first 16 chars for brevity
};

export const initializePeer = (customId, onMessageReceived, onConnectionEstablished) => {
  // If no customId, PeerJS generates a random one
  const peer = customId ? new Peer(customId) : new Peer();

  peer.on('open', (id) => {
    console.log('My peer ID is: ' + id);
  });

  peer.on('error', (err) => {
    console.error('PeerJS error:', err);
  });

  peer.on('connection', (conn) => {
    conn.on('data', (data) => {
      onMessageReceived(data);
    });
    conn.on('open', () => {
      onConnectionEstablished(conn);
    });
  });

  return peer;
};

export const connectToPeer = (peer, remotePeerId, onMessageReceived, onConnectionEstablished) => {
  if (!peer || !remotePeerId) return null;
  
  const conn = peer.connect(remotePeerId, {
    reliable: true
  });

  conn.on('open', () => {
    onConnectionEstablished(conn);
  });

  conn.on('data', (data) => {
    onMessageReceived(data);
  });

  conn.on('error', (err) => {
    console.error('Connection error:', err);
  });

  return conn;
};

