import React, { useRef, useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import useWebSocket from "react-use-websocket";
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

const CameraDetection = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const poseLandmarkerRef = useRef(null);
  const drawingUtilsRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [messageHistory, setMessageHistory] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [frameCount, setFrameCount] = useState(0);
  const [landmarksDetected, setLandmarksDetected] = useState(false);
  const frameCountRef = useRef(0);

  const wsUrl = "https://asl-backend.octaloop.dev/ws/asl";

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

  useEffect(() => {
    // Listen for messages from WebSocket
    if (lastMessage !== null) {
      console.log("Received message:", lastMessage.data);
      setMessageHistory((prev) => prev.concat(lastMessage));
    }
  }, [lastMessage]);

  // Initialize MediaPipe Pose Landmarker
  useEffect(() => {
    const initializePoseLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );

        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 6, // Detect up to 6 poses (6 * 33 = 198 landmarks, under 225 limit)
          minPoseDetectionConfidence: 0.1, // Minimum threshold
          minPosePresenceConfidence: 0.1, // Maximum sensitivity
          minTrackingConfidence: 0.1, // Maximum tracking sensitivity
        });

        poseLandmarkerRef.current = poseLandmarker;
        console.log("MediaPipe Pose Landmarker initialized");
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
      }
    };

    initializePoseLandmarker();
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
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Reset frame counter
      frameCountRef.current = 0;
      setFrameCount(0);
    }
  };

  const startFrameCapture = () => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Capture and send frames at 10 FPS
    intervalRef.current = setInterval(() => {
      captureFrame();
    }, 100);
  };

  const captureFrame = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const poseLandmarker = poseLandmarkerRef.current;

    if (canvas && video && readyState === 1) {
      // Check if video is actually playing
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        console.warn("Video not ready yet");
        return;
      }

      const context = canvas.getContext("2d");

      // Clear canvas before drawing
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Detect pose landmarks if MediaPipe is initialized
      let allLandmarks = [];
      if (poseLandmarker) {
        try {
          const startTimeMs = performance.now();
          const results = poseLandmarker.detectForVideo(video, startTimeMs);

          // Process and log landmarks
          if (results.landmarks && results.landmarks.length > 0) {
            setLandmarksDetected(true);

            // Initialize drawing utils if not already done
            if (!drawingUtilsRef.current) {
              drawingUtilsRef.current = new DrawingUtils(context);
            }

            const drawingUtils = drawingUtilsRef.current;

            // Collect all landmarks from all detected poses
            results.landmarks.forEach((landmarks, poseIndex) => {
              // Draw landmarks and connections for each detected pose
              drawingUtils.drawLandmarks(landmarks, {
                radius: (data) =>
                  DrawingUtils.lerp(data.from.z, -0.15, 0.1, 5, 1),
                color: "#00FF00",
                fillColor: "#FF0000",
              });

              drawingUtils.drawConnectors(
                landmarks,
                PoseLandmarker.POSE_CONNECTIONS,
                {
                  color: "#00FF00",
                  lineWidth: 2,
                },
              );

              // Add each landmark to the array with pose index
              landmarks.forEach((landmark, landmarkIndex) => {
                allLandmarks.push({
                  poseIndex,
                  landmarkIndex,
                  x: landmark.x,
                  y: landmark.y,
                  z: landmark.z,
                  visibility: landmark.visibility,
                });
              });
            });

            // Enforce 225 landmark limit
            if (allLandmarks.length > 225) {
              allLandmarks = allLandmarks.slice(0, 225);
            }

            // Console log the landmark data
            console.log("=== LANDMARK DETECTION DATA ===");
            console.log(`Frame: #${frameCountRef.current}`);
            console.log(`Total Poses Detected: ${results.landmarks.length}`);
            console.log(`Total Landmarks: ${allLandmarks.length} (max: 225)`);
            console.log(`Landmarks per pose: 33`);
            console.log("Landmark Data:", allLandmarks);
            console.log("================================");
          } else {
            setLandmarksDetected(false);
            console.log("No pose landmarks detected in this frame");
          }
        } catch (error) {
          console.error("Error detecting pose:", error);
        }
      }

      // Increment frame counter
      frameCountRef.current += 1;
      setFrameCount(frameCountRef.current);

      // Flatten landmarks data to array format [x, y, z, visibility, x, y, z, visibility, ...]
      const flattenedLandmarks = allLandmarks.flatMap((landmark) => [
        landmark.x,
        landmark.y,
        landmark.z,
        landmark.visibility,
      ]);

      // Debug logging
      console.log(`Total landmarks collected: ${allLandmarks.length}`);
      console.log(`Flattened array length: ${flattenedLandmarks.length}`);
      console.log(`First 20 values:`, flattenedLandmarks.slice(0, 20));

      // Only send if we have landmarks detected
      if (flattenedLandmarks.length === 0) {
        console.warn("No landmarks detected - skipping frame send");
        return;
      }

      // Ensure exactly 225 values (pad with zeros if needed, truncate if exceeds)
      const paddedLandmarks = new Array(225).fill(0);
      for (let i = 0; i < Math.min(flattenedLandmarks.length, 225); i++) {
        paddedLandmarks[i] = flattenedLandmarks[i];
      }

      // Send landmark data to backend via WebSocket in the required format
      const landmarkData = {
        type: "video_buffer",
        buffer_id: `video_${Date.now()}`,
        frame_count: frameCountRef.current,
        data: [paddedLandmarks], // Array containing exactly 225 values
      };

      sendMessage(JSON.stringify(landmarkData));
      console.log("landmarkDatalandmarkDatalandmarkData", landmarkData);

      console.log(`Frame #${frameCountRef.current} sent to backend`);
      console.log(
        `Data length: ${paddedLandmarks.length} values (${allLandmarks.length} landmarks detected)`,
      );
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
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{ display: "none" }}
            />
            <canvas
              ref={canvasRef}
              width="640"
              height="480"
              className="border-2 border-gray-300 rounded-lg w-full"
              style={{ maxWidth: "640px", height: "auto" }}
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

          <div className="flex gap-3">
            {!isCameraActive ? (
              <button
                onClick={startCamera}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Icon icon="mdi:camera" className="text-xl" />
                Start Camera
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <Icon icon="mdi:camera-off" className="text-xl" />
                Stop Camera
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

export default CameraDetection;
