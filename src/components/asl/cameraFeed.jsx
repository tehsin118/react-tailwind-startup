import React, { useRef, useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import useWebSocket from "react-use-websocket";
import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

const CameraFeed = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const handLandmarkerRef = useRef(null);
  const drawingUtilsRef = useRef(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [frameCount, setFrameCount] = useState(0);
  const [lastPrediction, setLastPrediction] = useState(null);
  const [lastConfidence, setLastConfidence] = useState(null);
  const [sentence, setSentence] = useState("");
  const [landmarksDetected, setLandmarksDetected] = useState(false);

  const frameCountRef = useRef(0);
  const wsUrl = "wss://asl-backend.octaloop.dev/ws";

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

  // Initialize MediaPipe Hand Landmarker
  useEffect(() => {
    const initializeHandLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.6,
        });

        handLandmarkerRef.current = handLandmarker;
        console.log("MediaPipe Hand Landmarker initialized successfully");
      } catch (error) {
        console.error("Error initializing MediaPipe Hand Landmarker:", error);
      }
    };

    initializeHandLandmarker();
  }, []);

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
          // Ensure video is playing
          videoRef.current
            .play()
            .then(() => {
              console.log("Video playing successfully");
              // Match canvas to video size
              if (videoRef.current.videoWidth && videoRef.current.videoHeight) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                console.log(
                  `Canvas resized to: ${canvasRef.current.width}x${canvasRef.current.height}`,
                );
              }
              startFrameCapture();
            })
            .catch((err) => {
              console.error("Error playing video:", err);
            });
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
    const canvas = canvasRef.current;
    const video = videoRef.current;

    // Check if we should continue
    if (!canvas || !video || !video.srcObject) {
      console.log("Frame loop stopped - missing refs or stream");
      return;
    }

    // Check if video has data
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(captureFrameLoop);
      return;
    }

    const context = canvas.getContext("2d");

    // Always draw video to canvas for smooth display
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const now = performance.now();
    const elapsed = now - lastFrameTimeRef.current;

    // Process landmarks and send to backend at 10 FPS (every 100ms)
    if (elapsed >= 100) {
      lastFrameTimeRef.current = now;
      processLandmarks();
    }

    // Continue the loop
    animationFrameRef.current = requestAnimationFrame(captureFrameLoop);
  };

  const processLandmarks = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const handLandmarker = handLandmarkerRef.current;

    if (!canvas || !video) return;

    const context = canvas.getContext("2d");

    // Detect hand landmarks
    let allLandmarks = [];
    const startTimeMs = performance.now();

    if (handLandmarker) {
      try {
        const handResults = handLandmarker.detectForVideo(video, startTimeMs);

        // Process and draw hand landmarks
        if (handResults.landmarks && handResults.landmarks.length > 0) {
          setLandmarksDetected(true);

          // Initialize drawing utils if not already done
          if (!drawingUtilsRef.current) {
            drawingUtilsRef.current = new DrawingUtils(context);
          }

          const drawingUtils = drawingUtilsRef.current;

          // Collect all landmarks from all detected hands
          handResults.landmarks.forEach((landmarks, handIndex) => {
            // Draw landmarks and connections for each detected hand
            drawingUtils.drawLandmarks(landmarks, {
              radius: 5,
              color: "#00FF00",
              fillColor: "#FF0000",
            });

            drawingUtils.drawConnectors(
              landmarks,
              HandLandmarker.HAND_CONNECTIONS,
              {
                color: "#00FF00",
                lineWidth: 2,
              },
            );

            // Add each landmark to the array with hand index
            landmarks.forEach((landmark, landmarkIndex) => {
              allLandmarks.push({
                type: "hand",
                handIndex,
                landmarkIndex,
                x: landmark.x,
                y: landmark.y,
                z: landmark.z,
              });
            });
          });

          console.log("=== HAND LANDMARKS DETECTED ===");
          console.log(`Total Hands: ${handResults.landmarks.length}`);
          console.log(`Total Landmarks: ${allLandmarks.length}`);
        } else {
          setLandmarksDetected(false);
        }
      } catch (error) {
        console.error("Error detecting hands:", error);
      }
    }

    // Increment frame counter
    frameCountRef.current += 1;
    setFrameCount(frameCountRef.current);

    // Flatten landmarks data to array format [x, y, z, x, y, z, ...]
    const flattenedLandmarks = allLandmarks.flatMap((landmark) => [
      landmark.x,
      landmark.y,
      landmark.z,
    ]);

    // Ensure exactly 225 values (pad with zeros if needed, truncate if exceeds)
    // Round each value to 2 decimal places
    const paddedLandmarks = new Array(225).fill(0);

    console.log("paddedLandmarks", flattenedLandmarks);

    for (let i = 0; i < Math.min(flattenedLandmarks.length, 225); i++) {
      paddedLandmarks[i] = Math.round(flattenedLandmarks[i] * 100) / 100;
    }

    // Only send to backend if we have landmarks and WebSocket is open
    if (flattenedLandmarks.length > 0 && readyState === 1) {
      const message = {
        type: "prediction_request",
        landmarks: paddedLandmarks,
        timestamp: Date.now(),
        // frame_count: frameCountRef.current,
        // detected_landmarks_count: allLandmarks.length,
      };

      sendMessage(JSON.stringify(message));
      console.log(`✅ Frame #${paddedLandmarks} - Landmarks sent to backend`);
    } else if (flattenedLandmarks.length === 0) {
      console.log(`⚠️ Frame #${frameCountRef.current} - No landmarks detected`);
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

          <div className="flex items-center gap-2">
            <span className="text-sm">Landmarks: </span>
            <span
              className={`text-sm font-semibold ${
                landmarksDetected ? "text-green-500" : "text-gray-500"
              }`}
            >
              {landmarksDetected ? "Detected" : "None"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Video Display */}
        <div className="relative" style={{ maxWidth: "640px" }}>
          <canvas
            ref={canvasRef}
            width="1280"
            height="720"
            className="border-2 border-gray-300 rounded-lg w-full"
            style={{ width: "100%", height: "auto", display: "block" }}
          />
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ display: "none" }}
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
