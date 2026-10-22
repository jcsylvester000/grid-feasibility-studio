import { ImageResponse } from "next/og";

export const alt = "GRID Feasibility Studio: sourced property feasibility, in minutes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0e192f 0%, #1c335e 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: 26, letterSpacing: 6, color: "#e2b985" }}>GRID FEASIBILITY STUDIO</div>
        <div style={{ fontSize: 68, lineHeight: 1.1, maxWidth: 950 }}>
          Know if a property deal works before you commit.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 26, color: "#c4d0e4" }}>
          <div style={{ width: 64, height: 6, background: "#be8562" }} />
          Sourced, dated figures for Philippine property
        </div>
      </div>
    ),
    size,
  );
}
