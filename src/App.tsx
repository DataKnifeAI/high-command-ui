import { useState, useRef, useEffect } from 'react'
import './App.css'
import HighCommandAPI from './services/api'
import ChatInterface from './components/ChatInterface'
import GalacticMap from './components/GalacticMap'
import News from './components/News'
import MissionOrders from './components/MissionOrders'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface WarStatus {
  [key: string]: any
}

const INSPIRATIONAL_QUOTES = [
  "For every soldier lost, a thousand more will take their place. For the glory of Super Earth!",
  "Democracy will spread to the far corners of the galaxy.",
  "Managed democracy is not a negotiation—it's a service.",
  "The only good bug is a dead bug.",
  "We serve the truth. The truth is Helldivers.",
  "Victory tastes like freedom and tastes like managed democracy.",
  "No Helldiver left behind—except those who betray Democracy.",
  "Spread joy. Spread managed democracy. Spread Helldivers.",
  "Bugs have failed, bots will fall, Helldivers will prevail!",
  "Every mission is a step toward galactic freedom."
]

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [warStatus, setWarStatus] = useState<WarStatus | null>(null)
  const [dailyQuote, setDailyQuote] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'console' | 'major' | 'news' | 'galactic' | 'help'>('console')
  const [isApiAvailable, setIsApiAvailable] = useState(true)
  const [upstreamApiDegraded, setUpstreamApiDegraded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const loadData = async () => {
      try {
        const healthStatus = await HighCommandAPI.getStatus()
        console.log('Health status loaded:', healthStatus)
        
        if (healthStatus !== null && healthStatus !== undefined) {
          setIsApiAvailable(true)
          const upstreamStatus = healthStatus.upstream_api
          console.log('Upstream API status:', upstreamStatus)
          setUpstreamApiDegraded(upstreamStatus !== 'online')
        } else {
          setIsApiAvailable(false)
          setUpstreamApiDegraded(false)
        }
        
        const warStatus = await HighCommandAPI.getWarStatus()
        if (warStatus) {
          console.log('War status loaded:', warStatus)
          setWarStatus(warStatus)
        }
      } catch (error) {
        console.error('Failed to load data:', error)
        setIsApiAvailable(false)
        setUpstreamApiDegraded(false)
      }
    }
    loadData()
    
    const dayIndex = new Date().getDate() % INSPIRATIONAL_QUOTES.length
    setDailyQuote(INSPIRATIONAL_QUOTES[dayIndex])

    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    console.log('📊 LIVE Indicator Status:', {
      isApiAvailable,
      upstreamApiDegraded,
      display: !isApiAvailable ? 'OFFLINE' : upstreamApiDegraded ? 'DEGRADED' : 'LIVE'
    })
  }, [isApiAvailable, upstreamApiDegraded])

  const handleSendMessage = async (prompt: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: prompt,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setLoading(true)

    try {
      const response = await HighCommandAPI.executeCommand(prompt)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])

      const status = await HighCommandAPI.getWarStatus()
      setWarStatus(status)
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>⚔️ HELLDIVERS 2: HIGH COMMAND</h1>
          <p className="subtitle">H.E.L.L. — High-Endurance Liberation Logistics</p>
          
          <div className="quote-banner">
            <span className="quote-icon">✦</span>
            <span className="quote-text">{dailyQuote}</span>
            <span className="quote-icon">✦</span>
          </div>
        </div>
        <div className="live-stats">
          {warStatus ? (
            <>
              <div className="stat-item">
                <span className="stat-label">ACTIVE PLAYERS</span>
                <span className="stat-value">{warStatus.statistics?.playerCount?.toLocaleString() || 'N/A'}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">TERMINID KILLS</span>
                <span className="stat-value">{warStatus.statistics?.terminidKills ? warStatus.statistics.terminidKills.toLocaleString() : 'N/A'}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">AUTOMATON KILLS</span>
                <span className="stat-value">{warStatus.statistics?.automatonKills ? warStatus.statistics.automatonKills.toLocaleString() : 'N/A'}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">ILLUMINATE KILLS</span>
                <span className="stat-value">{warStatus.statistics?.illuminateKills ? warStatus.statistics.illuminateKills.toLocaleString() : 'N/A'}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">MISSIONS WON</span>
                <span className="stat-value">{warStatus.statistics?.missionsWon?.toLocaleString() || 'N/A'}</span>
              </div>
              {warStatus?.statistics?.factionStats && Object.entries(warStatus.statistics.factionStats).map(([faction, data]: [string, any]) => (
                <div key={faction} className="stat-item faction-item">
                  <span className="stat-label">{faction.toUpperCase().substring(0, 8)}</span>
                  <span className="stat-value">{(data.kills ? Math.floor(data.kills / 1e9) : 0)}B</span>
                  <span className="stat-sublabel">Faction Kills</span>
                </div>
              ))}
            </>
          ) : (
            <div className="stat-item offline-notice">
              <span className="stat-label">AWAITING DATA...</span>
            </div>
          )}
          
          <div className="stat-item live-indicator">
            <span className={`live-dot ${!isApiAvailable ? 'offline' : upstreamApiDegraded ? 'degraded' : 'live'}`}></span>
            <span className={`live-text ${!isApiAvailable ? 'offline' : upstreamApiDegraded ? 'degraded' : ''}`}>
              {!isApiAvailable ? 'OFFLINE' : upstreamApiDegraded ? 'DEGRADED' : 'LIVE'}
            </span>
          </div>
        </div>
        
        <div className="democracy-reminder">
          ⚠️ REMINDER: Report any suspicious activity or foul play to your Democracy Officer immediately. Treason will not be tolerated.
        </div>
      </header>

      <div className="main-container">
        <nav className="tabs">
          <button 
            className={`tab ${activeTab === 'console' ? 'active' : ''}`}
            onClick={() => setActiveTab('console')}
          >
            💻 DATA CONSOLE
          </button>
          <button 
            className={`tab ${activeTab === 'major' ? 'active' : ''}`}
            onClick={() => setActiveTab('major')}
          >
            ⭐ MAJOR ORDERS
          </button>
          <button 
            className={`tab ${activeTab === 'news' ? 'active' : ''}`}
            onClick={() => setActiveTab('news')}
          >
            📡 DISPATCHES
          </button>
          <button 
            className={`tab ${activeTab === 'galactic' ? 'active' : ''}`}
            onClick={() => setActiveTab('galactic')}
          >
            🌍 GALACTIC MAP
          </button>
          <button 
            className={`tab ${activeTab === 'help' ? 'active' : ''}`}
            onClick={() => setActiveTab('help')}
          >
            ❓ HELP
          </button>
        </nav>

        <div className="content">
          {activeTab === 'console' ? (
            <ChatInterface 
              messages={messages}
              loading={loading}
              onSendMessage={handleSendMessage}
              messagesEndRef={messagesEndRef}
            />
          ) : activeTab === 'major' ? (
            <MissionOrders warStatus={warStatus} />
          ) : activeTab === 'news' ? (
            <News warStatus={warStatus} />
          ) : activeTab === 'galactic' ? (
            <GalacticMap warStatus={warStatus} />
          ) : (
            <div className="help-content">
              <div className="help-section">
                <h2>💻 DATA CONSOLE</h2>
                <p>Command the strategic warfare using the Data Console. Input natural language commands and our AI democracy officer will execute MCP tools to gather intelligence and execute operations.</p>
                
                <h3>Available Commands</h3>
                <p>Outcome-based (what to do):</p>
                <ul>
                  <li><strong>War summary:</strong> &quot;What&apos;s the state of the war?&quot; / &quot;War summary&quot;</li>
                  <li><strong>Where to deploy:</strong> &quot;Where should I deploy?&quot; / &quot;Where to fight?&quot;</li>
                  <li><strong>Liberation priority:</strong> &quot;What to liberate first?&quot; / &quot;Liberation priority&quot;</li>
                  <li><strong>Mission efficiency:</strong> &quot;How are we doing on missions?&quot; / &quot;Mission efficiency&quot;</li>
                </ul>
                <p>Analytics (efficiency and stats):</p>
                <ul>
                  <li><strong>Mission analytics:</strong> &quot;Mission analytics&quot; / &quot;Success rate&quot; / &quot;Bug kills&quot;</li>
                  <li><strong>War analytics:</strong> &quot;War analytics&quot; / &quot;Time left in war&quot;</li>
                  <li><strong>Planet analytics:</strong> &quot;Which sectors need help?&quot; / &quot;Planet analytics&quot;</li>
                </ul>
                <p>Raw data (for custom questions):</p>
                <ul>
                  <li><strong>War / planets / statistics:</strong> &quot;War status&quot; / &quot;Show planets&quot; / &quot;Statistics&quot;</li>
                  <li><strong>Major orders / factions / biomes:</strong> &quot;Major orders&quot; / &quot;Factions&quot; / &quot;Biomes&quot;</li>
                  <li><strong>Planet details:</strong> &quot;Status of planet 0&quot;</li>
                </ul>
                
                <h3>H.E.L.L. System Overview:</h3>
                <p><strong>H</strong>igh-Endurance <strong>E</strong>xecution <strong>L</strong>iberation <strong>L</strong>ogistics — Your command center for spreading managed democracy across the galaxy.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
