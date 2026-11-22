import type { AppKey } from "@/lib/nav";

// The apps' icons for the home grid and the bar: flat shapes in a few
// colours, drawn for this app (no icon font, no images to load).
const C = {
  bronze: "#B5643A",
  copper: "#E08A4F",
  sand: "#F2C28B",
  navy: "#1F2A5C",
  blue: "#3B7DDD",
  sky: "#8CC4F2",
  teal: "#16A085",
  mint: "#7FD8C2",
  purple: "#7A4FC0",
  lilac: "#B8A2E8",
  pink: "#E35D8E",
  yellow: "#F4B740",
  red: "#E5484D",
  green: "#2BA66B",
  grey: "#56607A",
};

function Glyph({ app }: { app: AppKey }) {
  switch (app) {
    case "mywork":
      return (
        <>
          <rect x="6" y="10" width="36" height="30" rx="6" fill={C.teal} />
          <path d="M6 28h10l3 5h10l3-5h10v6a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6z" fill={C.navy} />
          <circle cx="24" cy="19" r="8" fill="#fff" />
          <path d="m20 19 3 3 5-6" fill="none" stroke={C.copper} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "manufacturing":
      return (
        <>
          <rect x="31" y="6" width="7" height="16" rx="1.5" fill={C.copper} />
          <path d="M5 40V22l11 7v-7l11 7v-7l15 8v10z" fill={C.navy} />
          <rect x="5" y="38" width="38" height="4" rx="1" fill={C.bronze} />
          <rect x="10" y="31" width="6" height="5" rx="1" fill={C.yellow} />
          <rect x="21" y="31" width="6" height="5" rx="1" fill={C.mint} />
          <rect x="32" y="31" width="6" height="5" rx="1" fill={C.yellow} />
        </>
      );
    case "planning":
      return (
        <>
          <rect x="5" y="8" width="38" height="34" rx="5" fill={C.navy} />
          <rect x="5" y="8" width="38" height="9" rx="5" fill={C.red} />
          <rect x="5" y="13" width="38" height="4" fill={C.red} />
          <rect x="12" y="4" width="4" height="9" rx="2" fill={C.grey} />
          <rect x="32" y="4" width="4" height="9" rx="2" fill={C.grey} />
          <rect x="10" y="21" width="16" height="5" rx="2.5" fill={C.yellow} />
          <rect x="18" y="28" width="18" height="5" rx="2.5" fill={C.mint} />
          <rect x="14" y="35" width="12" height="4" rx="2" fill={C.copper} />
        </>
      );
    case "shopfloor":
      return (
        <>
          <path d="M8 30h28c0 4-4 6-8 6v4h6v3H14v-3h6v-4c-6 0-12-2-12-6z" fill={C.bronze} />
          <rect x="22" y="5" width="18" height="9" rx="2" transform="rotate(35 31 9.5)" fill={C.navy} />
          <rect x="15" y="12" width="4" height="20" rx="2" transform="rotate(35 17 22)" fill={C.copper} />
          <circle cx="38" cy="30" r="2" fill={C.yellow} />
          <circle cx="42" cy="25" r="1.5" fill={C.yellow} />
        </>
      );
    case "kiosk":
      return (
        <>
          <rect x="9" y="5" width="30" height="38" rx="5" fill={C.navy} />
          <rect x="13" y="10" width="22" height="25" rx="2" fill="#fff" />
          <rect x="15" y="12" width="7" height="7" fill={C.teal} />
          <rect x="26" y="12" width="7" height="7" fill={C.teal} />
          <rect x="15" y="26" width="7" height="7" fill={C.teal} />
          <rect x="26" y="26" width="3" height="3" fill={C.copper} />
          <rect x="30" y="30" width="3" height="3" fill={C.copper} />
          <rect x="22" y="21" width="4" height="4" fill={C.copper} />
          <circle cx="24" cy="39" r="1.6" fill={C.sky} />
        </>
      );
    case "quality":
      return (
        <>
          <rect x="7" y="7" width="22" height="22" rx="4" fill={C.blue} />
          <circle cx="27" cy="25" r="11" fill={C.sky} stroke={C.navy} strokeWidth="3.5" />
          <path d="m21.5 25 4 4 7-8" fill="none" stroke={C.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m35 33 7 7" stroke={C.navy} strokeWidth="5" strokeLinecap="round" />
        </>
      );
    case "inventory":
      return (
        <>
          <path d="M24 5 41 14 24 23 7 14z" fill={C.sand} />
          <path d="M7 14v19l17 10V23z" fill={C.bronze} />
          <path d="M41 14v19L24 43V23z" fill={C.copper} />
          <path d="m15.5 9.5 17 9v6l-4 2v-6l-17-9z" fill={C.navy} opacity=".85" />
        </>
      );
    case "overtime":
      return (
        <>
          <circle cx="24" cy="25" r="17" fill={C.purple} />
          <path d="M24 8a17 17 0 0 1 17 17H24z" fill={C.lilac} />
          <circle cx="24" cy="25" r="11" fill="#fff" />
          <path d="M24 17v8l5 4" fill="none" stroke={C.navy} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="20" y="3" width="8" height="4" rx="2" fill={C.pink} />
        </>
      );
    case "reporting":
      return (
        <>
          <rect x="6" y="26" width="9" height="16" rx="2" fill={C.teal} />
          <rect x="19.5" y="16" width="9" height="26" rx="2" fill={C.blue} />
          <rect x="33" y="8" width="9" height="34" rx="2" fill={C.bronze} />
          <path d="M8 20 21 11l9 5 12-10" fill="none" stroke={C.yellow} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "masterdata":
      return (
        <>
          <ellipse cx="24" cy="10" rx="15" ry="5.5" fill={C.sky} />
          <path d="M9 10v9c0 3 6.7 5.5 15 5.5S39 22 39 19v-9c0 3-6.7 5.5-15 5.5S9 13 9 10z" fill={C.blue} />
          <path d="M9 22v9c0 3 6.7 5.5 15 5.5S39 34 39 31v-9c0 3-6.7 5.5-15 5.5S9 25 9 22z" fill={C.navy} />
          <path d="M9 34v5c0 3 6.7 5.5 15 5.5S39 42 39 39v-5c0 3-6.7 5.5-15 5.5S9 37 9 34z" fill={C.bronze} />
        </>
      );
    case "settings":
      return (
        <>
          <path d="M20.6 4h6.8l1 5.2a15 15 0 0 1 4 2.3l5-1.8 3.4 5.9-4 3.5a15 15 0 0 1 0 4.6l4 3.5-3.4 5.9-5-1.8a15 15 0 0 1-4 2.3l-1 5.2h-6.8l-1-5.2a15 15 0 0 1-4-2.3l-5 1.8-3.4-5.9 4-3.5a15 15 0 0 1 0-4.6l-4-3.5 3.4-5.9 5 1.8a15 15 0 0 1 4-2.3z" fill={C.grey} transform="translate(0 2)" />
          <circle cx="24" cy="26" r="8" fill="#fff" />
          <circle cx="24" cy="26" r="4.5" fill={C.bronze} />
        </>
      );
  }
}

/** The app's tile: its glyph on a white card. */
export function AppIcon({ app, size = 56 }: { app: AppKey; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden focusable="false">
      <Glyph app={app} />
    </svg>
  );
}
