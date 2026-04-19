import { useState, useCallback, useRef } from 'react'

function getQuadrant(lon, lat) {
  const ns = lat >= 23.5 ? 'N' : 'S'
  const ew = lon >= 78.0 ? 'E' : 'W'
  return `${ns}${ew}`
}

export function usePincodeSearch() {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const timeoutRef = useRef(null)

  const searchByPincode = useCallback((query) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    
    const cleanQuery = query.replace(/\D/g, '')
    
    if (!cleanQuery || cleanQuery.length < 2) {
      setSuggestions([])
      return
    }

    timeoutRef.current = setTimeout(async () => {
      setLoading(true)

      try {
        let results = []
        
        if (cleanQuery.length === 6) {
          const postalParams = new URLSearchParams({
            postalcode: cleanQuery,
            country: 'in',
            format: 'json',
            addressdetails: '1',
            limit: '10'
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
              pincode: item.address?.postcode || cleanQuery,
              landmark: item.address?.suburb || item.address?.village || '',
              quadrant: getQuadrant(item.lon, item.lat)
            }))
          }
        } 

        if (results.length === 0) {
          const searchParams = new URLSearchParams({
            q: cleanQuery + ', India',
            format: 'json',
            addressdetails: '1',
            limit: '10',
            countrycodes: 'in',
            viewbox: '68.176,6.747;97.403,35.504',
            bounded: '1'
          })

          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?${searchParams}`,
            {
              headers: {
                'Accept-Language': 'en',
                'User-Agent': 'ThreatDashboard/1.0'
              }
            }
          )

          if (response.ok) {
            const data = await response.json()
            results = data
              .filter(item => {
                const postcode = item.address?.postcode || ''
                return postcode.startsWith(cleanQuery.slice(0, 2)) || cleanQuery.startsWith(postcode.slice(0, 2))
              })
              .map(item => ({
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

        const unique = results.filter((v, i, a) => a.findIndex(t => t.place_id === v.place_id) === i)
        setSuggestions(unique.slice(0, 8))
      } catch (error) {
        console.error('Pincode search error:', error)
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 400)
  }, [])

  const clearSuggestions = useCallback(() => {
    setSuggestions([])
  }, [])

  return { suggestions, loading, searchByPincode, clearSuggestions }
}