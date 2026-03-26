export function BuildInfo() {
  const version = process.env.BUILD_VERSION || "0.1.0-alpha";
  const buildDate = process.env.BUILD_DATE
    ? new Date(process.env.BUILD_DATE).toLocaleDateString("de-CH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "–";

  return (
    <div className="fixed bottom-2 right-3 text-[11px] text-gray-400 select-none pointer-events-none z-50">
      <span>v{version}</span>
      <span className="mx-1">·</span>
      <span>Build {buildDate}</span>
    </div>
  );
}
