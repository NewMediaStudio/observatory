import React from 'react';
import './Timeline.css';

interface TimelineProps {
  dates: string[];
  currentDate: string;
  onDateChange: (date: string) => void;
}

const Timeline: React.FC<TimelineProps> = ({ dates, currentDate, onDateChange }) => {
  return (
    <div className="timeline-container">
      <div className="timeline-scrubber">
        <input
          type="range"
          min={0}
          max={dates.length - 1}
          value={dates.indexOf(currentDate)}
          onChange={(e) => onDateChange(dates[parseInt(e.target.value)])}
          className="timeline-slider"
        />
      </div>
      <div className="timeline-date">
        {new Date(currentDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })}
      </div>
    </div>
  );
};

export default Timeline; 