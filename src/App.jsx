import { useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollSmoother, ScrollTrigger } from "gsap/all";
import Input from "./components/common/input";
import Button from "./components/common/button";
import CameraDetection from "./components/card/camera";
import HandLandMarks from "./components/handLandMarks";
import CameraDetections from "./components/camera";
import CameraFeed from "./components/asl/cameraFeed";
// import CameraDetection from "./components/camera";
const App = () => {
  const lines = [
    "YOU MUST BE",
    "THE CHANGE",
    "YOU WISH TO SEE",
    "IN THE WORLD",
  ];
  const [width, setWidth] = useState(100);

  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

  /* -----------------------------
     Text Animation
  ------------------------------ */

  useEffect(() => {
    ScrollSmoother.create({
      wrapper: "#smooth-wrapper",
      content: "#smooth-content",
      smooth: 2,
      effects: true,

      onUpdate: (self) => setWidth(self.progress * 100),
    });
  }, []);

  /* -----------------------------
     Circular Scroll Progress
  ------------------------------ */

  useEffect(() => {
    const circle = document.getElementById("progress-circle");
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    gsap.set(circle, {
      strokeDasharray: circumference,
      strokeDashoffset: circumference,
    });
    const setOffset = gsap.quickSetter(circle, "strokeDashoffset", "px");

    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        setOffset(circumference * (1 - self.progress));
      },
    });
  }, []);

  /* -----------------------------
     Circular Scroll Progress
  ------------------------------ */
  useEffect(() => {
    const tl = gsap.timeline({
      repeat: -1,
      repeatRefresh: true,
      yoyo: true,
    });

    lines.forEach((_, index) => {
      const selector = `.line-${index}`;

      tl.fromTo(
        selector,
        { y: -50, opacity: 0 },
        { y: 0, opacity: 1, duration: 1 },
      ).to(selector, {
        y: 50,
        opacity: 0,
        duration: 1,
        delay: 1,
      });
    });

    return () => tl.kill();
  }, []);
  return (
    <div className="bg-[#fff] h-screen overflow-auto p-32">
      {/* <CameraDetection /> */}

      <CameraFeed />
      {/* <CameraDetections /> */}
    </div>
  );
};

export default App;
