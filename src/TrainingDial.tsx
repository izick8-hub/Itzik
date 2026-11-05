import React from "react";
import { DAYS } from "./model";
export default function TrainingDial({
  day,
  onChange,
}: {
  day: number;
  onChange: (day: number) => void;
}) {
  return (
    <div
      className="training-dial"
      style={{ "--dial-angle": `${day * 120 - 120}deg` } as React.CSSProperties}
    >
      <div className="dial-bezel">
        <div className="dial-ticks" aria-hidden="true" />
        <div className="dial-needle" aria-hidden="true" />
        <button
          className="dial-hub"
          aria-label="Rotate workout dial"
          onClick={() => onChange((day + 1) % 3)}
        >
          <span>SPLIT</span>
          <strong>0{day + 1}</strong>
          <small>TAP TO ROTATE</small>
        </button>
      </div>
      <input
        type="range"
        min="0"
        max="2"
        step="1"
        value={day}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Choose workout split"
        aria-valuetext={DAYS[day]}
      />
      <div className="dial-stops" aria-hidden="true">
        <span>01</span>
        <span>02</span>
        <span>03</span>
      </div>
    </div>
  );
}
