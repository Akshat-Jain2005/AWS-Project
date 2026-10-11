import { useEffect, useRef, useState } from 'react'
import '@google/model-viewer'

export default function Biomonitor3DViewer() {
  const modelViewerRef = useRef(null)
  const [autoRotate, setAutoRotate] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const mv = modelViewerRef.current
    if (!mv) return

    const handleLoad = () => {
      setIsLoaded(true)
    }

    mv.addEventListener('load', handleLoad)
    if (mv.loaded) {
      setIsLoaded(true)
    }

    return () => {
      mv.removeEventListener('load', handleLoad)
    }
  }, [])

  const toggleSpin = () => {
    setAutoRotate((prev) => {
      const next = !prev
      if (modelViewerRef.current) {
        if (next) {
          modelViewerRef.current.setAttribute('auto-rotate', '')
        } else {
          modelViewerRef.current.removeAttribute('auto-rotate')
        }
      }
      return next
    })
  }

  const handleReset = () => {
    if (modelViewerRef.current) {
      // Reset viewing orientation and turntable
      modelViewerRef.current.cameraOrbit = '0deg 75deg 105%'
      modelViewerRef.current.resetTurntableRotation?.()
      modelViewerRef.current.jumpCameraToGoal?.()
      modelViewerRef.current.fieldOfView = 'auto'
    }
  }

  const handleZoomIn = () => {
    if (modelViewerRef.current) {
      modelViewerRef.current.zoom?.(1)
    }
  }

  const handleZoomOut = () => {
    if (modelViewerRef.current) {
      modelViewerRef.current.zoom?.(-1)
    }
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
            onClick={toggleSpin}
            title="Toggle 360° Auto-Rotation"
          >
            {autoRotate ? '⏸ Pause' : '▶ 360° Spin'}
          </button>
          <button
            type="button"
            className="viewer-btn-pill"
            onClick={handleReset}
            title="Reset viewing angle"
          >
            ↺ Reset
          </button>
          <div className="viewer-zoom-group">
            <button
              type="button"
              className="viewer-btn-zoom"
              onClick={handleZoomIn}
              title="Zoom In"
            >
              +
            </button>
            <button
              type="button"
              className="viewer-btn-zoom"
              onClick={handleZoomOut}
              title="Zoom Out"
            >
              −
            </button>
          </div>
        </div>
      </div>

      {/* 3D Viewport Stage */}
      <div className="viewer-3d-stage">
        {/* Soft studio light backdrop glow */}
        <div className="stage-ambient-halo" aria-hidden="true"></div>

        {/* 3D Model Viewer Container matching dimensions, border-radius, and layout */}
        <div className="stage-object-wrapper">
          <div className="stage-device-body">
            <model-viewer
              ref={modelViewerRef}
              src="/yamuna_watch_textured.glb"
              alt="Yamuna Watch 3D Biomonitor Sensor Model"
              camera-controls
              auto-rotate=""
              auto-rotate-delay="0"
              rotation-per-second="24deg"
              camera-orbit="45deg 75deg 105%"
              field-of-view="auto"
              shadow-intensity="1.0"
              shadow-softness="0.8"
              exposure="1.0"
              environment-image="neutral"
              interaction-prompt="none"
              bounds="tight"
              touch-action="pan-y"
              className="stage-model-viewer"
            >
            </model-viewer>
          </div>
        </div>

        {/* Drag Hint at bottom */}
        <div className="stage-drag-hint">
          <span>Click &amp; drag to rotate 360° · Scroll to zoom · Hover pins for hardware details</span>
        </div>
      </div>
    </div>
  )
}
