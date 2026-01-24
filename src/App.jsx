import { useEffect, useState } from "react";

import CameraFeed from "./components/asl/cameraFeed";
import HandLandMarks from "./components/handLandMarks";
import CameraDetection from "./components/card/yourCard";
import HandPoseLandsMarks from "./components/handPoseLandmarks";
// import CameraDetection from "./components/camera";
const App = () => {
  return (
    <div className="bg-[#fff] h-screen overflow-auto p-32">
      <h1>Only Hands</h1>
      <CameraDetection />

      <h1>Hand and pose 225</h1>
      <HandPoseLandsMarks />
      {/* <CameraFeed /> */}
      {/* <HandLandMarks /> */}
    </div>
  );
};

export default App;
