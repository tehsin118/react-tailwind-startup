import React, { useRef, useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import useWebSocket from "react-use-websocket";
import {
  HandLandmarker,
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
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [uploadedVideoFile, setUploadedVideoFile] = useState(null);
  const [messageHistory, setMessageHistory] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [frameCount, setFrameCount] = useState(0);
  const [landmarksDetected, setLandmarksDetected] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [actualFPS, setActualFPS] = useState(0);
  const [isProcessingComplete, setIsProcessingComplete] = useState(false);
  const [distanceStatus, setDistanceStatus] = useState("unknown"); // "good", "too-close", "too-far", "unknown"
  const [handSize, setHandSize] = useState(0); // Percentage of frame height
  const [formedSentence, setFormedSentence] = useState(null); // Store API response
  const [shouldConnectWS, setShouldConnectWS] = useState(false); // Control WebSocket connection
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const fpsCounterRef = useRef(0);
  const fpsStartTimeRef = useRef(0);
  const allLandmarksDataRef = useRef([]); // Store all landmarks from all frames
  const allFramesDataRef = useRef([]); // Store all frame data

  const wsUrl = "https://asl-backend.octaloop.dev";
  // const wsUrl = "https://9707db3731bf.ngrok-free.app";
  // const wsUrl = "https://bd109d629a99.ngrok-free.app/ws";

  const { sendMessage, lastMessage, readyState } = useWebSocket(
    shouldConnectWS ? `${wsUrl}/ws` : null, // Only connect when shouldConnectWS is true
    {
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
      shouldReconnect: () => shouldConnectWS, // Only reconnect if we want connection
    },
  );

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
          numHands: 2,
          // Detect both hands (2 * 21 = 42 landmarks)
          // minHandDetectionConfidence: 0.6,
          // minHandPresenceConfidence: 0.7,
          // minTrackingConfidence: 0.7,
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
  // useEffect(() => {
  //   const initializeFaceLandmarker = async () => {
  //     try {
  //       const vision = await FilesetResolver.forVisionTasks(
  //         "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
  //       );

  //       const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
  //         baseOptions: {
  //           modelAssetPath:
  //             "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  //           delegate: "GPU",
  //         },
  //         runningMode: "VIDEO",
  //         numFaces: 1,
  //         // minFaceDetectionConfidence: 0.7,
  //         // minFacePresenceConfidence: 0.7,
  //         // minTrackingConfidence: 0.7,
  //       });

  //       faceLandmarkerRef.current = faceLandmarker;
  //       console.log("MediaPipe Face Landmarker initialized");
  //     } catch (error) {
  //       console.error("Error initializing Face Landmarker:", error);
  //     }
  //   };

  //   initializeFaceLandmarker();
  // }, []);

  const handleVideoUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("video/")) {
      setUploadedVideoFile(file);
      setIsVideoMode(true);

      // Load the video but don't auto-play
      const url = URL.createObjectURL(file);
      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.load();
        videoRef.current.onloadedmetadata = () => {
          setVideoDuration(videoRef.current.duration);
          setCurrentTime(0);
          setIsVideoPlaying(false);
        };

        // Update current time during playback
        videoRef.current.ontimeupdate = () => {
          setCurrentTime(videoRef.current.currentTime);
        };

        // Handle video end
        videoRef.current.onended = () => {
          console.log("Video ended - processing complete");
          setIsVideoPlaying(false);
          setIsProcessingComplete(true);

          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          console.log(`✅ Processing Complete!`);
          console.log(
            `Total Frames Processed: ${allLandmarksDataRef.current.length}`,
          );
          console.log(
            `Total Landmarks Data Collected: ${allLandmarksDataRef.current.length * 225} values`,
          );
          console.log(`You can now download the landmark files.`);
        };
      }
    }
  };

  const startCamera = async () => {
    try {
      // Connect WebSocket when starting camera
      setShouldConnectWS(true);
      setFormedSentence(null); // Clear previous sentence

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);

        // Start capturing frames after camera is ready
        videoRef.current.onloadedmetadata = () => {
          // Ensure video is playing so frames can be drawn
          videoRef.current.play();
          // Match canvas to actual video size when available
          if (videoRef.current.videoWidth && videoRef.current.videoHeight) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
          }
          startFrameCapture();
        };
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert(
        "Failed to access camera. Please ensure camera permissions are granted.",
      );
      setShouldConnectWS(false); // Disconnect if camera fails
    }
  };

  const playVideo = () => {
    if (videoRef.current && isVideoMode) {
      // Connect WebSocket when playing video
      setShouldConnectWS(true);
      setFormedSentence(null); // Clear previous sentence

      // Reset data collection
      allLandmarksDataRef.current = [];
      allFramesDataRef.current = [];
      setIsProcessingComplete(false);

      videoRef.current.currentTime = 0; // Start from beginning
      videoRef.current.play();
      setIsVideoPlaying(true);
      setIsCameraActive(true);
      startFrameCapture();
    }
  };

  // Function to save landmarks data as NPY-compatible JSON
  const saveLandmarksAsNPY = () => {
    if (allLandmarksDataRef.current.length === 0) {
      alert("No landmark data to save. Please process a video first.");
      return;
    }

    // Create NPY-compatible data structure
    const npyData = {
      shape: [allLandmarksDataRef.current.length, 225], // [num_frames, num_landmarks]
      dtype: "float32",
      data: allLandmarksDataRef.current,
      metadata: {
        video_name: uploadedVideoFile?.name || "camera_recording",
        total_frames: allLandmarksDataRef.current.length,
        fps: actualFPS,
        timestamp: new Date().toISOString(),
      },
    };

    // Save as JSON (can be converted to .npy in Python)
    const jsonBlob = new Blob([JSON.stringify(npyData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(jsonBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `landmarks_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(
      `✅ Saved ${allLandmarksDataRef.current.length} frames of landmark data`,
    );
  };

  // Function to save all frames data
  const saveAllFramesData = () => {
    if (allFramesDataRef.current.length === 0) {
      alert("No frame data to save. Please process a video first.");
      return;
    }

    const framesData = {
      total_frames: allFramesDataRef.current.length,
      video_name: uploadedVideoFile?.name || "camera_recording",
      fps: actualFPS,
      frames: allFramesDataRef.current,
      metadata: {
        timestamp: new Date().toISOString(),
        processing_complete: isProcessingComplete,
      },
    };

    const jsonBlob = new Blob([JSON.stringify(framesData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(jsonBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `all_frames_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`✅ Saved ${allFramesDataRef.current.length} frames data`);
  };

  // Function to download both files
  const downloadAllData = () => {
    saveLandmarksAsNPY();
    setTimeout(() => saveAllFramesData(), 500); // Small delay to prevent browser blocking
  };

  const pauseVideo = () => {
    if (videoRef.current && isVideoMode) {
      videoRef.current.pause();
      setIsVideoPlaying(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };

  const handleGetSentence = async () => {
    try {
      const response = await fetch(`${wsUrl}/api/form-sentence`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clear_after_formation: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Formed sentence response:", data);
      setFormedSentence(data);
    } catch (error) {
      console.error("Error forming sentence:", error);
      setFormedSentence({ error: error.message });
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
        videoRef.current.src = "";
        setUploadedVideoFile(null);
        setIsVideoMode(false);
        setIsVideoPlaying(false);
        setVideoDuration(0);
        setCurrentTime(0);
      }

      setIsCameraActive(false);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Reset frame counter and FPS monitoring
      frameCountRef.current = 0;
      setFrameCount(0);
      fpsCounterRef.current = 0;
      setActualFPS(0);
      lastFrameTimeRef.current = 0;
      fpsStartTimeRef.current = 0;

      // Clear collected data if stopping completely
      if (!isVideoMode) {
        allLandmarksDataRef.current = [];
        allFramesDataRef.current = [];
        setIsProcessingComplete(false);
      }

      // Disconnect WebSocket when stopping camera
      setShouldConnectWS(false);

      // Call API to form sentence
      handleGetSentence();
    }
  };

  const startFrameCapture = () => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Reset FPS monitoring
    fpsCounterRef.current = 0;
    fpsStartTimeRef.current = performance.now();
    lastFrameTimeRef.current = performance.now();

    // Capture and send frames at 30 FPS (33.33ms interval)
    intervalRef.current = setInterval(() => {
      captureFrame();
    }, 33); // ~30 FPS
  };

  const captureFrame = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const handLandmarker = handLandmarkerRef.current;

    if (canvas && video) {
      // Check if video is actually playing
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        console.warn("Video not ready yet");
        return;
      }

      // Calculate actual FPS
      const currentTime = performance.now();
      const deltaTime = currentTime - lastFrameTimeRef.current;
      lastFrameTimeRef.current = currentTime;

      fpsCounterRef.current += 1;

      // Update FPS display every 30 frames
      if (fpsCounterRef.current % 30 === 0) {
        const elapsedTime = currentTime - fpsStartTimeRef.current;
        const calculatedFPS = Math.round((30 * 1000) / elapsedTime);
        setActualFPS(calculatedFPS);
        fpsStartTimeRef.current = currentTime;
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

            const firstHandOnly = handResults.landmarks.slice(0, 1);

            // Collect all landmarks from all detected hands
            firstHandOnly.forEach((landmarks, handIndex) => {
              // handResults.landmarks.forEach((landmarks, handIndex) => {

              // Calculate hand bounding box to determine distance
              const xCoords = landmarks.map((l) => l.x);
              const yCoords = landmarks.map((l) => l.y);
              const minX = Math.min(...xCoords);
              const maxX = Math.max(...xCoords);
              const minY = Math.min(...yCoords);
              const maxY = Math.max(...yCoords);

              const handWidth = maxX - minX;
              const handHeight = maxY - minY;
              const handSizePercent = Math.round(handHeight * 100);

              // Update hand size state
              setHandSize(handSizePercent);

              // Determine distance status
              // Optimal: hand height is 15-40% of frame
              if (handSizePercent < 12) {
                setDistanceStatus("too-far");
              } else if (handSizePercent > 50) {
                setDistanceStatus("too-close");
              } else {
                setDistanceStatus("good");
              }

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

              // Draw distance feedback box
              const boxColor =
                handSizePercent < 12
                  ? "#FF4444"
                  : handSizePercent > 50
                    ? "#FF8800"
                    : "#00FF00";

              context.strokeStyle = boxColor;
              context.lineWidth = 3;
              context.strokeRect(
                minX * canvas.width,
                minY * canvas.height,
                handWidth * canvas.width,
                handHeight * canvas.height,
              );

              // Display distance text
              context.fillStyle = boxColor;
              context.font = "16px Arial";
              context.fillText(
                `Hand: ${handSizePercent}%`,
                minX * canvas.width,
                minY * canvas.height - 10,
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
                  // visibility: landmark.visibility || 1.0,
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
      console.log("allLandmarks", allLandmarks);

      // Detect face
      // if (faceLandmarker) {
      //   try {
      //     const faceResults = faceLandmarker.detectForVideo(video, startTimeMs);

      //     if (
      //       faceResults.faceLandmarks &&
      //       faceResults.faceLandmarks.length > 0
      //     ) {
      //       setLandmarksDetected(true);

      //       if (!drawingUtilsRef.current) {
      //         drawingUtilsRef.current = new DrawingUtils(context);
      //       }

      //       const drawingUtils = drawingUtilsRef.current;

      //       // Face landmarks for sign language (33 key points to match pose landmarks)
      //       // Eyes, eyebrows, nose, mouth, chin - critical for ASL facial expressions
      //       const keyFaceIndices = [
      //         // Right eye (5 points)
      //         33, 133, 160, 159, 158,
      //         // Left eye (5 points)
      //         362, 263, 387, 386, 385,
      //         // Right eyebrow (3 points)
      //         46, 52, 65,
      //         // Left eyebrow (3 points)
      //         276, 282, 295,
      //         // Nose (6 points)
      //         1, 2, 98, 327, 4, 5,
      //         // Mouth outer (9 points)
      //         61, 291, 0, 17, 84, 314, 405, 375, 267,
      //         // Chin and jaw (2 points)
      //         152, 175,
      //       ]; // Total: 33 landmarks

      //       faceResults.faceLandmarks.forEach((faceLandmarks) => {
      //         // Draw key face points
      //         const keyPoints = keyFaceIndices
      //           .map((i) => faceLandmarks[i])
      //           .filter(Boolean);

      //         drawingUtils.drawLandmarks(keyPoints, {
      //           radius: 3,
      //           color: "#00FFFF",
      //           fillColor: "#FFFF00",
      //         });

      //         // Add key face landmarks to array
      //         keyFaceIndices.forEach((faceIndex) => {
      //           if (faceLandmarks[faceIndex]) {
      //             const landmark = faceLandmarks[faceIndex];
      //             allLandmarks.push({
      //               type: "face",
      //               landmarkIndex: faceIndex,
      //               x: landmark.x,
      //               y: landmark.y,
      //               z: landmark.z,
      //               // visibility: landmark.visibility || 1.0,
      //             });
      //           }
      //         });
      //       });

      //       console.log(
      //         `Face Detected with ${keyFaceIndices.length} key landmarks`,
      //       );
      //     }
      //   } catch (error) {
      //     console.error("Error detecting face:", error);
      //   }
      // }

      // Update detection status
      if (allLandmarks.length === 0) {
        setLandmarksDetected(false);
        setDistanceStatus("unknown");
        setHandSize(0);
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

      // Debug logging for each frame
      const handCount = allLandmarks.filter((l) => l.type === "hand").length;
      const faceCount = allLandmarks.filter((l) => l.type === "face").length;

      console.log("=== FRAME PROCESSING DATA ===");
      console.log(`Frame: #${frameCountRef.current} | FPS: ${actualFPS}`);
      console.log(`Processing Time: ${deltaTime.toFixed(1)}ms`);
      console.log(
        `Hand landmarks: ${handCount} | Face landmarks: ${faceCount}`,
      );
      console.log(`Total landmarks: ${allLandmarks.length}`);
      console.log(`Flattened array length: ${flattenedLandmarks.length}`);

      // Round each value to 2 decimal places (send actual data without padding)
      const roundedLandmarks = flattenedLandmarks.map(
        (value) => Math.round(value * 100) / 100,
      );

      // Convert canvas to base64 for video frame
      const dataURL = canvas.toDataURL("image/jpeg", 0.8);
      const base64Frame = dataURL.split(",")[1]; // Remove data:image/jpeg;base64, prefix

      // Store landmarks for NPY file generation
      allLandmarksDataRef.current.push([...roundedLandmarks]);

      // Store frame data
      allFramesDataRef.current.push({
        frame_number: frameCountRef.current,
        timestamp: Date.now(),
        landmarks: roundedLandmarks,
        detected_landmarks_count: allLandmarks.length,
        hand_count: handCount,
        face_count: faceCount,
      });

      // Send both landmark data and video frame to backend (when socket is open)
      console.log("readyState", readyState);

      if (readyState) {
        console.log("def");
        const landmarkData = {
          type: "prediction_request",
          // frames: [base64Frame], // Array of base64 encoded frames
          timestamp: Date.now(),
          // buffer_id: `video_${Date.now()}`,
          // frame_count: frameCountRef.current,
          landmarks: roundedLandmarks, // Include landmark data
        };

        sendMessage(JSON.stringify(landmarkData));
        console.log("🚀 LANDMARK DATA SENT TO BACKEND:");

        // Log landmark data being sent to backend for each frame
        console.log("landmarkData", landmarkData);

        console.log("================================");
      }
    }
  };

  // Helper function to format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
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
            {isCameraActive && (
              <div className="flex items-center gap-2">
                <span className="text-sm">FPS: </span>
                <span className="text-sm font-semibold text-purple-500">
                  {actualFPS}
                </span>
              </div>
            )}
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
            {landmarksDetected && (
              <div className="flex items-center gap-2">
                <span className="text-sm">Distance: </span>
                <span
                  className={`text-sm font-semibold ${
                    distanceStatus === "good"
                      ? "text-green-500"
                      : distanceStatus === "too-far"
                        ? "text-red-500"
                        : distanceStatus === "too-close"
                          ? "text-orange-500"
                          : "text-gray-500"
                  }`}
                >
                  {distanceStatus === "good"
                    ? `✓ Good (${handSize}%)`
                    : distanceStatus === "too-far"
                      ? `⚠ Too Far (${handSize}%)`
                      : distanceStatus === "too-close"
                        ? `⚠ Too Close (${handSize}%)`
                        : "Unknown"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Distance Guidance Alert */}
        {landmarksDetected && distanceStatus !== "good" && (
          <div
            className={`p-4 rounded-lg border-2 ${
              distanceStatus === "too-far"
                ? "bg-red-50 border-red-300"
                : "bg-orange-50 border-orange-300"
            }`}
          >
            <div className="flex items-start gap-3">
              <Icon
                icon="mdi:alert-circle"
                className={`text-2xl ${
                  distanceStatus === "too-far"
                    ? "text-red-600"
                    : "text-orange-600"
                }`}
              />
              <div>
                <h3
                  className={`font-semibold ${
                    distanceStatus === "too-far"
                      ? "text-red-800"
                      : "text-orange-800"
                  }`}
                >
                  {distanceStatus === "too-far"
                    ? "Move Closer to Camera"
                    : "Move Away from Camera"}
                </h3>
                <p className="text-sm text-gray-700 mt-1">
                  {distanceStatus === "too-far"
                    ? "Your hand is too small in the frame. Move closer (recommended: 0.5-1.5 meters / 1.5-5 feet)."
                    : "Your hand is too large in the frame. Move back slightly for better detection."}
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  <strong>Optimal:</strong> Hand should be 15-40% of frame
                  height. Current: {handSize}%
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="relative">
            <video
              ref={videoRef}
              playsInline
              className={`border-2 border-gray-300 rounded-lg w-full ${isVideoMode ? "block" : "hidden"}`}
              style={{ maxWidth: "640px", height: "auto" }}
            />
            <canvas
              ref={canvasRef}
              width="640"
              height="480"
              className={`border-2 border-gray-300 rounded-lg w-full ${isVideoMode ? "hidden" : "block"}`}
              style={{ maxWidth: "640px", height: "auto" }}
            />
            {!isCameraActive && !isVideoMode && (
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

          {/* Video Info and Controls */}
          {isVideoMode && uploadedVideoFile && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600">
                  <p>
                    <strong>Video:</strong> {uploadedVideoFile.name}
                  </p>
                  <p>
                    <strong>Duration:</strong> {formatTime(videoDuration)}
                  </p>
                </div>
                <div className="text-lg font-mono text-blue-600">
                  {formatTime(currentTime)} / {formatTime(videoDuration)}
                </div>
              </div>

              <div className="flex gap-3 flex-wrap">
                {!isVideoPlaying ? (
                  <button
                    onClick={playVideo}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <Icon icon="mdi:play" className="text-xl" />
                    Play Video
                  </button>
                ) : (
                  <button
                    onClick={pauseVideo}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    <Icon icon="mdi:pause" className="text-xl" />
                    Pause Video
                  </button>
                )}
                <button
                  onClick={stopCamera}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Icon icon="mdi:stop" className="text-xl" />
                  Stop & Remove Video
                </button>
              </div>

              {/* Download buttons - shown after processing complete */}
              {isProcessingComplete &&
                allLandmarksDataRef.current.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-300">
                    <div className="mb-2">
                      <p className="text-sm font-semibold text-green-600 mb-1">
                        ✅ Processing Complete! (
                        {allLandmarksDataRef.current.length} frames)
                      </p>
                      <p className="text-xs text-gray-500">
                        Download landmark data as NPY-compatible JSON files
                      </p>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={saveLandmarksAsNPY}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                      >
                        <Icon icon="mdi:download" className="text-xl" />
                        Download Landmarks (NPY)
                      </button>
                      <button
                        onClick={saveAllFramesData}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                      >
                        <Icon icon="mdi:file-download" className="text-xl" />
                        Download All Frames
                      </button>
                      <button
                        onClick={downloadAllData}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                      >
                        <Icon
                          icon="mdi:download-multiple"
                          className="text-xl"
                        />
                        Download Both Files
                      </button>
                    </div>
                  </div>
                )}
            </div>
          )}

          {!isVideoMode && (
            <div className="flex gap-3 flex-wrap">
              {!isCameraActive ? (
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
                  onClick={stopCamera}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Icon icon="mdi:stop" className="text-xl" />
                  Stop Camera
                </button>
              )}
              {/* <button onClick={handleGetSentence}>as</button> */}
            </div>
          )}
        </div>
        <span>The WebSocket is currently {connectionStatus}</span>
        {lastMessage ? <span>Last message: {lastMessage.data}</span> : null}
        <ul>
          {messageHistory.map((message, idx) => (
            <span key={idx}>{message ? message.data?.message : null}</span>
          ))}
        </ul>

        {/* Display Formed Sentence Results */}
        {formedSentence && (
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-indigo-300">
            <h3 className="text-lg font-semibold text-indigo-800 mb-3 flex items-center gap-2">
              <Icon icon="mdi:text-box-check" className="text-2xl" />
              Formed Sentence
            </h3>
            {formedSentence.error ? (
              <div className="bg-red-100 border border-red-300 rounded p-3">
                <p className="text-red-700 font-semibold">Error:</p>
                <p className="text-red-600">{formedSentence.error}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-white p-3 rounded shadow-sm">
                  <p className="text-sm text-gray-600 mb-1">Sentence:</p>
                  <p className="text-xl font-bold text-gray-800">
                    {formedSentence.sentence ||
                      formedSentence.formed_sentence ||
                      JSON.stringify(formedSentence)}
                  </p>
                </div>
                {formedSentence.confidence && (
                  <div className="bg-white p-3 rounded shadow-sm">
                    <p className="text-sm text-gray-600 mb-1">Confidence:</p>
                    <p className="text-lg font-semibold text-green-600">
                      {(formedSentence.confidence * 100).toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default CameraDetection;
