import { useEffect, useRef, useState } from 'react'
import biomonitorImg from '../assets/biomonitor-device.png'

const HOTSPOTS = [
  {
    id: 'camera',
    x: 52,
    y: 16,
    num: '1',
    title: 'High-Speed Macro Camera',
    desc: 'Overhead 30 fps sensor tracking individual Daphnia swim velocity, depth, and turn frequency.',
  },
  {
    id: 'light',
    x: 29,
    y: 53,
    num: '2',
    title: 'Steady Calibrated Backlight',
    desc: 'Even LED light bar keeps optical contrast crystal clear against river turbidity.',
  },
  {
    id: 'chamber',
    x: 50,
    y: 54,
    num: '3',
    title: 'Live Daphnia Flow Chamber',
    desc: 'Continuously circulating Yamuna river sample; micro-crustaceans react instantly to toxic cocktails.',
  },
  {
    id: 'base',
    x: 54,
    y: 86,
    num: '4',
    title: 'Edge AI MCU & AWS Link',
    desc: 'Rugged base processing telemetry locally, feeding early-warning alerts to AWS cloud.',
  },
]

export default function Biomonitor3DViewer() {
  const containerRef = useRef(null)
  const [rotY, setRotY] = useState(-15)
  const [rotX, setRotX] = useState(6)
  const [zoom, setZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [autoRotate, setAutoRotate] = useState(true)
  const [activeHotspot, setActiveHotspot] = useState(null)
  const dragStartRef = useRef({ x: 0, y: 0, rotY: 0, rotX: 0 })
  const velocityRef = useRef(0)

  // Auto-rotation loop
  useEffect(() => {
    let animId
    const loop = () => {
      if (autoRotate && !isDragging) {
        setRotY((prev) => (prev + 0.35) % 360)
      }
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [autoRotate, isDragging])

  // Mouse handlers
  const handleMouseDown = (e) => {
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      rotY,
      rotX,
    }
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    const nextY = (dragStartRef.current.rotY + dx * 0.6) % 360
    const nextX = Math.max(-25, Math.min(25, dragStartRef.current.rotX - dy * 0.3))
    setRotY(nextY)
    setRotX(nextX)
    velocityRef.current = dx * 0.1
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Touch handlers
  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return
    setIsDragging(true)
    dragStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      rotY,
      rotX,
    }
  }

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - dragStartRef.current.x
    const dy = e.touches[0].clientY - dragStartRef.current.y
    const nextY = (dragStartRef.current.rotY + dx * 0.7) % 360
    const nextX = Math.max(-25, Math.min(25, dragStartRef.current.rotX - dy * 0.35))
    setRotY(nextY)
    setRotX(nextX)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  const resetView = () => {
    setRotY(0)
    setRotX(0)
    setZoom(1)
    setActiveHotspot(null)
  }

  return (
    <div className="viewer-3d-root" aria-label="Interactive 3D Biomonitor Sensor Model">
      {/* Top Controls Badge */}
      <div className="viewer-3d-topbar">
        <span className="viewer-live-chip">
          <span className="viewer-pulse-ring" aria-hidden="true"></span>
          INTERACTIVE 3D MODEL
        </span>
        <div className="viewer-actions">
          <button
            type="button"
            className={`viewer-btn-pill ${autoRotate ? 'is-active' : ''}`}
            onClick={() => setAutoRotate(!autoRotate)}
            title="Toggle 360 Auto-Rotation"
          >
            {autoRotate ? '⏸ Pause' : '▶ 360° Spin'}
          </button>
          <button
            type="button"
            className="viewer-btn-pill"
            onClick={resetView}
            title="Reset viewing angle"
          >
            ↺ Reset
          </button>
          <div className="viewer-zoom-group">
            <button
              type="button"
              className="viewer-btn-zoom"
              onClick={() => setZoom((z) => Math.min(1.4, z + 0.15))}
              title="Zoom In"
            >
              +
            </button>
            <button
              type="button"
              className="viewer-btn-zoom"
              onClick={() => setZoom((z) => Math.max(0.8, z - 0.15))}
              title="Zoom Out"
            >
              −
            </button>
          </div>
        </div>
      </div>

      {/* 3D Viewport Stage */}
      <div
        ref={containerRef}
        className={`viewer-3d-stage ${isDragging ? 'is-grabbing' : 'is-grabbable'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Soft studio light backdrop glow */}
        <div className="stage-ambient-halo" aria-hidden="true"></div>

        {/* 3D Transform Object Container */}
        <div
          className="stage-object-wrapper"
          style={{
            transform: `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${zoom})`,
          }}
        >
          {/* Main High-Res Transparent Device Cutout */}
          <div className="stage-device-body">
            <img
              src={biomonitorImg}
              alt="Bio-Sentinel Daphnia Biomonitor Sensor"
              className="stage-device-image"
              draggable="false"
            />
            {/* Dynamic Surface Glare */}
            <div
              className="stage-specular-glare"
              style={{
                transform: `translateX(${(rotY % 360) * 1.2}px)`,
                opacity: 0.15 + Math.abs(Math.sin((rotY * Math.PI) / 180)) * 0.25,
              }}
              aria-hidden="true"
            ></div>
          </div>

          {/* Contact Shadow Below Base */}
          <div
            className="stage-contact-shadow"
            style={{
              transform: `scale(${1 + Math.abs(rotX) * 0.015})`,
              opacity: 0.7 - Math.abs(rotX) * 0.01,
            }}
            aria-hidden="true"
          ></div>

          {/* Interactive 3D Hotspot Pins */}
          {HOTSPOTS.map((spot) => {
            // Subtle parallax offset based on rotation
            const depthFactor = 0.25
            const offsetX = Math.sin((rotY * Math.PI) / 180) * 12 * depthFactor
            const isHovered = activeHotspot === spot.id

            return (
              <div
                key={spot.id}
                className={`stage-hotspot-pin ${isHovered ? 'is-open' : ''}`}
                style={{
                  top: `${spot.y}%`,
                  left: `calc(${spot.x}% + ${offsetX}px)`,
                }}
                onMouseEnter={() => {
                  setAutoRotate(false)
                  setActiveHotspot(spot.id)
                }}
                onMouseLeave={() => setActiveHotspot(null)}
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveHotspot(activeHotspot === spot.id ? null : spot.id)
                }}
              >
                <div className="hotspot-core-dot">
                  <span className="hotspot-num">{spot.num}</span>
                  <span className="hotspot-ping" aria-hidden="true"></span>
                </div>

                {/* Hotspot Tooltip Popover */}
                {isHovered && (
                  <div className="hotspot-popover" role="tooltip">
                    <div className="popover-title">{spot.title}</div>
                    <div className="popover-desc">{spot.desc}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Drag Hint at bottom */}
        <div className="stage-drag-hint">
          <span className="drag-icon">↔</span>
          <span>Click & drag to rotate 360° · Hover pins for hardware details</span>
        </div>
      </div>
    </div>
  )
}
