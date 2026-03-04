import Image from "next/image";

type PlaybackIconProps = {
  type: "play" | "pause";
  className?: string;
};

export function PlaybackIcon({ type, className = "" }: PlaybackIconProps) {
  const src = type === "pause" ? "/images/pause.png" : "/images/play.png";
  return (
    <Image
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      width={20}
      height={20}
      className={`block object-contain ${className}`.trim()}
    />
  );
}
