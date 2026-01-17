import React, { useRef, useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import useWebSocket from "react-use-websocket";
import {
  HandLandmarker,
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

const CameraDetection = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const handLandmarkerRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
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
          numHands: 2, // Detect both hands (2 * 21 = 42 landmarks)
          minHandDetectionConfidence: 0.3,
          minHandPresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });

        handLandmarkerRef.current = handLandmarker;
        console.log("MediaPipe Hand Landmarker initialized");
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
      }
    };

    initializeHandLandmarker();
  }, []);

  // Initialize MediaPipe Face Landmarker
  useEffect(() => {
    const initializeFaceLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );

        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.3,
          minFacePresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });

        faceLandmarkerRef.current = faceLandmarker;
        console.log("MediaPipe Face Landmarker initialized");
      } catch (error) {
        console.error("Error initializing Face Landmarker:", error);
      }
    };

    initializeFaceLandmarker();
  }, []);

  // gsap
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
    const handLandmarker = handLandmarkerRef.current;
    const faceLandmarker = faceLandmarkerRef.current;

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

      // Detect hand and face landmarks
      let allLandmarks = [];
      const startTimeMs = performance.now();

      // Detect hands
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
                  visibility: landmark.visibility || 1.0,
                });
              });
            });

            console.log(
              `Total Hands Detected: ${handResults.landmarks.length}`,
            );
          }
        } catch (error) {
          console.error("Error detecting hands:", error);
        }
      }

      // Detect face
      if (faceLandmarker) {
        try {
          const faceResults = faceLandmarker.detectForVideo(video, startTimeMs);

          if (
            faceResults.faceLandmarks &&
            faceResults.faceLandmarks.length > 0
          ) {
            setLandmarksDetected(true);

            if (!drawingUtilsRef.current) {
              drawingUtilsRef.current = new DrawingUtils(context);
            }

            const drawingUtils = drawingUtilsRef.current;

            // Expanded face landmarks for sign language (30 key points)
            // Eyes, eyebrows, nose, mouth, chin - critical for ASL facial expressions
            const keyFaceIndices = [
              // Right eye (5 points)
              33, 133, 160, 159, 158,
              // Left eye (5 points)
              362, 263, 387, 386, 385,
              // Right eyebrow (3 points)
              46, 52, 65,
              // Left eyebrow (3 points)
              276, 282, 295,
              // Nose (5 points)
              1, 2, 98, 327, 4,
              // Mouth outer (8 points)
              61, 291, 0, 17, 84, 314, 405, 375,
              // Chin (1 point)
              152,
            ]; // Total: 30 landmarks

            faceResults.faceLandmarks.forEach((faceLandmarks) => {
              // Draw key face points
              const keyPoints = keyFaceIndices
                .map((i) => faceLandmarks[i])
                .filter(Boolean);

              drawingUtils.drawLandmarks(keyPoints, {
                radius: 3,
                color: "#00FFFF",
                fillColor: "#FFFF00",
              });

              // Add key face landmarks to array
              keyFaceIndices.forEach((faceIndex) => {
                if (faceLandmarks[faceIndex]) {
                  const landmark = faceLandmarks[faceIndex];
                  allLandmarks.push({
                    type: "face",
                    landmarkIndex: faceIndex,
                    x: landmark.x,
                    y: landmark.y,
                    z: landmark.z,
                    visibility: landmark.visibility || 1.0,
                  });
                }
              });
            });

            console.log(
              `Face Detected with ${keyFaceIndices.length} key landmarks`,
            );
          }
        } catch (error) {
          console.error("Error detecting face:", error);
        }
      }

      // Update detection status
      if (allLandmarks.length === 0) {
        setLandmarksDetected(false);
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
      const handCount = allLandmarks.filter((l) => l.type === "hand").length;
      const faceCount = allLandmarks.filter((l) => l.type === "face").length;
      console.log("=== SIGN LANGUAGE DETECTION DATA ===");
      console.log(`Frame: #${frameCountRef.current}`);
      console.log(
        `Hand landmarks: ${handCount} | Face landmarks: ${faceCount}`,
      );
      console.log(`Total landmarks: ${allLandmarks.length}`);
      console.log(`Flattened array length: ${flattenedLandmarks.length}`);
      console.log("====================================");

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
