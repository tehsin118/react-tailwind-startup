import React, { useRef, useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import useWebSocket from "react-use-websocket";
import {
  HandLandmarker,
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils,
  HolisticLandmarker,
} from "@mediapipe/tasks-vision";

const CameraDetections = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const holisticLandmarkerRef = useRef(null);
  const drawingUtilsRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [uploadedVideoFile, setUploadedVideoFile] = useState(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoObjectURL, setVideoObjectURL] = useState(null);
  const [messageHistory, setMessageHistory] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [frameCount, setFrameCount] = useState(0);
  const [landmarksDetected, setLandmarksDetected] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
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

  // Initialize MediaPipe Holistic Landmarker
  useEffect(() => {
    const initializeHolisticLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );

        // const holisticLandmarker = await HolisticLandmarker.createFromModelPath(
        //   vision,
        //   {

        //     "https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/hand_landmark.task",

        //   }

        // );

        const holisticLandmarker = await HolisticLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/hand_landmark.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            // numHands: 2, // Detect both hands (2 * 21 = 42 landmarks)
            minHandDetectionConfidence: 0.1,
            // minHandPresenceConfidence: 0.5,
            // minTrackingConfidence: 0.5,
          },
        );

        holisticLandmarkerRef.current = holisticLandmarker;
        console.log("MediaPipe Holistic Landmarker initialized");
      } catch (error) {
        console.error("Error initializing Holistic Landmarker:", error);
      }
    };

    initializeHolisticLandmarker();
  }, []);

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
    const holisticLandmarker = holisticLandmarkerRef.current;

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

      // Clear canvas before drawing
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Detect holistic landmarks (pose, face, and hands)
      let allLandmarks = [];
      const startTimeMs = performance.now();

      // Detect using holistic landmarker
      if (holisticLandmarker) {
        try {
          const results = holisticLandmarker.detectForVideo(video, startTimeMs);

          // Initialize drawing utils if not already done
          if (!drawingUtilsRef.current) {
            drawingUtilsRef.current = new DrawingUtils(context);
          }

          const drawingUtils = drawingUtilsRef.current;

          // Process hand landmarks
          if (results.leftHandLandmarks) {
            setLandmarksDetected(true);
            drawingUtils.drawLandmarks(results.leftHandLandmarks, {
              radius: 5,
              color: "#00FF00",
              fillColor: "#FF0000",
            });
            drawingUtils.drawConnectors(
              results.leftHandLandmarks,
              HolisticLandmarker.HAND_CONNECTIONS,
              {
                color: "#00FF00",
                lineWidth: 2,
              },
            );

            results.leftHandLandmarks.forEach((landmark, landmarkIndex) => {
              allLandmarks.push({
                type: "hand",
                handIndex: 0,
                landmarkIndex,
                x: landmark.x,
                y: landmark.y,
                z: landmark.z,
              });
            });
          }

          if (results.rightHandLandmarks) {
            setLandmarksDetected(true);
            drawingUtils.drawLandmarks(results.rightHandLandmarks, {
              radius: 5,
              color: "#00FF00",
              fillColor: "#FF0000",
            });
            drawingUtils.drawConnectors(
              results.rightHandLandmarks,
              HolisticLandmarker.HAND_CONNECTIONS,
              {
                color: "#00FF00",
                lineWidth: 2,
              },
            );

            results.rightHandLandmarks.forEach((landmark, landmarkIndex) => {
              allLandmarks.push({
                type: "hand",
                handIndex: 1,
                landmarkIndex,
                x: landmark.x,
                y: landmark.y,
                z: landmark.z,
              });
            });
          }

          // Process face landmarks
          if (results.faceLandmarks) {
            setLandmarksDetected(true);

            // Face landmarks for sign language (33 key points)
            const keyFaceIndices = [
              // Right eye (5 points)
              33, 133, 160, 159, 158,
              // Left eye (5 points)
              362, 263, 387, 386, 385,
              // Right eyebrow (3 points)
              46, 52, 65,
              // Left eyebrow (3 points)
              276, 282, 295,
              // Nose (6 points)
              1, 2, 98, 327, 4, 5,
              // Mouth outer (9 points)
              61, 291, 0, 17, 84, 314, 405, 375, 267,
              // Chin and jaw (2 points)
              152, 175,
            ];

            const keyPoints = keyFaceIndices
              .map((i) => results.faceLandmarks[i])
              .filter(Boolean);

            drawingUtils.drawLandmarks(keyPoints, {
              radius: 3,
              color: "#00FFFF",
              fillColor: "#FFFF00",
            });

            keyFaceIndices.forEach((faceIndex) => {
              if (results.faceLandmarks[faceIndex]) {
                const landmark = results.faceLandmarks[faceIndex];
                allLandmarks.push({
                  type: "face",
                  landmarkIndex: faceIndex,
                  x: landmark.x,
                  y: landmark.y,
                  z: landmark.z,
                });
              }
            });

            console.log(
              `Face Detected with ${keyFaceIndices.length} key landmarks`,
            );
          }

          console.log(
            `Holistic Detection - Left Hand: ${!!results.leftHandLandmarks}, Right Hand: ${!!results.rightHandLandmarks}, Face: ${!!results.faceLandmarks}`,
          );
        } catch (error) {
          console.error("Error detecting holistic landmarks:", error);
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
        // landmark.visibility,
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

      // Convert canvas to base64 for video frame
      const dataURL = canvas.toDataURL("image/jpeg", 0.8);
      const base64Frame = dataURL.split(",")[1]; // Remove data:image/jpeg;base64, prefix

      // Send both landmark data and video frame to backend
      const landmarkData = {
        type: "video_buffer",
        // frames: [base64Frame], // Array of base64 encoded frames
        timestamp: Date.now(),
        buffer_id: `video_${Date.now()}`,
        frame_count: frameCountRef.current,
        landmarks: paddedLandmarks, // Include landmark data
      };

      sendMessage(JSON.stringify(landmarkData));
      console.log("landmarkDatalandmarkDatalandmarkData", landmarkData);

      console.log(`Frame #${frameCountRef.current} sent to backend`);
      console.log(
        `Data: ${paddedLandmarks.length} landmark values, 1 base64 frame (${allLandmarks.length} landmarks detected)`,
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
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
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
