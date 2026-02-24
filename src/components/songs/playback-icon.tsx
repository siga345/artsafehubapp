type PlaybackIconProps = {
  type: "play" | "pause";
  className?: string;
};

export function PlaybackIcon({ type, className = "" }: PlaybackIconProps) {
  const src = type === "pause" ? "/images/pause.png" : "/images/play.png";
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`block object-contain ${className}`.trim()}
    />
  );
}
