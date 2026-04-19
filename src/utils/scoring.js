export function calculateThreatScore(severity, locationSensitivity, frequency, confidence) {
  let score = 0;

  if (severity === "High") score += 5;
  else if (severity === "Medium") score += 3;
  else score += 1;

  if (locationSensitivity === "Critical") score += 5;
  else score += 2;

  if (frequency === "Repeated") score += 4;
  else score += 1;

  if (confidence === "High") score += 5;
  else if (confidence === "Medium") score += 3;
  else score += 1;

  return score;
}

export function getSeverityColor(severity) {
  switch (severity) {
    case "High": return "#e74c3c";
    case "Medium": return "#f39c12";
    default: return "#27ae60";
  }
}

export function validateCoordinates(lat, lng) {
  if (lat === "" || lng === "") return true;
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  return !isNaN(latNum) && !isNaN(lngNum) && latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180;
}