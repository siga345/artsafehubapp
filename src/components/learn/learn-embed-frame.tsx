type LearnEmbedFrameProps = {
  src: string;
  title: string;
  kind: "video" | "article";
};

export function LearnEmbedFrame({ src, title, kind }: LearnEmbedFrameProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-brand-border bg-white shadow-[0_14px_36px_rgba(55,74,61,0.12)]">
      <div className={kind === "video" ? "relative pt-[56.25%]" : "relative min-h-[560px] md:min-h-[720px]"}>
        <iframe
          src={src}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}

