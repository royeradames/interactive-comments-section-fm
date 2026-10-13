import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import data from "./data.json";
import { siteName } from "./site";

export const alt = "Interactive Comments Section: Frontend Mentor's comment thread with replies and voting";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const icon = await readFile(join(process.cwd(), "public/icon.svg"));
  const src = `data:image/svg+xml;base64,${icon.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 70, background: "#f5f6fa", color: "#324152" }}>
        <div style={{ fontSize: 48, fontWeight: 700, marginBottom: 36 }}>{siteName}</div>
        <div style={{ display: "flex", gap: 30, padding: 36, background: "#ffffff", borderRadius: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-around", width: 64, background: "#f5f6fa", borderRadius: 12, color: "#5357b6", fontSize: 30 }}><div>+</div><div>12</div><div>−</div></div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 18 }}>
              <img src={src} width={48} height={48} alt="" style={{ borderRadius: 24 }} />
              <div style={{ fontSize: 28, fontWeight: 700 }}>amyrobson</div>
              <div style={{ fontSize: 24, color: "#67727e" }}>1 month ago</div>
            </div>
            <div style={{ fontSize: 26, lineHeight: 1.5, color: "#67727e" }}>{data.comments[0].content}</div>
          </div>
        </div>
        <div style={{ fontSize: 24, color: "#5357b6", marginTop: 32 }}>A Frontend Mentor challenge</div>
      </div>
    ), size,
  );
}
