import { useState, useCallback, useRef } from 'react'

function getQuadrant(lon, lat) {
  const ns = lat >= 23.5 ? 'N' : 'S'
  const ew = lon >= 78.0 ? 'E' : 'W'
  return `${ns}${ew}`
}

export function useNominatimSearch() {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const timeoutRef = useRef(null)

  const searchLocations = useCallback((query) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    
    if (!query || query.length < 2) {
      setSuggestions([])
      return
    }

    timeoutRef.current = setTimeout(async () => {
      setLoading(true)
      
      try {
        let results = []
        const isNumeric = query.match(/^\d+$/)
        
        if (isNumeric && query.length === 6) {
          const postalParams = new URLSearchParams({
            postalcode: query,
            country: 'in',
            format: 'json',
            addressdetails: '1',
            limit: '8'
          })

          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?${postalParams}`,
            {
              headers: {
                'Accept-Language': 'en',
                'User-Agent': 'ThreatDashboard/1.0'
              }
            }
          )

          if (response.ok) {
            const data = await response.json()
            results = data.map(item => ({
              place_id: item.place_id,
              display_name: item.display_name,
              lat: item.lat,
              lon: item.lon,
              type: item.type,
              address: item.address,
              pincode: item.address?.postcode || '',
              landmark: item.address?.suburb || item.address?.village || item.address?.county || '',
              quadrant: getQuadrant(item.lon, item.lat)
            }))
          }
        } else {
          let searchWithIN = query
          if (!isNumeric && !query.toLowerCase().includes('india')) {
            searchWithIN = query + ', India'
          }

          const params = new URLSearchParams({
            q: searchWithIN,
            format: 'json',
            addressdetails: '1',
            limit: '8',
            countrycodes: 'in',
            viewbox: '68.176,6.747;97.403,35.504',
            bounded: '1'
          })

          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?${params}`,
            {
              headers: {
                'Accept-Language': 'en',
                'User-Agent': 'ThreatDashboard/1.0'
              }
            }
          )

          if (response.ok) {
            const data = await response.json()
            results = data.map(item => ({
              place_id: item.place_id,
              display_name: item.display_name,
              lat: item.lat,
              lon: item.lon,
              type: item.type,
              address: item.address,
              pincode: item.address?.postcode || '',
              landmark: item.address?.suburb || item.address?.village || item.address?.county || '',
              quadrant: getQuadrant(item.lon, item.lat)
            }))
          }
        }

        setSuggestions(results.slice(0, 6))
      } catch (error) {
        console.error('Nominatim search error:', error)
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  const clearSuggestions = useCallback(() => {
    setSuggestions([])
  }, [])

  return { suggestions, loading, searchLocations, clearSuggestions }
}