import React, { useRef, useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import useWebSocket from "react-use-websocket";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const HandLandMarks = () => {
  const videoRef = useRef(null);
  const intervalRef = useRef(null);
  const handLandmarkerRef = useRef(null);
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [uploadedVideoFile, setUploadedVideoFile] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [frameCount, setFrameCount] = useState(0);
  const [landmarksDetected, setLandmarksDetected] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [actualFPS, setActualFPS] = useState(0);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const fpsCounterRef = useRef(0);
  const fpsStartTimeRef = useRef(0);
  const allLandmarksDataRef = useRef([]);

  const wsUrl = "https://asl-backend.octaloop.dev/ws/asl";

  const { sendMessage, readyState } = useWebSocket(wsUrl, {
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
          //   minHandDetectionConfidence: 0.3,
          //   minHandPresenceConfidence: 0.3,
          //   minTrackingConfidence: 0.3,
        });

        handLandmarkerRef.current = handLandmarker;
        console.log("MediaPipe Hand Landmarker initialized");
      } catch (error) {
        console.error("Error initializing Hand Landmarker:", error);
      }
    };

    initializeHandLandmarker();
  }, []);

  const handleVideoUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("video/")) {
      console.log(`📹 Video selected: ${file.name}`);
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
            `✅ Video loaded: ${file.name}, Duration: ${videoRef.current.duration}s`,
          );
        };

        videoRef.current.ontimeupdate = () => {
          setCurrentTime(videoRef.current.currentTime);
        };

        videoRef.current.onended = () => {
          handleVideoEnd();
        };
      }

      event.target.value = "";
    }
  };

  const handleVideoEnd = () => {
    console.log("Video ended - processing complete");
    setIsVideoPlaying(false);
    setLandmarksDetected(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    console.log(
      `✅ Processing Complete! Total Frames: ${allLandmarksDataRef.current.length}`,
    );
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsVideoMode(true);

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
    if (videoRef.current && isVideoMode) {
      allLandmarksDataRef.current = [];
      frameCountRef.current = 0;
      setFrameCount(0);
      fpsCounterRef.current = 0;
      setActualFPS(0);

      videoRef.current.currentTime = 0;

      // Wait for video to actually start playing before capturing frames
      const handlePlaying = () => {
        console.log("✅ Video is now playing - starting frame capture");
        setIsVideoPlaying(true);
        startFrameCapture();
        videoRef.current.removeEventListener("playing", handlePlaying);
      };

      videoRef.current.addEventListener("playing", handlePlaying);

      const playPromise = videoRef.current.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("✅ Video play() promise resolved");
          })
          .catch((error) => {
            console.error("❌ Error playing video:", error);
            videoRef.current.removeEventListener("playing", handlePlaying);
            setTimeout(() => {
              videoRef.current.addEventListener("playing", handlePlaying);
              videoRef.current.play().catch((retryError) => {
                console.error("❌ Retry failed:", retryError);
                videoRef.current.removeEventListener("playing", handlePlaying);
              });
            }, 1000);
          });
      }
    }
  };

  const stopProcessing = () => {
    if (videoRef.current) {
      if (videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      videoRef.current.pause();
      videoRef.current.src = "";
      videoRef.current.onended = null;
      videoRef.current.ontimeupdate = null;
    }

    setUploadedVideoFile(null);
    setIsVideoMode(false);
    setIsVideoPlaying(false);
    setLandmarksDetected(false);
    setVideoDuration(0);
    setCurrentTime(0);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    frameCountRef.current = 0;
    setFrameCount(0);
    fpsCounterRef.current = 0;
    setActualFPS(0);
    lastFrameTimeRef.current = 0;
    fpsStartTimeRef.current = 0;
    allLandmarksDataRef.current = [];
  };

  const startFrameCapture = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    frameCountRef.current = 0;
    setFrameCount(0);
    fpsCounterRef.current = 0;
    fpsStartTimeRef.current = performance.now();
    lastFrameTimeRef.current = performance.now();

    intervalRef.current = setInterval(() => {
      captureFrame();
    }, 30); // ~30 FPS
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const handLandmarker = handLandmarkerRef.current;

    if (video && readyState === 1) {
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        console.warn("Video not ready yet");
        return;
      }

      const currentTime = performance.now();
      const deltaTime = currentTime - lastFrameTimeRef.current;
      lastFrameTimeRef.current = currentTime;

      fpsCounterRef.current += 1;

      if (fpsCounterRef.current % 30 === 0) {
        const elapsedTime = currentTime - fpsStartTimeRef.current;
        const calculatedFPS = Math.round((30 * 1000) / elapsedTime);
        setActualFPS(calculatedFPS);
        fpsStartTimeRef.current = currentTime;
      }

      let allLandmarks = [];
      const startTimeMs = performance.now();

      // Detect hands
      if (handLandmarker) {
        try {
          const handResults = handLandmarker.detectForVideo(video, startTimeMs);

          if (handResults.landmarks && handResults.landmarks.length > 0) {
            setLandmarksDetected(true);

            handResults.landmarks.forEach((landmarks, handIndex) => {
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

            console.log(
              `Total Hands Detected: ${handResults.landmarks.length}`,
            );
          }
        } catch (error) {
          console.error("Error detecting hands:", error);
        }
      }

      if (allLandmarks.length === 0) {
        setLandmarksDetected(false);
      }

      frameCountRef.current += 1;
      setFrameCount(frameCountRef.current);

      const flattenedLandmarks = allLandmarks.flatMap((landmark) => [
        landmark.x,
        landmark.y,
        landmark.z,
      ]);

      const handCount = allLandmarks.filter((l) => l.type === "hand").length;

      console.log("=== FRAME PROCESSING DATA ===");
      console.log(`Frame: #${frameCountRef.current} | FPS: ${actualFPS}`);
      console.log(`Processing Time: ${deltaTime.toFixed(1)}ms`);
      console.log(`Hand landmarks: ${handCount}`);
      console.log(`Total landmarks: ${allLandmarks.length}`);
      console.log(`Flattened array length: ${flattenedLandmarks.length}`);

      if (flattenedLandmarks.length === 0) {
        console.warn("No landmarks detected - skipping frame send");
        return;
      }

      // Hand landmarks: 42 (21 × 2 hands) × 3 coords = 126 values
      const totalLandmarkValues = 42 * 3; // 126 values
      const paddedLandmarks = new Array(totalLandmarkValues).fill(0);
      for (
        let i = 0;
        i < Math.min(flattenedLandmarks.length, totalLandmarkValues);
        i++
      ) {
        paddedLandmarks[i] = flattenedLandmarks[i];
      }

      allLandmarksDataRef.current.push([...paddedLandmarks]);

      const landmarkData = {
        type: "video_buffer",
        timestamp: Date.now(),
        buffer_id: `video_${Date.now()}`,
        frame_count: frameCountRef.current,
        landmarks: paddedLandmarks,
      };

      sendMessage(JSON.stringify(landmarkData));

      console.log("🚀 LANDMARK DATA SENT TO BACKEND:");
      console.log(`Frame #${frameCountRef.current}:`, {
        type: landmarkData.type,
        timestamp: landmarkData.timestamp,
        buffer_id: landmarkData.buffer_id,
        frame_count: landmarkData.frame_count,
        landmarks_length: landmarkData.landmarks.length,
        landmarks_data: landmarkData.landmarks,
        // landmarks_sample: landmarkData.landmarks.slice(0, 12),
      });
      console.log(
        `✅ Data sent: ${paddedLandmarks.length} landmark values (${allLandmarks.length} detected landmarks)`,
      );
      console.log("================================");
    }
  };

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
          <h2 className="text-xl font-semibold">Hand Landmark Detection</h2>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span>Frames:</span>
              <span className="font-semibold text-blue-500">{frameCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>FPS:</span>
              <span className="font-semibold text-purple-600">{actualFPS}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Landmarks:</span>
              <span
                className={`font-semibold ${landmarksDetected ? "text-green-600" : "text-gray-400"}`}
              >
                {landmarksDetected ? "Detected" : "None"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>WebSocket:</span>
              <span
                className={`font-semibold ${connectionStatus === "Connected" ? "text-green-500" : connectionStatus === "Error" ? "text-red-500" : "text-gray-500"}`}
              >
                {connectionStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="relative" style={{ maxWidth: "640px" }}>
            <video
              ref={videoRef}
              playsInline
              muted
              className={`border-2 border-gray-300 rounded-lg w-full ${isVideoMode ? "block" : "hidden"}`}
              style={{ maxWidth: "640px", height: "auto" }}
            />
            {!isVideoMode && (
              <div className="h-48 inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                <div className="text-center">
                  <Icon
                    icon="mdi:hand-wave"
                    className="text-6xl text-gray-400 mx-auto mb-2"
                  />
                  <p className="text-gray-500">No hand detection active</p>
                </div>
              </div>
            )}
          </div>

          {isVideoMode && uploadedVideoFile && !isVideoPlaying && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="mb-3">
                <h3 className="font-semibold text-blue-800 mb-2">
                  📹 Video Ready
                </h3>
                <p className="text-sm text-gray-700 mb-1">
                  <strong>File:</strong> {uploadedVideoFile.name}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Duration:</strong> {formatTime(videoDuration)}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={playVideo}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  <Icon icon="mdi:play-circle" className="text-2xl" />
                  Start Processing
                </button>
                <button
                  onClick={stopProcessing}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <Icon icon="mdi:close" className="text-xl" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!isVideoMode && (
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={startCamera}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Icon icon="mdi:camera" className="text-xl" />
                Start Camera
              </button>
              <label className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer">
                <Icon icon="mdi:video-plus" className="text-xl" />
                Upload Video
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {isVideoMode && !isVideoPlaying && uploadedVideoFile && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-green-800 mb-1">
                    📹 Camera Feed
                  </h3>
                  <p className="text-sm text-green-600">
                    Hand landmark detection ready
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
            </div>
          )}

          {isVideoMode && isVideoPlaying && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-blue-800 mb-1">
                    📹 Processing Video
                  </h3>
                  <p className="text-sm text-blue-600">
                    {uploadedVideoFile?.name}
                  </p>
                  <p className="text-xs text-blue-500 mt-1">
                    {formatTime(currentTime)} / {formatTime(videoDuration)}
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
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default HandLandMarks;
