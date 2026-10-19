import { ImageResponse } from "next/og";

// The link-preview card (WhatsApp, Facebook, Viber...) for every page that
// doesn't set its own — an ad page uses the teacher's photo instead.
// English only: the built-in image font has no Sinhala or Tamil letters.
export const alt = "ClassPortals — find teachers, tuition classes and campus lecturers in Sri Lanka";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #12172a 0%, #1b2333 55%, #2e3a4e 100%)",
          color: "#faf7f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: "#f4e8cc",
              color: "#12172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            CP
          </div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>ClassPortals</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 68, fontWeight: 700, lineHeight: 1.08, maxWidth: 980 }}>
            <span style={{ marginRight: 18 }}>Find the right teacher,</span>
            <span style={{ color: "#c9962c" }}>not just any teacher.</span>
          </div>
          <div style={{ fontSize: 30, color: "rgba(250,247,240,0.75)" }}>
            Teachers · Tuition classes · Schools · Campus lecturers — across Sri Lanka
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 24, color: "#f0dfae" }}>
          <span>Grade 1 — Grade 13 — Campus</span>
          <span style={{ color: "rgba(250,247,240,0.4)" }}>·</span>
          <span>English, Sinhala and Tamil</span>
        </div>
      </div>
    ),
    size,
  );
}
