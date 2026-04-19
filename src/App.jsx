import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Papa from 'papaparse'
import { format } from 'date-fns'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import { calculateThreatScore, validateCoordinates } from './utils/scoring'
import { descriptionSuggestions, categories } from './data/suggestions'
import { useNominatimSearch } from './hooks/useNominatimSearch'
import { usePincodeSearch } from './hooks/usePincodeSearch'

const SEVERITY_ICONS = {
  High: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  Medium: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  Low: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })
}

const THREAT_CATEGORIES = categories

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
    }
  })
  return null
}

function App() {
  const [theme, setTheme] = useState('dark')
  const [isAppLoading, setIsAppLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setTimeout(() => setIsAppLoading(false), 800) // Delay to let animation finish
          return 100
        }
        return prev + Math.floor(Math.random() * 5) + 1
      })
    }, 50)
    return () => clearInterval(interval)
  }, [])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const [threats, setThreats] = useState(() => {
    const saved = localStorage.getItem('threats')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return parsed.map(t => ({ ...t, time: new Date(t.time) }))
      } catch (e) {
        console.error('Failed to parse saved threats', e)
      }
    }
    // Default initial data if none saved
    return [
      {
        id: 1,
        threat: 'Cyber Intrusion Detected',
        category: 'Cyber',
        locationName: 'Bangalore Data Center',
        pincode: '560001',
        latitude: '12.9716',
        longitude: '77.5946',
        locationSensitivity: 'Critical',
        severity: 'High',
        frequency: 'Repeated',
        confidence: 'High',
        priorityScore: 18,
        time: new Date(Date.now() - 3600000)
      },
      {
        id: 2,
        threat: 'Unauthorized Border Crossing',
        category: 'Infantry Movement',
        locationName: 'Northern Sector',
        pincode: '190001',
        latitude: '34.0837',
        longitude: '74.7973',
        locationSensitivity: 'Critical',
        severity: 'Medium',
        frequency: 'Single',
        confidence: 'Medium',
        priorityScore: 12,
        time: new Date(Date.now() - 7200000)
      }
    ]
  })

  useEffect(() => {
    localStorage.setItem('threats', JSON.stringify(threats))
  }, [threats])

  const [formData, setFormData] = useState({
    category: THREAT_CATEGORIES[0],
    description: '',
    locationName: '',
    pincode: '',
    latitude: '',
    longitude: '',
    severity: 'Low',
    locationSensitivity: 'Normal',
    frequency: 'Single',
    confidence: 'Low'
  })
  const [mapCenter] = useState([20.5937, 78.9629])
  const [mapZoom] = useState(5)
  const [mapLayer, setMapLayer] = useState('osm')
  const [tempMarker, setTempMarker] = useState(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showPincodeSuggestions, setShowPincodeSuggestions] = useState(false)
  const [nearbyPlaces, setNearbyPlaces] = useState([])
  const [nearbyPlacesLoading, setNearbyPlacesLoading] = useState(false)
  const searchRef = useRef(null)
  const { suggestions, loading, searchLocations, clearSuggestions } = useNominatimSearch()
  const { suggestions: pincodeSuggestions, loading: pincodeLoading, searchByPincode, clearSuggestions: clearPincodeSuggestions } = usePincodeSearch()

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleMapClick = (coords) => {
    setTempMarker(coords)
    setFormData(prev => ({
      ...prev,
      latitude: coords.lat.toFixed(6),
      longitude: coords.lng.toFixed(6)
    }))
  }

  useEffect(() => {
    if (formData.latitude && formData.longitude) {
      const lat = parseFloat(formData.latitude)
      const lng = parseFloat(formData.longitude)
      if (!isNaN(lat) && !isNaN(lng)) {
        // eslint-disable-next-line
        setNearbyPlacesLoading(true)
        fetch(
          `https://nominatim.openstreetmap.org/search?format=json&lat=${lat}&lon=${lng}&radius=5000&limit=8&countrycodes=in`,
          {
            headers: {
              'Accept-Language': 'en',
              'User-Agent': 'ThreatDashboard/1.0'
            }
          }
        )
          .then(res => res.json())
          .then(data => {
            const formatted = data.map(item => ({
              place_id: item.place_id,
              display_name: item.display_name,
              lat: item.lat,
              lon: item.lon,
              type: item.type,
              pincode: item.address?.postcode || ''
            }))
            setNearbyPlaces(formatted)
          })
          .catch(() => setNearbyPlaces([]))
          .finally(() => setNearbyPlacesLoading(false))
      }
    } else {
      setNearbyPlaces([])
    }
  }, [formData.latitude, formData.longitude])

  const handleAddThreat = () => {
    if (!validateCoordinates(formData.latitude, formData.longitude)) {
      alert('Invalid coordinates. Lat: -90 to 90, Lng: -180 to 180')
      return
    }

    const finalThreat = formData.description.trim() || formData.category
    const score = calculateThreatScore(
      formData.severity,
      formData.locationSensitivity,
      formData.frequency,
      formData.confidence
    )

    const threatData = {
      id: Date.now(),
      threat: finalThreat,
      category: formData.category,
      locationName: formData.locationName.trim() || 'Not Specified',
      pincode: formData.pincode,
      latitude: formData.latitude,
      longitude: formData.longitude,
      locationSensitivity: formData.locationSensitivity,
      severity: formData.severity,
      frequency: formData.frequency,
      confidence: formData.confidence,
      priorityScore: score,
      time: new Date()
    }

    setThreats(prev => [...prev, threatData])
    setFormData({
      category: THREAT_CATEGORIES[0],
      description: '',
      locationName: '',
      pincode: '',
      latitude: '',
      longitude: '',
      severity: 'Low',
      locationSensitivity: 'Normal',
      frequency: 'Single',
      confidence: 'Low'
    })
    setTempMarker(null)
  }

  const handleDownloadCSV = () => {
    const csvData = threats.map(t => ({
      Threat: t.threat,
      Category: t.category,
      Location: t.locationName,
      Latitude: t.latitude,
      Longitude: t.longitude,
      Severity: t.severity,
      Frequency: t.frequency,
      Confidence: t.confidence,
      PriorityScore: t.priorityScore,
      Time: format(t.time, 'yyyy-MM-dd HH:mm:ss')
    }))
    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'Threat_Assessment_Report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const sortedThreats = [...threats].sort((a, b) => b.priorityScore - a.priorityScore)
  const topThreat = sortedThreats[0]
  const criticalThreats = threats.filter(t => t.locationSensitivity === 'Critical')
  
  const getSeverityStyle = (severity) => {
    if (severity === 'High') return 'var(--danger-color)'
    if (severity === 'Medium') return 'var(--warning-color)'
    return 'var(--success-color)'
  }

  const timeSeriesData = () => {
    const counts = {}
    threats.forEach(t => {
      const key = format(t.time, 'HH:mm')
      counts[key] = (counts[key] || 0) + 1
    })
    return Object.entries(counts).map(([time, count]) => ({ time, count }))
  }

  const criticalDistribution = () => {
    const counts = {}
    criticalThreats.forEach(t => {
      counts[t.category] = (counts[t.category] || 0) + 1
    })
    return Object.entries(counts).map(([category, count]) => ({ category, count }))
  }

  return (
    <div className={`app ${isAppLoading ? 'app-loading' : 'app-ready'}`}>
      {isAppLoading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-text-container">
              <span className="loading-title">DEFENSE SYSTEM</span>
              <span className="loading-subtitle">INITIALIZING SHIELD PROTOCOLS</span>
            </div>
            <div className="loading-progress-container">
              <div className="loading-progress-bar" style={{ width: `${progress}%` }}></div>
              <span className="loading-percentage">{progress}%</span>
            </div>
          </div>
        </div>
      )}

      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}></div>
        <div style={{ textAlign: 'center' }}>
          <h1>Threat Prioritization System</h1>
          <h4>Defence Decision Support Dashboard</h4>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle Theme">
             {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
             ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
             )}
          </button>
        </div>
      </header>

      <div className="main-content">
        <div className="left-panel">
          <h2>Threat Input Panel</h2>

          <div className="form-group">
            <label>Threat Category</label>
            <select name="category" value={formData.category} onChange={handleInputChange}>
              {THREAT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Threat Description (Optional)</label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Type threat description..."
              list="description-suggestions"
            />
            <datalist id="description-suggestions">
              {descriptionSuggestions.map(desc => <option key={desc} value={desc} />)}
            </datalist>
          </div>

          <div className="form-group">
            <label>Location Name</label>
            <div className="search-container" ref={searchRef}>
              <input
                type="text"
                name="locationName"
                value={formData.locationName}
                onChange={(e) => {
                  handleInputChange(e)
                  if (e.target.value.length >= 2) {
                    searchLocations(e.target.value)
                    setShowSuggestions(true)
                  } else {
                    setShowSuggestions(false)
                  }
                }}
                onFocus={() => formData.locationName.length >= 2 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Search Indian location..."
                autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul 
                  className="search-suggestions"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {loading ? (
                    <li className="loading">Searching...</li>
                  ) : (
                    suggestions.map((s) => (
                      <li
                        key={s.place_id}
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            locationName: s.display_name,
                            latitude: s.lat,
                            longitude: s.lon
                          }))
                          setTempMarker({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) })
                          clearSuggestions()
                          setShowSuggestions(false)
                        }}
                      >
                        <span className="sugg-type">{s.type}</span>
                        <span className="sugg-quadrant">{s.quadrant}</span>
                        {s.pincode && <span className="sugg-pincode">{s.pincode}</span>}
                        <div className="sugg-name">{s.display_name}</div>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>PIN Code</label>
            <div className="search-container" ref={searchRef}>
              <input
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={(e) => {
                  handleInputChange(e)
                  if (e.target.value.length >= 2) {
                    searchByPincode(e.target.value)
                    setShowPincodeSuggestions(true)
                  } else {
                    setShowPincodeSuggestions(false)
                  }
                }}
                onFocus={() => formData.pincode.length >= 2 && setShowPincodeSuggestions(true)}
                onBlur={() => setTimeout(() => setShowPincodeSuggestions(false), 200)}
                placeholder="Enter PIN code..."
                maxLength={6}
                autoComplete="off"
              />
              {showPincodeSuggestions && pincodeSuggestions.length > 0 && (
                <ul 
                  className="search-suggestions"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {pincodeLoading ? (
                    <li className="loading">Searching...</li>
                  ) : (
                    pincodeSuggestions.map((s) => (
                      <li
                        key={s.place_id}
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            pincode: s.pincode,
                            locationName: s.display_name,
                            latitude: s.lat,
                            longitude: s.lon
                          }))
                          setTempMarker({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) })
                          clearPincodeSuggestions()
                          setShowPincodeSuggestions(false)
                        }}
                      >
                        <span className="sugg-type">{s.type}</span>
                        <span className="sugg-quadrant">{s.quadrant}</span>
                        {s.pincode && <span className="sugg-pincode">{s.pincode}</span>}
                        {s.landmark && <span className="sugg-landmark">{s.landmark}</span>}
                        <div className="sugg-name">{s.display_name}</div>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Latitude</label>
              <input
                type="text"
                name="latitude"
                value={formData.latitude}
                onChange={handleInputChange}
                placeholder="e.g. 28.6139"
              />
            </div>
            <div className="form-group">
              <label>Longitude</label>
              <input
                type="text"
                name="longitude"
                value={formData.longitude}
                onChange={handleInputChange}
                placeholder="e.g. 77.2090"
              />
            </div>
          </div>

          <p className="hint">Click on map to auto-fill coordinates</p>

          {(formData.latitude && formData.longitude) && (
            <div className="form-group">
              <label>Nearby Places</label>
              <div className="nearby-places">
                {nearbyPlacesLoading ? (
                  <span className="loading-text">Finding nearby places...</span>
                ) : nearbyPlaces.length > 0 ? (
                  nearbyPlaces.slice(0, 5).map((place, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="nearby-btn"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          locationName: place.display_name,
                          pincode: place.pincode || prev.pincode,
                          latitude: place.lat,
                          longitude: place.lon
                        }))
                        setTempMarker({ lat: parseFloat(place.lat), lng: parseFloat(place.lon) })
                      }}
                    >
                      <span className="nearby-type">{place.type}</span>
                      {place.display_name.split(',')[0]}
                    </button>
                  ))
                ) : (
                  <span className="no-nearby">No nearby places found</span>
                )}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Severity Level</label>
            <select name="severity" value={formData.severity} onChange={handleInputChange}>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          <div className="form-group">
            <label>Location Sensitivity</label>
            <select name="locationSensitivity" value={formData.locationSensitivity} onChange={handleInputChange}>
              <option value="Normal">Normal</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          <div className="form-group">
            <label>Threat Frequency</label>
            <select name="frequency" value={formData.frequency} onChange={handleInputChange}>
              <option value="Single">Single</option>
              <option value="Repeated">Repeated</option>
            </select>
          </div>

          <div className="form-group">
            <label>Intelligence Confidence</label>
            <select name="confidence" value={formData.confidence} onChange={handleInputChange}>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          <button className="btn-primary" onClick={handleAddThreat}>Add Threat</button>

          <div className="map-section">
            <h3>Interactive Map</h3>
            <div className="map-controls">
              <button
                className={mapLayer === 'osm' ? 'active' : ''}
                onClick={() => setMapLayer('osm')}
              >
                Street
              </button>
              <button
                className={mapLayer === 'satellite' ? 'active' : ''}
                onClick={() => setMapLayer('satellite')}
              >
                Satellite
              </button>
              <button
                className={mapLayer === 'terrain' ? 'active' : ''}
                onClick={() => setMapLayer('terrain')}
              >
                Terrain
              </button>
              <button
                className={mapLayer === 'area' ? 'active' : ''}
                onClick={() => setMapLayer('area')}
              >
                Area
              </button>
            </div>
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: '300px', width: '100%', borderRadius: '12px' }}
              whenReady={(map) => {
                map.target.setView(mapCenter, mapZoom)
              }}
            >
              <TileLayer
                url={
                  mapLayer === 'osm'
                    ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                    : mapLayer === 'satellite'
                    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    : mapLayer === 'terrain'
                    ? 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
                    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?style=full'
                }
                attribution={
                  mapLayer === 'osm'
                    ? '&copy; OpenStreetMap contributors'
                    : mapLayer === 'satellite'
                    ? '&copy; Esri'
                    : mapLayer === 'terrain'
                    ? '&copy; OpenTopoMap'
                    : '&copy; OpenStreetMap contributors'
                }
              />
              <MapClickHandler onMapClick={handleMapClick} />
              {tempMarker && (
                <Marker position={[tempMarker.lat, tempMarker.lng]} icon={SEVERITY_ICONS.Medium}>
                  <Popup><b>Selected Location</b></Popup>
                </Marker>
              )}
              {formData.latitude && formData.longitude && nearbyPlaces.slice(0, 5).map((place, idx) => (
                <Marker
                  key={`nearby-${idx}`}
                  position={[parseFloat(place.lat), parseFloat(place.lon)]}
                  icon={SEVERITY_ICONS.Low}
                >
                  <Popup>
                    <b>{place.display_name.split(',')[0]}</b><br />
                    Type: {place.type}<br />
                    {place.pincode && <span>PIN: {place.pincode}</span>}
                  </Popup>
                </Marker>
              ))}
              {sortedThreats.filter(t => t.latitude && t.longitude).map(threat => (
                <Marker
                  key={threat.id}
                  position={[parseFloat(threat.latitude), parseFloat(threat.longitude)]}
                  icon={SEVERITY_ICONS[threat.severity] || SEVERITY_ICONS.Low}
                >
                  <Popup>
                    <strong>{threat.threat}</strong><br />
                    <b>Location:</b> {threat.locationName}<br />
                    {threat.pincode ? <span><b>PIN:</b> {threat.pincode}</span> : null}<br />
                    <b>Severity:</b> {threat.severity}<br />
                    <b>Priority:</b> {threat.priorityScore}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
            <p className="hint">Click on map to set location</p>
          </div>
        </div>

        <div className="right-panel">
          <h2>Threat Assessment Output</h2>

          {threats.length === 0 ? (
            <p className="empty">No threats added yet. Use the input panel to begin assessment.</p>
          ) : (
            <>
              <div className="section">
                <h3>Prioritized Threat List</h3>
                <div className="table-container">
                  <table className="threat-table">
                    <thead>
                      <tr>
                        <th>Threat</th>
                        <th>Location</th>
                        <th>Severity</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedThreats.map(t => (
                        <tr key={t.id}>
                          <td>{t.threat}</td>
                          <td>{t.locationName}</td>
                          <td style={{ color: getSeverityStyle(t.severity), fontWeight: '600' }}>{t.severity}</td>
                          <td style={{ fontWeight: '600' }}>{t.priorityScore}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {topThreat && (
                <div className="section high-priority">
                  <h3>Highest Priority Threat</h3>
                  <div className="alert alert-error">
                    <strong>THREAT:</strong> {topThreat.threat}<br />
                    <strong>LOCATION:</strong> {topThreat.locationName}<br />
                    {topThreat.pincode && (
                      <>
                        <strong>PIN:</strong> {topThreat.pincode}<br />
                      </>
                    )}
                    {topThreat.latitude && topThreat.longitude && (
                      <span><strong>COORDS:</strong> {topThreat.latitude + ", " + topThreat.longitude}</span>
                    )}
                    <strong>SEVERITY:</strong> {topThreat.severity}<br />
                    <strong>PRIORITY SCORE:</strong> {topThreat.priorityScore}
                  </div>
                </div>
              )}

              <div className="section">
                <h3>Threat Activity Over Time</h3>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={timeSeriesData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="var(--accent-color)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="section">
                <h3>Critical Threat Distribution</h3>
                {criticalThreats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={criticalDistribution()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="var(--danger-color)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="empty">No critical threats recorded.</p>
                )}
              </div>

              <div className="section">
                <h3>Immediate Action Required</h3>
                {criticalThreats.filter(t => t.priorityScore >= 15).length > 0 ? (
                  criticalThreats.filter(t => t.priorityScore >= 15).map(t => (
                    <div key={t.id} className="alert alert-error">
                      <strong>THREAT:</strong> {t.threat}<br />
                      <strong>LOCATION:</strong> {t.locationName}<br />
                      <strong>PRIORITY SCORE:</strong> {t.priorityScore}
                    </div>
                  ))
                ) : (
                  <p className="alert alert-success">No immediate action required at this time.</p>
                )}
              </div>

              <div className="section">
                <h3>Generate Threat Report</h3>
                <button className="btn-secondary" onClick={handleDownloadCSV}>
                  Download Threat Assessment Report
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App