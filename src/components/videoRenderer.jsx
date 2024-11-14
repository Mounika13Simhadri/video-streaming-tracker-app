import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const VideoRenderer = () => {
  const socket = useRef(null);
  const peerConnections = useRef({});
  // const videoRef = useRef(null);
  const [employeeId, setEmployeeId] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [videoStream, setVideoStream] = useState(null);
  const [time, setTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const timerRef = useRef(null);
  const [captureType, setCaptureType] = useState('screen'); 

  const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  useEffect(() => {

    socket.current = io('https://qx993sw3-5000.inc1.devtunnels.ms/' );
    socket.current.emit('register-employee', employeeId);

    if (isStreaming) {
      startVideoCapture();
      startTimer();
    } else {
      stopVideoCapture();
    }

    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, [isStreaming, employeeId]);

  const startStream = async (captureType) => {
    let stream;
    try {
      if (captureType === 'screen') {
        const sources = await window.electron.getScreenStream();
        if (!sources.length) {
          console.error('No screen sources available.');
          return;
        }
        const source = sources[0];
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
            },
          },
        });
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
    return stream;
  };
  const switchStream = async (newCaptureType) => {
    setCaptureType(newCaptureType); 
    const newStream = await startStream(newCaptureType);
    if (newStream) {
      setVideoStream(newStream);
      // videoRef.current.srcObject = newStream;
      socket.current.emit('stream-started', employeeId);
  
      const newVideoTrack = newStream.getVideoTracks()[0];
      Object.values(peerConnections.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        } else {
          newStream.getTracks().forEach(track => pc.addTrack(track, newStream));
        }
      });
    }
  };
  

  const startVideoCapture = async () => {
    try{
    const stream = await startStream(captureType);
    if (stream) {
      setVideoStream(stream);
    //  videoRef.current.srcObject = stream;
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

      socket.current.on('switch-stream', async (streamType) => {
        console.log(`Switching to ${streamType}`);
        await switchStream(streamType);
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
    }
  }
    catch (error) {
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
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.current.emit('offer', employeeId, adminId, offer);
    } catch (error) {
      console.error('Error creating or sending WebRTC offer:', error);
    }
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
    const stream = await startStream(captureType);
    if (stream) {
      setVideoStream(stream);
      // videoRef.current.srcObject = stream;
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
      <h3>Streaming {captureType}</h3>
      {/* <video ref={videoRef} autoPlay muted style={{ width: '100%', height: '300px', marginTop: '20px' }} /> */}
    </div>
  );
};

export default VideoRenderer;