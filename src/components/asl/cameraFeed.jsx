import React, { useRef, useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import useWebSocket from "react-use-websocket";

const CameraFeed = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastFrameTimeRef = useRef(0);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [frameCount, setFrameCount] = useState(0);
  const [lastPrediction, setLastPrediction] = useState(null);
  const [lastConfidence, setLastConfidence] = useState(null);
  const [sentence, setSentence] = useState("");

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
  });

  // Listen for messages from WebSocket
  useEffect(() => {
    if (lastMessage !== null) {
      try {
        const data = JSON.parse(lastMessage.data);
        console.log("Received message:", data);

        if (
          data.type === "prediction_result" ||
          data.type === "prediction_response"
        ) {
          setLastPrediction(data.sign_name);
          setLastConfidence(data.confidence);

          if (data.sentence) {
            setSentence(data.sentence);
          }
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    }
  }, [lastMessage]);

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

    // Check if camera is still active
    if (!video || !isCameraActive) {
      console.log("Frame loop stopped - camera inactive");
      return;
    }

    const now = performance.now();
    const elapsed = now - lastFrameTimeRef.current;

    // Capture at 10 FPS (100ms between frames) to reduce bandwidth
    if (elapsed >= 100) {
      lastFrameTimeRef.current = now;
      captureFrame();
    }

    // Continue the loop
    animationFrameRef.current = requestAnimationFrame(captureFrameLoop);
  };

  const captureFrame = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (canvas && video && readyState === 1) {
      // readyState 1 = OPEN
      // Check if video is actually playing
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        console.warn("Video not ready yet, readyState:", video.readyState);
        return;
      }

      const context = canvas.getContext("2d");

      // Clear canvas before drawing
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas to base64
      const dataURL = canvas.toDataURL("image/jpeg", 0.7);
      const base64Frame = dataURL.split(",")[1]; // Remove data:image/jpeg;base64, prefix

      // Increment frame counter
      frameCountRef.current += 1;
      setFrameCount(frameCountRef.current);

      // Send base64 frame to backend
      const message = {
        type: "hand_landmarks", // or "prediction_request"
        landmarks: base64Frame, // Send as base64 string
        timestamp: Date.now(),
      };

      sendMessage(JSON.stringify(message));
      console.log(`Frame #${frameCountRef.current} sent to backend`);
    }
  };

  const clearSentence = () => {
    const message = {
      type: "clear_sentence_buffer",
      timestamp: Date.now(),
    };
    sendMessage(JSON.stringify(message));
    setSentence("");
    setLastPrediction(null);
    setLastConfidence(null);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="baseCard flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">ASL Camera Feed</h2>
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
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Video Display */}
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
            className="hidden" // Hide canvas, we're just using it for capture
          />
          {!isCameraActive && (
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

        {/* Camera Controls */}
        <div className="flex gap-3 flex-wrap">
          {!isCameraActive ? (
            <button
              onClick={startCamera}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Icon icon="mdi:camera" className="text-xl" />
              Start Camera
            </button>
          ) : (
            <>
              <button
                onClick={stopCamera}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <Icon icon="mdi:stop" className="text-xl" />
                Stop Camera
              </button>
              <button
                onClick={clearSentence}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                <Icon icon="mdi:refresh" className="text-xl" />
                Clear Sentence
              </button>
            </>
          )}
        </div>

        {/* Prediction Results */}
        {lastPrediction && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Last Prediction:</p>
                <p className="text-2xl font-bold text-blue-600">
                  {lastPrediction}
                </p>
              </div>
              {lastConfidence !== null && (
                <div className="text-right">
                  <p className="text-sm text-gray-600">Confidence:</p>
                  <p className="text-xl font-semibold text-green-600">
                    {(lastConfidence * 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
            {sentence && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">Sentence Formed:</p>
                <p className="text-lg font-medium text-purple-600">
                  {sentence}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraFeed;
