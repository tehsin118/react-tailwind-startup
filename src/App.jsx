import { useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollSmoother, ScrollTrigger } from "gsap/all";
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
        { y: 0, opacity: 1, duration: 1 }
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
    <>
      <div
        className="fixed top-0 left-0 bg-blue-700 h-2 z-50"
        style={{ width: ` ${width}% ` }}
      />

      <div className="fixed top-4 left-4 z-50 w-20 h-20">
        <svg className="w-full h-full -rotate-90">
          {/* Background */}
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="#000"
            strokeWidth="4"
            fill="transparent"
          />

          {/* Progress */}
          <circle
            id="progress-circle"
            cx="40"
            cy="40"
            r="36"
            stroke="#CA8A04"
            strokeWidth="4"
            fill="transparent"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div id="smooth-wrapper">
        <div id="smooth-content">
          <div className="h-screen bg-gray-200">
            <div className="flex flex-col items-center gap-10 pt-36">
              <div className="flex flex-col items-center gap-4">
                <h1 className="text-3xl text-black py-1 w-fit  font-inter bg-yellow-700 leading-[100%] tracking-[-1.2px] font-bold relative">
                  Find homes by{" "}
                  {lines.map((text, index) => (
                    <p
                      key={index}
                      className={`line-${index} absolute opacity-100 inline w-2xl`}
                    >
                      {text}
                    </p>
                  ))}
                </h1>
                <h6 className="text-black font-inter leading-[100%]">
                  Your AI-powered way to find homes with the features that
                  matter.
                </h6>
              </div>
            </div>
          </div>

          <div className="h-screen bg-red-200"></div>
          <div className="h-screen bg-red-300">
            <div className="shape w-44 h-44 bg-amber-300 absolute left-1/2 will-change-transform"></div>
          </div>
          <div className="h-screen bg-red-400"></div>
          <div className="h-screen bg-red-500"></div>
          <div className="h-screen bg-red-700"></div>
        </div>
      </div>
    </>
  );
};

export default App;
