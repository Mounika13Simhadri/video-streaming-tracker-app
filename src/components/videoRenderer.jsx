import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const VideoRenderer = () => {
  const socket = useRef(null);
  const peerConnection = useRef(null);
  const videoRef = useRef(null);
  const [employeeId,setEmployeeId]=useState('')
  const [isStreaming,setIsStreaming]=useState(false)
  const [videoStream, setVideoStream] = useState(null);

  const toggleStreaming = () => {
    setIsStreaming(!isStreaming);
  };


  const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  const stopVideoCapture = () => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
  };
  
  useEffect(() => {
    socket.current = io('http://192.168.6.28:4000');
    socket.current.emit('register-employee', employeeId); 
    if (isStreaming) {
      startVideoCapture();
    } else {
      stopVideoCapture();
    }

    // return () => {
    //   socket.current.disconnect();
    //   stopVideoCapture();
    // };
  }, [isStreaming]);

  const startVideoCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setVideoStream(stream);
      videoRef.current.srcObject = stream;
  
      // Create peer connection
      peerConnection.current = new RTCPeerConnection(config);
      
      // Add tracks to peer connection
      stream.getTracks().forEach((track) => peerConnection.current.addTrack(track, stream));
  
      // Set up ICE candidate handler
      peerConnection.current.onicecandidate = ({ candidate }) => {
        if (candidate) {
          socket.current.emit('ice-candidate', employeeId, candidate); // Send ICE candidate to server
        }
      };
  
      // Listen for 'answer' from admin
      socket.current.on('answer', async (answer) => {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      });
  
      // Listen for ICE candidates from server
      socket.current.on('ice-candidate', async (candidate) => {
        if (candidate) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });
  
      // Create and send offer to admin
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      socket.current.emit('offer', employeeId, offer); // Send offer to the server, which forwards to admin
    } catch (error) {
      console.error('Error accessing webcam:', error);
    }
  };
  
  

  return (
    <div>
      <input
        type="text"
        placeholder="Enter Employee ID (e.g., employee1)"
        onChange={(e) => setEmployeeId(e.target.value)}
        value={employeeId}
      />
     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
      <h2>Stream Your Video</h2>
      <button onClick={toggleStreaming} style={{ padding: '10px', borderRadius: '5px', cursor: 'pointer' }}>
        {isStreaming ? 'Stop Streaming' : 'Start Streaming'}
      </button>
      <video ref={videoRef} autoPlay muted style={{ width: '100%', height: '400px', border: '1px solid gray', marginTop: '20px' }} />
    </div>
    </div>
  );
};

export default VideoRenderer;
