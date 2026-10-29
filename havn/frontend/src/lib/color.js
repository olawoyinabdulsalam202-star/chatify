export function isLightColor(value) {
  if (typeof value !== "string") return false;
  const input = value.trim();
  let channels;

  if (/^#[\da-f]{3}$/i.test(input)) {
    channels = input.slice(1).split("").map((channel) => parseInt(channel + channel, 16));
  } else if (/^#[\da-f]{6}$/i.test(input)) {
    channels = input.slice(1).match(/.{2}/g).map((channel) => parseInt(channel, 16));
  } else {
    const match = input.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!match) return false;
    channels = match.slice(1).map(Number);
  }

  const [red, green, blue] = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue > 0.45;
}
