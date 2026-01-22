import React, { useRef, useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import useWebSocket from "react-use-websocket";

const CameraDetections = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [uploadedVideoFile, setUploadedVideoFile] = useState(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoObjectURL, setVideoObjectURL] = useState(null);
  const [messageHistory, setMessageHistory] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [frameCount, setFrameCount] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const frameCountRef = useRef(0);

  const wsUrl = "https://asl-backend.octaloop.dev/ws";

  const { sendMessage, lastMessage, readyState } = useWebSocket(wsUrl, {
    onOpen: () => {
      console.log("WebSocket connected");
      setConnectionStatus("Connected");
    },
    onClose: () => {
      console.log("WebSocket disconnected");
      setConnectionStatus("Disconnected");
    },
    onError: (error) => {
      console.error("WebSocket error:", error);
      setConnectionStatus("Error");
    },
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: 3000,
  });

  useEffect(() => {
    // Listen for messages from WebSocket
    if (lastMessage !== null) {
      console.log("Received message:", lastMessage.data);
      setMessageHistory((prev) => prev.concat(lastMessage));
    }
  }, [lastMessage]);

  const handleVideoUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("video/")) {
      // Cleanup previous video URL
      if (videoObjectURL) {
        URL.revokeObjectURL(videoObjectURL);
      }

      setUploadedVideoFile(file);
      setIsVideoMode(true);

      // Load video but don't play yet
      const url = URL.createObjectURL(file);
      setVideoObjectURL(url);

      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.load();
        videoRef.current.onloadedmetadata = () => {
          console.log("Video loaded and ready to start");
          setVideoDuration(videoRef.current.duration);
          setVideoLoaded(true);
        };

        // Update current time as video plays
        videoRef.current.ontimeupdate = () => {
          setVideoCurrentTime(videoRef.current.currentTime);
        };
      }

      // Reset file input to allow uploading same file again
      event.target.value = "";
    }
  };

  const startVideoProcessing = () => {
    if (videoRef.current && videoLoaded) {
      // Set onended listener when video actually starts playing
      videoRef.current.onended = () => {
        console.log("Video ended - stopping frame capture");
        stopCamera();
      };

      videoRef.current.play();
      setIsCameraActive(true);
      setVideoLoaded(false);
      startFrameCapture();
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);

        // Start capturing frames after camera is ready
        videoRef.current.onloadedmetadata = () => {
          startFrameCapture();
        };
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert(
        "Failed to access camera. Please ensure camera permissions are granted.",
      );
    }
  };

  const stopCamera = () => {
    if (videoRef.current) {
      // Stop camera stream if active
      if (videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }

      // Stop uploaded video if active
      if (isVideoMode) {
        videoRef.current.pause();
        videoRef.current.onended = null; // Remove event listener
        videoRef.current.ontimeupdate = null; // Remove time update listener
        videoRef.current.src = "";

        // Cleanup object URL
        if (videoObjectURL) {
          URL.revokeObjectURL(videoObjectURL);
          setVideoObjectURL(null);
        }

        setUploadedVideoFile(null);
        setIsVideoMode(false);
        setVideoLoaded(false);
        setVideoCurrentTime(0);
        setVideoDuration(0);
      }

      setIsCameraActive(false);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Reset frame counter and timing
      frameCountRef.current = 0;
      setFrameCount(0);
      lastFrameTimeRef.current = 0;
    }
  };

  const startFrameCapture = () => {
    // Clear any existing animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    lastFrameTimeRef.current = performance.now();
    captureFrameLoop();
  };

  const captureFrameLoop = () => {
    const video = videoRef.current;

    // Check if video is still active and playing
    if (!video || video.paused || video.ended) {
      console.log("❌ Frame loop stopped - video ended or paused");
      return;
    }

    const now = performance.now();
    const elapsed = now - lastFrameTimeRef.current;

    // Capture at 30 FPS (33ms between frames)
    if (elapsed >= 33) {
      lastFrameTimeRef.current = now;
      captureFrame();
    }

    // Continue the loop
    animationFrameRef.current = requestAnimationFrame(captureFrameLoop);
  };

  const captureFrame = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    console.log(`🎬 Frame capture attempt #${frameCountRef.current + 1}`);
    console.log(
      `WebSocket state: ${readyState}, Canvas: ${!!canvas}, Video: ${!!video}`,
    );

    if (canvas && video) {
      // Check if video is actually playing
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        console.warn("⚠️ Video not ready yet, readyState:", video.readyState);
        return;
      }

      const context = canvas.getContext("2d");

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Increment frame counter
      frameCountRef.current += 1;
      setFrameCount(frameCountRef.current);

      // Convert canvas to base64 for video frame
      const dataURL = canvas.toDataURL("image/jpeg", 0.8);
      const base64Frame = dataURL.split(",")[1]; // Remove data:image/jpeg;base64, prefix

      // Send video frame to backend
      const frameData = {
        type: "video_frame",
        frame: base64Frame,
        timestamp: Date.now(),
        frame_count: frameCountRef.current,
      };

      console.log("Sending frame data:", {
        type: frameData.type,
        timestamp: frameData.timestamp,
        frame: frameData.frame,
      });
      sendMessage(JSON.stringify(frameData));

      console.log(`Frame #${frameCountRef.current} sent to backend`);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <>
      <div className="baseCard flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Camera Detection</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm">Frames: </span>
              <span className="text-sm font-semibold text-blue-500">
                {frameCount}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">WebSocket: </span>
              <span
                className={`text-sm font-semibold ${
                  connectionStatus === "Connected"
                    ? "text-green-500"
                    : connectionStatus === "Error"
                      ? "text-red-500"
                      : "text-gray-500"
                }`}
              >
                {connectionStatus}
              </span>
            </div>
            {(videoLoaded || (isCameraActive && isVideoMode)) && (
              <div className="flex items-center gap-2">
                <span className="text-sm">Video Time: </span>
                <span className="text-sm font-semibold text-orange-500">
                  {Math.floor(videoCurrentTime)}s / {Math.floor(videoDuration)}s
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="border-2 border-gray-300 rounded-lg w-full"
              style={{ maxWidth: "640px", height: "auto" }}
            />
            <canvas
              ref={canvasRef}
              width="640"
              height="480"
              className="absolute top-0 left-0 pointer-events-none"
              style={{
                maxWidth: "640px",
                height: "auto",
                display: isCameraActive ? "block" : "none",
              }}
            />
            {!isCameraActive && !videoLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                <div className="text-center">
                  <Icon
                    icon="mdi:camera-off"
                    className="text-6xl text-gray-400 mx-auto mb-2"
                  />
                  <p className="text-gray-500">Camera is off</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 flex-wrap">
            {!isCameraActive ? (
              <>
                {!videoLoaded ? (
                  <>
                    <button
                      onClick={startCamera}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      <Icon icon="mdi:camera" className="text-xl" />
                      Start Camera
                    </button>
                    <label className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors cursor-pointer">
                      <Icon icon="mdi:video-plus" className="text-xl" />
                      Upload Video
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoUpload}
                        className="hidden"
                      />
                    </label>
                  </>
                ) : (
                  <button
                    onClick={startVideoProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    <Icon icon="mdi:play" className="text-xl" />
                    Start Video Processing
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={stopCamera}
                className="flex items-center mt-36 gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <Icon icon="mdi:stop" className="text-xl" />
                Stop {isVideoMode ? "Video" : "Camera"}
              </button>
            )}
          </div>
        </div>
        <span>The WebSocket is currently {connectionStatus}</span>
        {lastMessage ? <span>Last message: {lastMessage.data}</span> : null}
        <ul>
          {messageHistory.map((message, idx) => (
            <span key={idx}>{message ? message.data?.message : null}</span>
          ))}
        </ul>
      </div>
    </>
  );
};

export default CameraDetections;
