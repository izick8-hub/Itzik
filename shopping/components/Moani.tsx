type Pose = "shop" | "notice" | "celebrate" | "rest";
const positions: Record<Pose, string> = {
  shop: "0% 0%",
  notice: "100% 0%",
  celebrate: "0% 100%",
  rest: "100% 100%",
};
export default function Moani({
  pose = "shop",
  className = "",
  decorative = false,
}: {
  pose?: Pose;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <span
      className={`moani-art moani-${pose} ${className}`}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "מואני, הכלבה שלנו"}
      aria-hidden={decorative || undefined}
      style={{
        backgroundImage: `url(${process.env.NEXT_PUBLIC_BASE_PATH || ""}/moani-atlas.png)`,
        backgroundPosition: positions[pose],
      }}
    />
  );
}
