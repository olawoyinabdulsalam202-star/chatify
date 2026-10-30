import Svg, { Path, Circle, Line, Polyline, Rect } from "react-native-svg";

const shapes = {
  back: <Path d="m15 18-6-6 6-6" />,
  search: <><Circle cx="11" cy="11" r="7" /><Path d="m20 20-4-4" /></>,
  settings: <><Circle cx="12" cy="12" r="3" /><Path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 2.94-.09-.03a1.7 1.7 0 0 0-1.82.37l-.08.07h-3.4l-.03-.1a1.7 1.7 0 0 0-1.36-1.28l-.11-.02-2.94-1.7.03-.1a1.7 1.7 0 0 0-.37-1.8l-.07-.08v-3.4l.1-.03a1.7 1.7 0 0 0 1.28-1.36l.02-.11 1.7-2.94.1.03a1.7 1.7 0 0 0 1.8-.37l.08-.07h3.4l.03.1a1.7 1.7 0 0 0 1.36 1.28l.11.02 2.94 1.7-.03.1a1.7 1.7 0 0 0 .37 1.8l.07.08v3.4l-.1.03A1.7 1.7 0 0 0 19.4 15Z" /></>,
  send: <><Path d="m22 2-7 20-4-9-9-4Z" /><Path d="M22 2 11 13" /></>,
  image: <><Rect x="3" y="3" width="18" height="18" rx="3" /><Circle cx="8.5" cy="8.5" r="1.5" /><Path d="m21 15-5-5L5 21" /></>,
  close: <><Path d="m18 6-12 12" /><Path d="m6 6 12 12" /></>,
  eye: <><Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><Circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><Path d="m3 3 18 18" /><Path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><Path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a15.6 15.6 0 0 1-3.1 3.9M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10.7 10.7 0 0 0 4-.8" /></>,
  check: <Path d="m5 12 4 4L19 6" />,
  doubleCheck: <><Path d="m2 12 4 4L16 6" /><Path d="m9 12 4 4 9-10" /></>,
  plus: <><Line x1="12" y1="5" x2="12" y2="19" /><Line x1="5" y1="12" x2="19" y2="12" /></>,
  mic: <><Rect x="9" y="2" width="6" height="12" rx="3" /><Path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></>,
  chevron: <Path d="m9 18 6-6-6-6" />,
  camera: <><Path d="M14 4h-4L8 6H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3l-2-2Z" /><Circle cx="12" cy="13" r="3" /></>,
  monitor: <><Rect x="3" y="4" width="18" height="13" rx="2" /><Path d="M8 21h8m-4-4v4" /></>,
  bell: <><Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  sound: <><Path d="M11 5 6 9H3v6h3l5 4V5Zm4 4a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12" /></>,
  soundOff: <><Path d="M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6" /></>,
  bot: <><Rect x="4" y="7" width="16" height="13" rx="4" /><Path d="M12 3v4m-4 6h.01M16 13h.01M8 17h8" /></>,
  more: <><Circle cx="12" cy="5" r="1" /><Circle cx="12" cy="12" r="1" /><Circle cx="12" cy="19" r="1" /></>,
  trash: <><Path d="M3 6h18M8 6V4h8v2m3 0-.8 14H5.8L5 6m4 4v6m6-6v6" /></>,
  users: <><Circle cx="9" cy="8" r="3" /><Path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v1" /></>,
  heart: <Path d="M20.8 8.8c0 5.1-8.8 11-8.8 11s-8.8-5.9-8.8-11A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.8 2.2Z" />,
  message: <><Path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /></>,
  info: <><Circle cx="12" cy="12" r="10" /><Path d="M12 11v5m0-8h.01" /></>,
  user: <><Circle cx="12" cy="8" r="4" /><Path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
  lock: <><Rect x="4" y="10" width="16" height="11" rx="2" /><Path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  palette: <><Path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 1.3-3.5 1.8 1.8 0 0 1 1.2-3.1H18a3 3 0 0 0 3-3c0-4.6-4-8.4-9-8.4Z" /><Circle cx="7.5" cy="11" r="1" /><Circle cx="10" cy="7.5" r="1" /><Circle cx="15" cy="8" r="1" /></>,
  help: <><Circle cx="12" cy="12" r="10" /><Path d="M9.6 9a2.5 2.5 0 1 1 4.8 1c-.8 1.2-2.4 1.5-2.4 3m0 3h.01" /></>,
  logout: <><Path d="M10 17l5-5-5-5m5 5H3" /><Path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
  phone: <><Rect x="6" y="2" width="12" height="20" rx="2" /><Path d="M11 18h2" /></>,
};

export default function Icon({ name, size = 22, color = "#3A332B", strokeWidth = 1.8 }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">{shapes[name] || shapes.check}</Svg>;
}
