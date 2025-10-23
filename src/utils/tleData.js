// Fetch TLEs from CelesTrak
export async function fetchTLEsFromCelesTrak(category = 'stations') {
  const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${category}&FORMAT=tle`;
  
  try {
    const response = await fetch(url);
    const text = await response.text();
    return parseTLEText(text);
  } catch (error) {
    console.error('Error fetching TLEs:', error);
    return [];
  }
}

// Parse TLE text into satellite objects
export function parseTLEText(tleText) {
  const lines = tleText.trim().split('\n');
  const satellites = [];
  
  for (let i = 0; i < lines.length; i += 3) {
    if (i + 2 < lines.length) {
      satellites.push({
        id: parseInt(lines[i + 1].substring(2, 7)),
        name: lines[i].trim(),
        tle1: lines[i + 1].trim(),
        tle2: lines[i + 2].trim(),
        category: 'imported'
      });
    }
  }
  
  return satellites;
}

// Fetch from Space-Track.org (requires authentication)
export async function fetchTLEsFromSpaceTrack(username, password) {
  const loginUrl = 'https://www.space-track.org/ajaxauth/login';
  const queryUrl = 'https://www.space-track.org/basicspacedata/query/class/gp/EPOCH/>now-30/orderby/NORAD_CAT_ID/format/tle';
  
  try {
    // Login
    await fetch(loginUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `identity=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
    });
    
    // Fetch TLEs
    const response = await fetch(queryUrl, {
      credentials: 'include'
    });
    
    const text = await response.text();
    return parseTLEText(text);
  } catch (error) {
    console.error('Error fetching from Space-Track:', error);
    return [];
  }
}