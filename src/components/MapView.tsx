import { useState, useEffect, useRef, useCallback } from 'react'
import HighCommandAPI from '../services/api'
import './MapView.css'

interface Event {
  id?: string
  eventType?: number
  faction?: string
  health?: number
  maxHealth?: number
  startTime?: string
  endTime?: string
  campaignId?: string
  jointOperationIds?: string[]
  [key: string]: any
}

interface Planet {
  name: string
  index: number
  status?: string
  health?: number
  maxHealth?: number
  currentOwner?: string
  owner?: string
  biomeType?: string
  event?: Event
  [key: string]: any
}

interface MapViewProps {
  warStatus: any
}

const MapView: React.FC<MapViewProps> = ({ warStatus }) => {
  
  const [planets, setPlanets] = useState<Planet[]>([])  // Start empty, show loading animation
  const [selectedPlanet, setSelectedPlanet] = useState<Planet | null>(null)
  const [rotation, setRotation] = useState(0)
  const [isLoading, setIsLoading] = useState(true)  // Track loading state
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([])
  
  // Generate stars once on component mount
  const [stars] = useState(() => {
    return [...Array(100)].map(() => ({
      x: Math.random() * 1000,
      y: Math.random() * 1000,
      size: Math.random() * 1.5,
      opacity: Math.random() * 0.6 + 0.4
    }))
  })
  
  // viewBox state for SVG zoom/pan: x, y, width, height
  // With planets spread across ±2000 from center (2000, 2000):
  // - All planets fit in range roughly -2100 to 4100 for both X and Y
  // - Massive viewBox for maximum planet separation
  const [viewBox, setViewBox] = useState({ x: -2100, y: -2100, w: 6200, h: 6200 })
  const svgRef = useRef<SVGSVGElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const isPanning = useRef(false)
  const lastPointer = useRef<{ x: number; y: number } | null>(null)
  const animRef = useRef<number | null>(null)

  // Fetch planets from API on mount
  const loadPlanets = useCallback(async () => {
    setIsRefreshing(true)
    
    if (warStatus?.planets && warStatus.planets.length > 0) {
      // Use warStatus planets if available
      setPlanets(warStatus.planets)
      setLastRefresh(new Date())
      setIsRefreshing(false)
      return
    }
    
    // Try to fetch from planets API endpoint
    try {
      const data = await HighCommandAPI.getPlanets()
      
      if (!data) {
        setIsLoading(false)
        setIsRefreshing(false)
        return
      }
      
      let planetsArray: any[] = []
      
      // Check if data is directly an array
      if (Array.isArray(data)) {
        planetsArray = data
      } 
      // Check if data has planets property
      else if (data?.planets && Array.isArray(data.planets)) {
        planetsArray = data.planets
      }
      // Check if data has other array properties
      else if (data?.result && Array.isArray(data.result)) {
        planetsArray = data.result
      }
      else {
        setIsLoading(false)
        setIsRefreshing(false)
        return
      }
      
      if (planetsArray.length > 0) {
        // Scale normalized coordinates (-0.93 to 0.93) to SVG space (relative to 2000, 2000)
        // Map -0.93 to -2000 and 0.93 to 2000, giving us range of ±2000 around center (maximum spread)
        // Invert Y axis so that positive Y values go up instead of down
        const scaledPlanets = planetsArray.map(planet => ({
          ...planet,
          position: planet.position ? {
            x: (planet.position.x || 0) * 2000,  // Scale from normalized [-0.93, 0.93] to [-2000, 2000]
            y: -(planet.position.y || 0) * 2000   // Negate Y so up is up
          } : undefined
        }))
        
        setPlanets(scaledPlanets)
        setIsLoading(false)
        setLastRefresh(new Date())
        setIsRefreshing(false)
      } else {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    } catch (error) {
      console.error('Failed to fetch planets:', error)
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [warStatus?.planets])

  // Load active campaigns
  const loadCampaigns = useCallback(async () => {
    try {
      const data = await HighCommandAPI.getActiveCampaigns()
      if (data) {
        let campaignsArray: any[] = []
        
        // Handle different response formats
        if (Array.isArray(data)) {
          campaignsArray = data
        } else if (data?.campaigns && Array.isArray(data.campaigns)) {
          campaignsArray = data.campaigns
        } else if (data?.result && Array.isArray(data.result)) {
          campaignsArray = data.result
        }
        
        setActiveCampaigns(campaignsArray)
      }
    } catch (error) {
      console.error('Failed to fetch active campaigns:', error)
    }
  }, [])

  useEffect(() => {
    loadPlanets()
    loadCampaigns()
    // Auto-refresh every hour (3600000 ms)
    const interval = setInterval(() => {
      loadPlanets()
      loadCampaigns()
    }, 3600000)
    return () => clearInterval(interval)
  }, [loadPlanets, loadCampaigns])

  // Rotate the star field slowly
  useEffect(() => {
    const interval = setInterval(() => {
      setRotation(prev => (prev + 0.01) % 360)
    }, 50)
    return () => clearInterval(interval)
  }, [])

  const getPlanetStatus = (planet: any) => {
    // Use owner field directly for faction colors
    if (planet.owner === 'Humans') return 'liberated'
    if (planet.owner === 'Terminids') return 'under-siege'
    if (planet.owner === 'Automaton' || planet.owner === 'Automatons') return 'contested-automaton'
    if (planet.owner === 'Illuminate') return 'contested-illuminate'
    
    // Fallback to currentOwner if owner not available
    if (planet.currentOwner === 'Humans') return 'liberated'
    if (planet.currentOwner === 'Terminids') return 'under-siege'
    if (planet.currentOwner === 'Automaton' || planet.currentOwner === 'Automatons') return 'contested-automaton'
    if (planet.currentOwner === 'Illuminate') return 'contested-illuminate'
    
    // Debug: log neutral planets to see their structure
    if (!planet.owner && !planet.currentOwner) {
      console.log('Neutral planet:', { name: planet.name, owner: planet.owner, currentOwner: planet.currentOwner, faction: planet.faction, controllingFaction: planet.controllingFaction, keys: Object.keys(planet).slice(0, 10) })
    }
    
    return 'neutral'
  }

  const getPlanetCampaign = (planet: any) => {
    if (!activeCampaigns || activeCampaigns.length === 0) return null
    return activeCampaigns.find((campaign: any) => campaign.planet?.index === planet.index)
  }

  const getCampaignEmoji = (campaign: any) => {
    if (!campaign) return null
    
    // Use event faction if available, otherwise use planet's currentOwner (attacking faction)
    const faction = campaign.planet?.event?.faction || campaign.planet?.currentOwner
    const factionEmojis: Record<string, string> = {
      'Terminids': '🐛',
      'Automaton': '🤖',
      'Automatons': '🤖',
      'Illuminate': '👁️',
      'Humans': '👨'  // Fallback for Humans
    }
    
    return factionEmojis[faction ?? ''] || '⭐'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'liberated':
        return '#00ff00'  // Bright green for defended/liberated
      case 'under-siege':
        return '#ffff00'  // Yellow for Terminids/under siege
      case 'contested-automaton':
        return '#ff0000'  // Red for Automatons
      case 'contested-illuminate':
        return '#9933ff'  // Purple for Illuminate
      default:
        return '#999999'
    }
  }

  const getEventColor = (event: Event | null | undefined) => {
    if (!event) return null
    
    // Map event factions to colors using object map
    const factionColors: Record<string, string> = {
      'Terminids': '#ff69b4',      // Hot pink for Terminids
      'Automaton': '#ff1493',       // Deep pink for Automatons
      'Automatons': '#ff1493',      // Deep pink for Automatons
      'Illuminate': '#ff69b4'       // Hot pink for Illuminate
    }
    
    const color = factionColors[event.faction ?? '']
    if (!color) {
      console.warn('Unknown event faction:', event.faction)
      return '#ff69b4'  // Hot pink fallback
    }
    return color
  }

  const getFactionEmoji = (event: Event | null | undefined) => {
    if (!event) return null
    
    // Map event factions to emojis using object map
    const factionEmojis: Record<string, string> = {
      'Terminids': '🐛',           // Bug for Terminids
      'Automaton': '🤖',            // Robot for Automatons
      'Automatons': '🤖',           // Robot for Automatons
      'Illuminate': '👁️'           // Eye for Illuminate
    }
    
    return factionEmojis[event.faction ?? ''] ?? '⚠️'
  }

  const getEventTypeEmoji = (event: Event | null | undefined) => {
    if (!event) return null
    
    // Map event types to emojis using object map
    const eventTypeEmojis: Record<number, string> = {
      1: '⚔️',  // Swords for ATTACK
      2: '🛡️',  // Shield for DEFENSE
      3: '💣'   // Bomb for SABOTAGE
    }
    
    return eventTypeEmojis[event.eventType ?? -1] ?? '⚠️'
  }

  // Calculate position based on actual position data or use optimal circular layout as fallback
  const getPlanetPosition = (planet: Planet, index: number, total: number) => {
    // If planet has position data, use it directly (coordinates come from API or mock data)
    if (planet.position && typeof planet.position === 'object') {
      const x = typeof planet.position.x === 'number' ? planet.position.x : 0
      const y = typeof planet.position.y === 'number' ? planet.position.y : 0
      return { x, y }
    }

    // Fallback: arrange in optimal circular orbits by distance
    // Inner ring (planets 0-2): radius 140, outer ring (planets 3+): radius 280
    if (total <= 3) {
      // Small set: use inner ring only
      const radius = 140
      const angle = (index / total) * Math.PI * 2
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      return { x, y }
    } else if (index < Math.ceil(total / 2)) {
      // First half: inner ring
      const radius = 160
      const angle = (index / Math.ceil(total / 2)) * Math.PI * 2
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      return { x, y }
    } else {
      // Second half: outer ring
      const radius = 280
      const relIndex = index - Math.ceil(total / 2)
      const count = total - Math.ceil(total / 2)
      const angle = (relIndex / count) * Math.PI * 2 + Math.PI / count // offset to avoid alignment with inner
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      return { x, y }
    }
  }

  // Get unique sectors for visualization
  const getSectorInfo = () => {
    const sectorMap: { [key: string]: Planet[] } = {}
    
    planets.forEach((planet: Planet) => {
      const sector = planet.section || planet.sector || 'UNKNOWN'
      if (!sectorMap[sector]) {
        sectorMap[sector] = []
      }
      sectorMap[sector].push(planet)
    })
    
    return sectorMap
  }

  const sectorMap = getSectorInfo()

  // Smoothly animate viewBox from current to target over duration (ms)
  const animateViewBox = (target: { x: number; y: number; w: number; h: number }, duration = 300) => {
    const start = { ...viewBox }
    const startTime = performance.now()
    if (animRef.current) cancelAnimationFrame(animRef.current)

    const step = (t: number) => {
      const p = Math.min(1, (t - startTime) / duration)
      const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p // easeInOutQuad-ish
      const next = {
        x: start.x + (target.x - start.x) * ease,
        y: start.y + (target.y - start.y) * ease,
        w: start.w + (target.w - start.w) * ease,
        h: start.h + (target.h - start.h) * ease
      }
      setViewBox(next)
      if (p < 1) animRef.current = requestAnimationFrame(step)
      else animRef.current = null
    }

    animRef.current = requestAnimationFrame(step)
  }

  // Convert client coords to SVG coords based on current viewBox and svg size
  const clientToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 400, y: 400 }
    const rect = svg.getBoundingClientRect()
    const svgX = ((clientX - rect.left) / rect.width) * viewBox.w + viewBox.x
    const svgY = ((clientY - rect.top) / rect.height) * viewBox.h + viewBox.y
    return { x: svgX, y: svgY }
  }

  // Wheel zoom centered on cursor
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY
    const zoomFactor = delta > 0 ? 1.12 : 1 / 1.12
    const svgPos = clientToSvg(e.clientX, e.clientY)
    setViewBox(b => {
      const newW = Math.max(200, Math.min(4000, b.w * zoomFactor))
      const newH = Math.max(200, Math.min(4000, b.h * zoomFactor))
      // keep svgPos at same visual point: compute new x/y so that svgPos maps to same client coords
      const nx = svgPos.x - ((svgPos.x - b.x) * (newW / b.w))
      const ny = svgPos.y - ((svgPos.y - b.y) * (newH / b.h))
      return { x: nx, y: ny, w: newW, h: newH }
    })
  }

  // Pointer handlers for panning
  const onPointerDown = (e: PointerEvent) => {
    isPanning.current = true
    lastPointer.current = { x: e.clientX, y: e.clientY }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!isPanning.current || !lastPointer.current) return
    const dx = e.clientX - lastPointer.current.x
    const dy = e.clientY - lastPointer.current.y
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    // translate pixels to viewBox units
    const vx = (dx / rect.width) * viewBox.w
    const vy = (dy / rect.height) * viewBox.h
    setViewBox(b => ({ x: b.x - vx, y: b.y - vy, w: b.w, h: b.h }))
    lastPointer.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerUp = (e: PointerEvent) => {
    isPanning.current = false
    lastPointer.current = null
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
  }

  // Attach wheel and pointer events to container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const wheelHandler = (e: Event) => onWheel(e as WheelEvent)
    const pd = (e: Event) => onPointerDown(e as PointerEvent)
    const pm = (e: Event) => onPointerMove(e as PointerEvent)
    const pu = (e: Event) => onPointerUp(e as PointerEvent)
    container.addEventListener('wheel', wheelHandler, { passive: false })
    container.addEventListener('pointerdown', pd)
    window.addEventListener('pointermove', pm)
    window.addEventListener('pointerup', pu)
    return () => {
      container.removeEventListener('wheel', wheelHandler)
      container.removeEventListener('pointerdown', pd)
      window.removeEventListener('pointermove', pm)
      window.removeEventListener('pointerup', pu)
    }
  }, [viewBox])

  return (
    <div className="map-view">
      <div className="map-header">
        <h2>🌍 GALACTIC MAP</h2>
        <div className="map-header-right">
          <p className="last-refresh">Last refreshed: {lastRefresh.toLocaleTimeString()}</p>
          <button 
            className="refresh-button" 
            onClick={loadPlanets} 
            disabled={isRefreshing}
            title="Manually refresh galactic map"
          >
            {isRefreshing ? '⟳ Refreshing...' : '⟳ Refresh'}
          </button>
        </div>
      </div>
      <div className="map-container" ref={containerRef}>
        {/* Zoom Controls (viewBox-based) */}
        <div className="zoom-controls">
          <button
            className="zoom-btn"
            onClick={() => {
              // zoom out: increase viewBox size (animated)
              const factor = 1.25
              const newW = Math.min(4000, viewBox.w * factor)
              const newH = Math.min(4000, viewBox.h * factor)
              const nx = viewBox.x - (newW - viewBox.w) / 2
              const ny = viewBox.y - (newH - viewBox.h) / 2
              animateViewBox({ x: nx, y: ny, w: newW, h: newH }, 260)
            }}
            title="Zoom Out"
          >
            −
          </button>
          <span className="zoom-level">{Math.round((800 / viewBox.w) * 100)}%</span>
          <button
            className="zoom-btn"
            onClick={() => {
              // zoom in: decrease viewBox size (animated)
              const factor = 1 / 1.25
              const newW = Math.max(200, viewBox.w * factor)
              const newH = Math.max(200, viewBox.h * factor)
              const nx = viewBox.x + (viewBox.w - newW) / 2
              const ny = viewBox.y + (viewBox.h - newH) / 2
              animateViewBox({ x: nx, y: ny, w: newW, h: newH }, 200)
            }}
            title="Zoom In"
          >
            +
          </button>
          <button
            className="zoom-btn reset"
            onClick={() => {
              // reset to default centered view (animated)
              animateViewBox({ x: -250, y: -250, w: 1300, h: 1300 }, 360)
            }}
            title="Reset Zoom"
          >
            ⊙
          </button>
        </div>

        {/* Loading animation */}
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>INITIALIZING GALACTIC MAP...</p>
            </div>
          </div>
        )}
        
        {/* Starfield background */}
        <svg
          className="starfield"
          style={{
            transform: `rotate(${rotation}deg)`
          }}
        >
          {stars.map((star, i) => (
            <circle
              key={`star-${i}`}
              cx={star.x}
              cy={star.y}
              r={star.size}
              fill="#66ff00"
              opacity={star.opacity}
            />
          ))}
        </svg>

        {/* SVG orbital paths */}
  <svg ref={svgRef} className="orbital-map" viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}>
          {/* Orbital rings - visual guides for the galactic map */}
          <circle cx="400" cy="400" r="160" fill="none" stroke="rgba(255, 231, 16, 0.04)" strokeWidth="1" strokeDasharray="4,4" />
          <circle cx="400" cy="400" r="280" fill="none" stroke="rgba(255, 231, 16, 0.05)" strokeWidth="1" strokeDasharray="4,4" />
          <circle cx="400" cy="400" r="750" fill="none" stroke="rgba(255, 231, 16, 0.1)" strokeWidth="1.5" />

          {/* Sector connecting lines - draw lines between planets in same sector - HIDDEN */}
          {false && planets && planets.length > 1 && (
            <g opacity="0.15">
              {Object.entries(sectorMap).map(([sector, sectorPlanets]: [string, any]) => 
                sectorPlanets.length > 1 ? (
                  sectorPlanets.map((planet: Planet, i: number) => {
                    const nextPlanet = sectorPlanets[(i + 1) % sectorPlanets.length]
                    const pos1 = getPlanetPosition(planet, 0, planets.length)
                    const pos2 = getPlanetPosition(nextPlanet, 0, planets.length)
                    return (
                      <line
                        key={`sector-line-${sector}-${i}`}
                        x1={400 + pos1.x}
                        y1={400 + pos1.y}
                        x2={400 + pos2.x}
                        y2={400 + pos2.y}
                        stroke="rgba(64, 145, 108, 0.3)"
                        strokeWidth="0.5"
                        strokeDasharray="5,5"
                      />
                    )
                  })
                ) : null
              )}
            </g>
          )}

          {/* Debug: Coordinate crosshairs at Super Earth center - HIDDEN */}
          {false && (
          <g opacity="0.3" stroke="rgba(255, 231, 16, 0.5)" strokeWidth="1">
            <line x1="350" y1="400" x2="450" y2="400" />
            <line x1="400" y1="350" x2="400" y2="450" />
            <circle cx="400" cy="400" r="2" fill="rgba(255, 231, 16, 1)" />
            <text x="410" y="395" fill="rgba(255, 231, 16, 0.7)" fontSize="10">(400, 400)</text>
          </g>
          )}

          {/* Connection lines to Super Earth from far planets - HIDDEN */}
          {false && planets && (
            <g opacity="0.1">
              {planets.map((planet: Planet, idx: number) => {
                const pos = getPlanetPosition(planet, idx, planets.length)
                const distance = Math.sqrt(pos.x * pos.x + pos.y * pos.y)
                // Only draw lines for planets far from center
                if (distance > 150) {
                  return (
                    <line
                      key={`branch-${idx}`}
                      x1="400"
                      y1="400"
                      x2={400 + pos.x}
                      y2={400 + pos.y}
                      stroke="rgba(255, 231, 16, 0.2)"
                      strokeWidth="0.8"
                    />
                  )
                }
                return null
              })}
            </g>
          )}

          {/* Planet positions */}
          {planets && planets.map((planet: Planet, idx: number) => {
            const pos = getPlanetPosition(planet, idx, planets.length)
            const status = getPlanetStatus(planet)
            const campaign = getPlanetCampaign(planet)
            
            // Use event color (priority), then status color (campaigns use pulsing effect instead)
            let color: string
            if (planet.event) {
              const eventColor = getEventColor(planet.event)
              color = eventColor || getStatusColor(status)
            } else {
              color = getStatusColor(status)
            }
            
            const isSelected = selectedPlanet?.index === planet.index
            
            // Determine stroke color: selected = yellow, normal = faint white
            let strokeColor = 'rgba(255, 255, 255, 0.3)'
            let strokeWidth = 1
            if (isSelected) {
              strokeColor = '#ffff00'  // Yellow for selected
              strokeWidth = 3
            }
            
            // Get pulse color from campaign faction
            const campaignPulseColor = campaign && campaign.planet?.event?.faction 
              ? getEventColor(campaign.planet.event)
              : null

            return (
              <g key={planet.index || idx}>
                {/* Glow effect */}
                <circle
                  cx={400 + pos.x}
                  cy={400 + pos.y}
                  r="28"
                  fill={color}
                  opacity="0.2"
                  className="planet-glow"
                />

                {/* Campaign pulse effect - animated ring for planets with active campaigns */}
                {campaign && campaignPulseColor && (
                  <circle
                    cx={400 + pos.x}
                    cy={400 + pos.y}
                    r="20"
                    fill="none"
                    stroke={campaignPulseColor}
                    strokeWidth="2"
                    opacity="0.6"
                    className="planet-campaign-pulse"
                  />
                )}

                {/* Planet */}
                <circle
                  cx={400 + pos.x}
                  cy={400 + pos.y}
                  r={isSelected ? 18 : 16}
                  fill={color}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                  onClick={() => setSelectedPlanet(planet)}
                  className={`${isSelected ? 'planet-selected' : ''} ${planet.event ? 'planet-event' : ''} ${campaign ? 'planet-campaign' : ''}`}
                />

                {/* Planet label */}
                <text
                  x={400 + pos.x}
                  y={400 + pos.y + 30}
                  textAnchor="middle"
                  fill="#e0e0e0"
                  fontSize="12"
                  fontFamily="'Courier New', monospace"
                  fontWeight="bold"
                  className="planet-label"
                  onClick={() => setSelectedPlanet(planet)}
                  style={{ cursor: 'pointer' }}
                >
                  {planet.name}
                </text>

                {/* Campaign emoji indicator - top right when campaign active (no event) */}
                {campaign && !planet.event && (
                  <text
                    x={400 + pos.x + 35}
                    y={400 + pos.y - 35}
                    textAnchor="middle"
                    fontSize="16"
                    className="planet-campaign-emoji"
                    style={{ cursor: 'pointer', pointerEvents: 'none' }}
                  >
                    {getCampaignEmoji(campaign)}
                  </text>
                )}

                {/* Event emoji indicator - faction (top left, takes priority) */}
                {planet.event && (
                  <text
                    x={400 + pos.x - 35}
                    y={400 + pos.y - 35}
                    textAnchor="middle"
                    fontSize="16"
                    className="planet-event-emoji"
                    style={{ cursor: 'pointer', pointerEvents: 'none' }}
                  >
                    {getFactionEmoji(planet.event)}
                  </text>
                )}

                {/* Event emoji indicator - event type (top right) */}
                {planet.event && (
                  <text
                    x={400 + pos.x + 35}
                    y={400 + pos.y - 35}
                    textAnchor="middle"
                    fontSize="16"
                    className="planet-event-emoji"
                    style={{ cursor: 'pointer', pointerEvents: 'none' }}
                  >
                    {getEventTypeEmoji(planet.event)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Planet details panel - popup */}
      <div 
        className={`map-details ${selectedPlanet ? 'active' : ''}`}
        style={selectedPlanet ? {
          left: `${(window.innerWidth / 2) + 100}px`,
          top: `${(window.innerHeight / 2) - 100}px`
        } : {}}
      >
        {selectedPlanet ? (
          <div className="planet-details">
            <div className="details-header">
              <h3>{selectedPlanet.name}</h3>
              <button
                className="close-btn"
                onClick={() => setSelectedPlanet(null)}
              >
                ✕
              </button>
            </div>

            <div className="details-content">
              <div className="detail-row">
                <span className="detail-label">STATUS:</span>
                <span
                  className="detail-value status-badge"
                  style={{ color: getStatusColor(getPlanetStatus(selectedPlanet)) }}
                >
                  {selectedPlanet.currentOwner || 'UNKNOWN'}
                </span>
              </div>

              {selectedPlanet.index !== undefined && (
                <div className="detail-row">
                  <span className="detail-label">INDEX:</span>
                  <span className="detail-value">#{selectedPlanet.index}</span>
                </div>
              )}

              {selectedPlanet.sector && (
                <div className="detail-row">
                  <span className="detail-label">SECTOR:</span>
                  <span className="detail-value">{selectedPlanet.sector}</span>
                </div>
              )}

              {selectedPlanet.biome?.name && (
                <div className="detail-row">
                  <span className="detail-label">BIOME:</span>
                  <span className="detail-value">{selectedPlanet.biome.name}</span>
                </div>
              )}

              {selectedPlanet.hazards && selectedPlanet.hazards.length > 0 && (
                <div className="detail-row">
                  <span className="detail-label">HAZARDS:</span>
                  <span className="detail-value">
                    {selectedPlanet.hazards.map((h: any) => h.name).join(', ')}
                  </span>
                </div>
              )}

              {selectedPlanet.position && (
                <div className="detail-row">
                  <span className="detail-label">POSITION:</span>
                  <span className="detail-value">
                    {typeof selectedPlanet.position === 'object'
                      ? `(${selectedPlanet.position.x || 0}, ${selectedPlanet.position.y || 0})`
                      : selectedPlanet.position}
                  </span>
                </div>
              )}

              {/* Show related planets in same sector */}
              {selectedPlanet.section && sectorMap[selectedPlanet.section] && sectorMap[selectedPlanet.section].length > 1 && (
                <div className="detail-row related-planets">
                  <span className="detail-label">SECTOR ALLIES:</span>
                  <span className="detail-value">
                    {sectorMap[selectedPlanet.section]
                      .filter((p: Planet) => p.index !== selectedPlanet.index)
                      .map((p: Planet) => p.name)
                      .join(', ')}
                  </span>
                </div>
              )}

              {selectedPlanet.health !== undefined && selectedPlanet.maxHealth && (
                <div className="detail-row">
                  <span className="detail-label">HEALTH:</span>
                  <div className="health-bar-small">
                    <div
                      className="health-fill"
                      style={{
                        width: `${(selectedPlanet.health / selectedPlanet.maxHealth) * 100}%`,
                        backgroundColor: getStatusColor(getPlanetStatus(selectedPlanet))
                      }}
                    ></div>
                  </div>
                  <span className="detail-value">
                    {selectedPlanet.health.toLocaleString()} / {selectedPlanet.maxHealth.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Display active event if present */}
              {selectedPlanet.event && (
                <div className="detail-row event-info">
                  <span className="detail-label">🔴 ACTIVE EVENT:</span>
                  <div className="event-details">
                    {selectedPlanet.event.id && (
                      <div className="event-detail">
                        <span className="event-label">MISSION CODE:</span>
                        <span className="event-value">{selectedPlanet.event.id}</span>
                      </div>
                    )}
                    <div className="event-detail">
                      <span className="event-label">FACTION:</span>
                      <span className="event-value">{selectedPlanet.event.faction}</span>
                    </div>
                    <div className="event-detail">
                      <span className="event-label">TYPE:</span>
                      <span className="event-value">
                        {selectedPlanet.event.eventType === 1 ? 'ATTACK' : 
                         selectedPlanet.event.eventType === 2 ? 'DEFENSE' :
                         selectedPlanet.event.eventType === 3 ? 'SABOTAGE' :
                         `TYPE ${selectedPlanet.event.eventType}`}
                      </span>
                    </div>
                    {selectedPlanet.event.health !== undefined && selectedPlanet.event.maxHealth && (
                      <div className="event-detail">
                        <span className="event-label">PROGRESS:</span>
                        <div className="event-health-bar">
                          <div
                            className="event-health-fill"
                            style={{
                              width: `${(selectedPlanet.event.health / selectedPlanet.event.maxHealth) * 100}%`,
                              backgroundColor: getEventColor(selectedPlanet.event) || '#ff00ff'
                            }}
                          ></div>
                        </div>
                        <span className="event-value">
                          {selectedPlanet.event.health.toLocaleString()} / {selectedPlanet.event.maxHealth.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {selectedPlanet.event.endTime && (
                      <div className="event-detail">
                        <span className="event-label">ENDS:</span>
                        <span className="event-value">
                          {new Date(selectedPlanet.event.endTime).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Show active campaign for this planet (after events - events take priority) */}
              {(() => {
                const activeCampaign = activeCampaigns?.find((campaign: any) => campaign.planet?.index === selectedPlanet.index)
                
                const getEventTypeEmoji = (eventType: number) => {
                  switch(eventType) {
                    case 1: return '⚔️'  // ATTACK
                    case 2: return '🛡️'  // DEFENSE
                    case 3: return '💣'  // SABOTAGE
                    default: return '❓'
                  }
                }
                
                const getEventTypeLabel = (eventType: number) => {
                  switch(eventType) {
                    case 1: return 'ATTACK'
                    case 2: return 'DEFENSE'
                    case 3: return 'SABOTAGE'
                    default: return `TYPE ${eventType}`
                  }
                }
                
                // Show campaign if planet has an active campaign (with or without event)
                return activeCampaign ? (
                  <div className="detail-row campaign-info">
                    <span className="detail-label">⭐ ACTIVE CAMPAIGN:</span>
                    <div className="campaign-details">
                      {activeCampaign.id && (
                        <div className="campaign-detail">
                          <span className="campaign-label">CAMPAIGN ID:</span>
                          <span className="campaign-value">{activeCampaign.id}</span>
                        </div>
                      )}
                      {!activeCampaign.planet?.event && (
                        <>
                          {activeCampaign.planet?.event?.eventType !== undefined ? (
                            <div className="campaign-detail">
                              <span className="campaign-label">
                                {getEventTypeEmoji(activeCampaign.planet.event.eventType)} TYPE:
                              </span>
                              <span className="campaign-value">
                                {getEventTypeLabel(activeCampaign.planet.event.eventType)}
                              </span>
                            </div>
                          ) : (
                            // Fallback: show campaign type as CONTESTED
                            <div className="campaign-detail">
                              <span className="campaign-label">🔴 STATUS:</span>
                              <span className="campaign-value">CONTESTED</span>
                            </div>
                          )}
                          {activeCampaign.planet?.event?.faction ? (
                            <div className="campaign-detail">
                              <span className="campaign-label">FACTION:</span>
                              <span className="campaign-value">{activeCampaign.planet.event.faction}</span>
                            </div>
                          ) : activeCampaign.planet?.currentOwner && activeCampaign.planet?.currentOwner !== 'Humans' ? (
                            // Fallback: show current owner if not human-controlled
                            <div className="campaign-detail">
                              <span className="campaign-label">FACTION:</span>
                              <span className="campaign-value">{activeCampaign.planet.currentOwner}</span>
                            </div>
                          ) : null}
                          {activeCampaign.planet?.event?.startTime && (
                            <div className="campaign-detail">
                              <span className="campaign-label">STARTED:</span>
                              <span className="campaign-value">
                                {new Date(activeCampaign.planet.event.startTime).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {activeCampaign.planet?.event?.endTime && (
                            <div className="campaign-detail">
                              <span className="campaign-label">EXPIRES:</span>
                              <span className="campaign-value">
                                {new Date(activeCampaign.planet.event.endTime).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {activeCampaign.planet?.event?.health !== undefined && activeCampaign.planet?.event?.maxHealth && (
                            <div className="campaign-detail">
                              <span className="campaign-label">PROGRESS:</span>
                              <div className="campaign-health-bar">
                                <div
                                  className="campaign-health-fill"
                                  style={{
                                    width: `${(activeCampaign.planet.event.health / activeCampaign.planet.event.maxHealth) * 100}%`,
                                    backgroundColor: '#ff8800'
                                  }}
                                ></div>
                              </div>
                              <span className="campaign-value">
                                {activeCampaign.planet.event.health.toLocaleString()} / {activeCampaign.planet.event.maxHealth.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      {activeCampaign.planet?.statistics?.playerCount !== undefined && (
                        <div className="campaign-detail">
                          <span className="campaign-label">HELL DIVERS:</span>
                          <span className="campaign-value">{activeCampaign.planet.statistics.playerCount.toLocaleString()}</span>
                        </div>
                      )}
                      {activeCampaign.planet?.statistics?.missionSuccessRate !== undefined && (
                        <div className="campaign-detail">
                          <span className="campaign-label">SUCCESS RATE:</span>
                          <span className="campaign-value">{activeCampaign.planet.statistics.missionSuccessRate}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null
              })()}

              {selectedPlanet.threatLevel && (
                <div className="detail-row">
                  <span className="detail-label">THREAT LEVEL:</span>
                  <span className="detail-value">{selectedPlanet.threatLevel}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="no-selection">
            <p>🎯 SELECT A PLANET</p>
            <p>Click on any planet to view its details</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default MapView
