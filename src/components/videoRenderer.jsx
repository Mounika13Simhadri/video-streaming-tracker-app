import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const VideoRenderer = () => {
  const socket = useRef(null);
  const peerConnections = useRef({});
  const videoRef = useRef(null);
  const [employeeId, setEmployeeId] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [videoStream, setVideoStream] = useState(null);
  const [time, setTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const timerRef = useRef(null);

  const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };


  useEffect(() => {
    socket.current = io('https://qx993sw3-4000.inc1.devtunnels.ms/');
    socket.current.emit('register-employee', employeeId);

    if (isStreaming) {
      startVideoCapture();
      startTimer();
    } else {
      stopVideoCapture();
    }
  }, [isStreaming]);

  const startVideoCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setVideoStream(stream);
      videoRef.current.srcObject = stream;
  
      socket.current.emit('stream-started', employeeId);
  
      socket.current.on('answer', async (adminId, answer) => {
        const pc = peerConnections.current[adminId];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });
  
      socket.current.on('ice-candidate', async (adminId, candidate) => {
        const pc = peerConnections.current[adminId];
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });
  
      socket.current.on('new-admin', (adminId) => {
        const pc = new RTCPeerConnection(config);
        peerConnections.current[adminId] = pc;
  
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
  
        pc.onicecandidate = ({ candidate }) => {
          if (candidate) {
            socket.current.emit('ice-candidate', employeeId, adminId, candidate);
          }
        };
  
        createOffer(pc, adminId);
      });
    } catch (error) {
      console.error('Error accessing webcam:', error);
    }
  };
  
  const stopVideoCapture = () => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
      socket.current.emit('stream-paused', employeeId);
    }
    stopTimer();
  };
  
  
  const createOffer = async (pc, adminId) => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.current.emit('offer', employeeId, adminId, offer);
  };

  const startTimer = () => {
    if (timerRef.current) return; 
    timerRef.current = setInterval(() => {
      setTime((prevTime) => {
        const { hours, minutes, seconds } = prevTime;
        const newSeconds = seconds + 1;
        const newMinutes = newSeconds === 60 ? minutes + 1 : minutes;
        const newHours = newMinutes === 60 ? hours + 1 : hours;
        return {
          hours: newHours,
          minutes: newMinutes % 60,
          seconds: newSeconds % 60,
        };
      });
    }, 1000);
  };

  const stopTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const resumeVideoCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setVideoStream(stream);
      videoRef.current.srcObject = stream;
      socket.current.emit('stream-resumed', employeeId);
  
      Object.values(peerConnections.current).forEach((pc) => {
        const videoTrack = stream.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        } else {
          stream.getTracks().forEach(track => pc.addTrack(track, stream));
        }
      });
    } catch (error) {
      console.error('Error resuming video capture:', error);
    }
  };
  
  const formatTime = () => {
    const { hours, minutes, seconds } = time;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
      <h2>Tracker</h2>
      <input
        type="text"
        placeholder="Enter Employee ID (employee1)"
        onChange={(e) => setEmployeeId(e.target.value)}
        value={employeeId}
      />
    <button
  onClick={() => {
    if (isStreaming) {
      stopVideoCapture();
    } else {
      resumeVideoCapture();
    }
    setIsStreaming(!isStreaming);
  }}
  style={{
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '24px',
  }}
  disabled={!employeeId}
>
  {isStreaming ? '⏹' : '⏵'}
</button>

      <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '20px' }}>
        {formatTime()}
      </div>
      <video ref={videoRef} autoPlay muted style={{ width: '100%', height: '300px', marginTop: '20px' }} />
    </div>
  );
};

export default VideoRenderer;
