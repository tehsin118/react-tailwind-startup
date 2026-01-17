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
  const [videoQueue, setVideoQueue] = useState([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [currentRunNumber, setCurrentRunNumber] = useState(0);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [isProcessingStarted, setIsProcessingStarted] = useState(false);
  const [processingLog, setProcessingLog] = useState([]);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const fpsCounterRef = useRef(0);
  const fpsStartTimeRef = useRef(0);
  const allLandmarksDataRef = useRef([]); // Store all landmarks from all frames
  const allFramesDataRef = useRef([]); // Store all frame data
  const currentRunNumberRef = useRef(0); // Track run number immediately
  const currentVideoIndexRef = useRef(0); // Track current video index immediately

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

  // Function to save landmarks data as NPY-compatible JSON
  const handleFolderUpload = (event) => {
    const files = Array.from(event.target.files);
    const videoFiles = files.filter((file) => file.type.startsWith("video/"));

    if (videoFiles.length === 0) {
      alert("No video files found in the selected folder.");
      return;
    }

    setVideoQueue(videoFiles);
    setCurrentVideoIndex(0);
    setCurrentRunNumber(0);
    setProcessingLog([]);
    setIsBatchProcessing(false);
    setIsProcessingStarted(false);
    setIsVideoMode(true);

    console.log(`📁 Loaded ${videoFiles.length} videos for batch processing`);
    console.log(`Click "Start Processing" to begin automated batch processing`);
  };

  // Start the batch processing
  const startBatchProcessing = () => {
    if (videoQueue.length === 0) {
      alert("No videos in queue. Please select a folder first.");
      return;
    }

    setIsBatchProcessing(true);
    setIsProcessingStarted(true);
    setCurrentVideoIndex(0);
    currentVideoIndexRef.current = 0;
    currentRunNumberRef.current = 1;
    setCurrentRunNumber(1);
    setProcessingLog([]);

    console.log(
      `🚀 Starting batch processing of ${videoQueue.length} videos...`,
    );

    // Start processing first video
    loadVideoFromQueue(videoQueue[0]);
  };

  // Load a video from the queue
  const loadVideoFromQueue = (file) => {
    setUploadedVideoFile(file);
    setIsVideoMode(true);

    const url = URL.createObjectURL(file);
    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.load();
      videoRef.current.onloadedmetadata = () => {
        setVideoDuration(videoRef.current.duration);
        setCurrentTime(0);
        setIsVideoPlaying(false);

        console.log(
          `📹 Video loaded: ${file.name}, Duration: ${videoRef.current.duration}s`,
        );

        // Auto-play for batch processing with longer delay
        setTimeout(() => {
          console.log(`▶️ Auto-playing video (Run ${currentRunNumber})...`);
          playVideo();
        }, 1000);
      };

      videoRef.current.ontimeupdate = () => {
        setCurrentTime(videoRef.current.currentTime);
      };

      videoRef.current.onended = () => {
        handleVideoEnd();
      };
    }
  };

  // Handle video end - check if we need second run or move to next video
  const handleVideoEnd = () => {
    console.log("Video ended - processing complete");
    console.log(
      `Current state: isBatchProcessing=${isBatchProcessing}, isProcessingStarted=${isProcessingStarted}, currentRunNumberRef=${currentRunNumberRef.current}, videoQueue.length=${videoQueue.length}, currentVideoIndex=${currentVideoIndex}`,
    );
    setIsVideoPlaying(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Check if we have videos in queue to process
    if (
      videoQueue.length > 0 &&
      currentVideoIndexRef.current < videoQueue.length
    ) {
      const currentVideo = videoQueue[currentVideoIndexRef.current];

      // ALWAYS SAVE after video completes
      const logMsg = `✅ ${currentVideo.name} - Complete (${allLandmarksDataRef.current.length} frames) - SAVING`;
      console.log(logMsg);
      setProcessingLog((prev) => [...prev, logMsg]);

      // Save landmark data with video name
      saveLandmarksForBatch(currentVideo.name);

      // Move to next video using ref (immediate update)
      currentVideoIndexRef.current = currentVideoIndexRef.current + 1;
      const nextIndex = currentVideoIndexRef.current;

      if (nextIndex < videoQueue.length) {
        console.log(
          `📹 Moving to video ${nextIndex + 1} of ${videoQueue.length}: ${videoQueue[nextIndex].name}`,
        );
        setCurrentVideoIndex(nextIndex);
        currentRunNumberRef.current = 1;
        setCurrentRunNumber(1);

        setTimeout(() => {
          console.log(
            `▶️ Loading video ${nextIndex + 1} of ${videoQueue.length}...`,
          );
          loadVideoFromQueue(videoQueue[nextIndex]);
        }, 2000);
      } else {
        // All videos processed
        const finalMsg = `🎉 BATCH PROCESSING COMPLETE! Processed ${videoQueue.length} videos.`;
        console.log(finalMsg);
        setProcessingLog((prev) => [...prev, finalMsg]);
        setIsBatchProcessing(false);
        setIsProcessingStarted(false);
        setIsProcessingComplete(true);
      }
    } else {
      // Single video mode or batch mode fallback - ALWAYS SAVE THE FILE
      console.warn("Fallback mode - saving file anyway");
      console.log(`✅ Processing Complete!`);
      console.log(
        `Total Frames Processed: ${allLandmarksDataRef.current.length}`,
      );
      console.log(
        `Total Landmarks Data Collected: ${allLandmarksDataRef.current.length * 225} values`,
      );

      // Save the file if we have data
      if (allLandmarksDataRef.current.length > 0) {
        const fileName =
          videoQueue[currentVideoIndex]?.name ||
          uploadedVideoFile?.name ||
          "video";
        console.log(`💾 Saving file: ${fileName}`);
        saveLandmarksForBatch(fileName);
      }

      setIsProcessingComplete(true);
      console.log(`You can now download the landmark files.`);
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

  const playVideo = () => {
    console.log(
      `🎬 playVideo called - isVideoMode: ${isVideoMode}, isBatchProcessing: ${isBatchProcessing}, currentRunNumber: ${currentRunNumber}, currentRunNumberRef: ${currentRunNumberRef.current}`,
    );

    if (videoRef.current && isVideoMode) {
      // Only reset data on first run (Run 1), keep data on Run 2
      if (currentRunNumberRef.current === 1) {
        console.log("🔄 First run - resetting all data");
        allLandmarksDataRef.current = [];
        allFramesDataRef.current = [];
      } else {
        console.log(
          `🔄 Run ${currentRunNumber} - keeping existing data (${allLandmarksDataRef.current.length} frames)`,
        );
      }

      setIsProcessingComplete(false);

      // Reset frame counters
      frameCountRef.current = 0;
      setFrameCount(0);
      fpsCounterRef.current = 0;
      setActualFPS(0);

      videoRef.current.currentTime = 0; // Start from beginning

      console.log(`⏪ Video reset to 0:00, attempting to play...`);

      // Use promise-based play with error handling
      const playPromise = videoRef.current.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("✅ Video playback started successfully");
            setIsVideoPlaying(true);
            setIsCameraActive(true);
            startFrameCapture();
          })
          .catch((error) => {
            console.error("❌ Error playing video:", error);
            // Always retry for batch processing
            setTimeout(() => {
              console.log("🔄 Retrying video playback...");
              videoRef.current
                .play()
                .then(() => {
                  console.log("✅ Retry successful!");
                  setIsVideoPlaying(true);
                  setIsCameraActive(true);
                  startFrameCapture();
                })
                .catch((retryError) => {
                  console.error("❌ Retry failed:", retryError);
                  alert(
                    "Failed to play video. Please check console for details.",
                  );
                });
            }, 1000);
          });
      } else {
        setIsVideoPlaying(true);
        setIsCameraActive(true);
        startFrameCapture();
      }
    } else {
      console.warn(
        `⚠️ playVideo conditions not met - videoRef: ${!!videoRef.current}, isVideoMode: ${isVideoMode}`,
      );
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

  // Save landmarks for batch processing with video name
  const saveLandmarksForBatch = (videoName) => {
    console.log("🔵 saveLandmarksForBatch called with:", videoName);
    console.log(
      "🔵 Landmarks data length:",
      allLandmarksDataRef.current.length,
    );

    if (allLandmarksDataRef.current.length === 0) {
      console.warn("⚠️ No landmark data to save for", videoName);
      return;
    }

    try {
      // Remove file extension and add landmarks prefix
      const baseName = videoName.replace(/\.[^/.]+$/, "");
      console.log("🔵 Base name:", baseName);

      const npyData = {
        shape: [allLandmarksDataRef.current.length, 225],
        dtype: "float32",
        data: allLandmarksDataRef.current,
        metadata: {
          video_name: videoName,
          total_frames: allLandmarksDataRef.current.length,
          fps: actualFPS,
          timestamp: new Date().toISOString(),
          run_number: currentRunNumberRef.current,
        },
      };

      console.log("🔵 Creating blob...");
      const jsonBlob = new Blob([JSON.stringify(npyData, null, 2)], {
        type: "application/json",
      });

      console.log("🔵 Creating download link...");
      const url = URL.createObjectURL(jsonBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${baseName}.json`;
      document.body.appendChild(link);

      console.log("🔵 Triggering download...");
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(
        `💾 ✅ SAVED: ${baseName}.json (${allLandmarksDataRef.current.length} frames)`,
      );
    } catch (error) {
      console.error("❌ Error saving landmarks:", error);
    }
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

  const stopProcessing = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
    }

    setUploadedVideoFile(null);
    setIsVideoMode(false);
    setIsVideoPlaying(false);
    setIsCameraActive(false);
    setIsBatchProcessing(false);
    setIsProcessingStarted(false);
    setVideoQueue([]);
    setCurrentVideoIndex(0);
    setCurrentRunNumber(0);
    setVideoDuration(0);
    setCurrentTime(0);

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

    allLandmarksDataRef.current = [];
    allFramesDataRef.current = [];
    setIsProcessingComplete(false);
    setProcessingLog([]);
  };

  const startFrameCapture = () => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Reset FPS monitoring and frame counter
    frameCountRef.current = 0;
    setFrameCount(0);
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
    const faceLandmarker = faceLandmarkerRef.current;

    if (canvas && video && readyState === 1) {
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

            // Face landmarks for sign language (33 key points to match pose landmarks)
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
              // Nose (6 points)
              1, 2, 98, 327, 4, 5,
              // Mouth outer (9 points)
              61, 291, 0, 17, 84, 314, 405, 375, 267,
              // Chin and jaw (2 points)
              152, 175,
            ]; // Total: 33 landmarks

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
                    // visibility: landmark.visibility || 1.0,
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

      // Store landmarks for NPY file generation
      allLandmarksDataRef.current.push([...paddedLandmarks]);

      // Store frame data
      allFramesDataRef.current.push({
        frame_number: frameCountRef.current,
        timestamp: Date.now(),
        landmarks: paddedLandmarks,
        detected_landmarks_count: allLandmarks.length,
        hand_count: handCount,
        face_count: faceCount,
      });

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

      // Log landmark data being sent to backend for each frame
      console.log("🚀 LANDMARK DATA SENT TO BACKEND:");
      console.log(`Frame #${frameCountRef.current}:`, {
        type: landmarkData.type,
        timestamp: landmarkData.timestamp,
        buffer_id: landmarkData.buffer_id,
        frame_count: landmarkData.frame_count,
        landmarks_length: landmarkData.landmarks.length,
        landmarks_sample: landmarkData.landmarks.slice(0, 12), // Show first 12 values
        landmarks_full: landmarkData.landmarks, // Full landmark array
      });
      console.log(
        `✅ Data sent: ${paddedLandmarks.length} landmark values (${allLandmarks.length} detected landmarks)`,
      );
      console.log("================================");
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
      stopProcessing();
    };
  }, []);

  return (
    <>
      <div className="baseCard flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            Batch Video Processing - Landmark Extraction
          </h2>
          {isBatchProcessing && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span>WebSocket:</span>
                <span
                  className={`font-semibold ${
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
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="relative">
            <video
              ref={videoRef}
              playsInline
              muted
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

          {/* Video is hidden - only shows during batch processing */}
          {isVideoMode && uploadedVideoFile && isBatchProcessing && (
            <div className="bg-gray-50 p-2 rounded-lg">
              <div className="text-xs text-gray-600">
                <p>
                  <strong>Current:</strong> {uploadedVideoFile.name} -{" "}
                  {formatTime(currentTime)} / {formatTime(videoDuration)}
                </p>
              </div>
            </div>
          )}

          {!isVideoMode && !isBatchProcessing && (
            <div className="flex gap-3 flex-wrap">
              <label className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors cursor-pointer">
                <Icon icon="mdi:folder-multiple-image" className="text-xl" />
                Select Folder for Batch Processing
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFolderUpload}
                  className="hidden"
                  webkitdirectory=""
                  directory=""
                  multiple
                />
              </label>
            </div>
          )}

          {/* Show video queue and Start Processing button */}
          {videoQueue.length > 0 && !isProcessingStarted && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="mb-3">
                <h3 className="font-semibold text-green-800 mb-2">
                  📁 {videoQueue.length} Videos Ready
                </h3>
                <div className="max-h-32 overflow-y-auto bg-white p-2 rounded border border-green-100 mb-3">
                  {videoQueue.map((video, idx) => (
                    <div key={idx} className="text-xs text-gray-700 py-1">
                      {idx + 1}. {video.name}
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={startBatchProcessing}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
              >
                <Icon icon="mdi:play-circle" className="text-2xl" />
                Start Processing ({videoQueue.length} videos × 2 runs each)
              </button>
            </div>
          )}

          {/* Batch Processing Status */}
          {isBatchProcessing && isProcessingStarted && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-blue-800 mb-1">
                    📹 Batch Processing Active
                  </h3>
                  <p className="text-sm text-blue-600">
                    Video {currentVideoIndex + 1} of {videoQueue.length} - Run{" "}
                    {currentRunNumber} of 2
                  </p>
                  <p className="text-xs text-blue-500 mt-1">
                    Current: {uploadedVideoFile?.name}
                  </p>
                </div>
                <button
                  onClick={stopProcessing}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Icon icon="mdi:stop" className="text-xl" />
                  Stop
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto bg-white p-2 rounded border border-blue-100 mb-3">
                {processingLog.map((log, idx) => (
                  <div
                    key={idx}
                    className="text-xs text-gray-700 py-1 border-b border-gray-100 last:border-0"
                  >
                    {log}
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-600">
                <div className="flex gap-4">
                  <span>
                    Frames:{" "}
                    <strong className="text-blue-600">{frameCount}</strong>
                  </span>
                  <span>
                    FPS:{" "}
                    <strong className="text-purple-600">{actualFPS}</strong>
                  </span>
                  <span>
                    Landmarks:{" "}
                    <strong
                      className={
                        landmarksDetected ? "text-green-600" : "text-gray-400"
                      }
                    >
                      {landmarksDetected ? "Detected" : "None"}
                    </strong>
                  </span>
                </div>
              </div>
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
      </div>
    </>
  );
};

export default CameraDetection;
