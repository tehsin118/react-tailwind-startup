import { useEffect, useState } from "react";

import CameraFeed from "./components/asl/cameraFeed";
import HandLandMarks from "./components/handLandMarks";
import CameraDetection from "./components/card/yourCard";
// import CameraDetection from "./components/camera";
const App = () => {
  return (
    <div className="bg-[#fff] h-screen overflow-auto p-32">
      <CameraDetection />

      {/* <CameraFeed /> */}
      {/* <HandLandMarks /> */}
    </div>
  );
};

export default App;
