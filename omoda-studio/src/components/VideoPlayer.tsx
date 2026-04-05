import React from 'react';

interface VideoPlayerProps {
  videoUrl: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl }) => {
  return (
    <div className="aspect-video max-w-2xl mx-auto rounded-xl overflow-hidden shadow-elevated bg-foreground/5">
      <video
        src={videoUrl}
        controls
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
};
