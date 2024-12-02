import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import { LoadingManager } from 'three'
import gsap from 'gsap'

// Create loading manager to track all assets
const loadingManager = new LoadingManager()
let assetsLoaded = false


loadingManager.onError = (url) => {
  console.error('Error loading:', url)
}

loadingManager.onLoad = () => {
  assetsLoaded = true
  // Hide loading screen here
  const loader = document.querySelector('.loader-wrapper')
  if (loader) {
    loader.classList.add('fade-out')
  }
}

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.z = 6

// Add some basic lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
directionalLight.position.set(5, 5, 5)
scene.add(directionalLight)

// Initialize loaders with loading manager
const rgbeLoader = new RGBELoader(loadingManager)
const gltfLoader = new GLTFLoader(loadingManager)

// Add DRACO compression support
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/')
gltfLoader.setDRACOLoader(dracoLoader)

// Load HDRI with lower resolution for mobile
const isMobile = window.innerWidth <= 768
const hdriPath = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/pond_bridge_night_1k.hdr' 

// Load environment map
rgbeLoader.load(hdriPath, (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping
  scene.environment = texture
})

let model

// Load model with compression
gltfLoader.load(
  './DamagedHelmet.gltf',
  (gltf) => {
    model = gltf.scene
    
    // Optimize geometries
    model.traverse((node) => {
      if (node.isMesh) {
        node.geometry.attributes.position.setUsage(THREE.StaticDrawUsage)
        // Don't dispose materials as they're needed for rendering
        node.castShadow = true
        node.receiveShadow = true
      }
    })

    // Scale based on device
    const scale = isMobile ? 0.8 : 2
    model.scale.set(scale, scale, scale)
    
    // Center the model
    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    model.position.sub(center)
    
    scene.add(model)
    console.log('Model added to scene')

    // Mobile rotation animation
    if (isMobile) {
      gsap.to(model.rotation, {
        y: Math.PI * 2,
        duration: 8,
        repeat: -1,
        ease: "none"
      })
    }

    // Trigger initial render
    composer.render()
  },
  (progress) => {
    console.log('Loading model:', (progress.loaded / progress.total * 100) + '%')
  },
  (error) => {
    console.error('Error loading model:', error)
  }
)



const canvas = document.querySelector('#draw')
const renderer = new THREE.WebGLRenderer({ 
  canvas,
  antialias: !isMobile, // Disable antialiasing on mobile
  alpha: true,
  powerPreference: "high-performance"
})

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1
renderer.outputEncoding = THREE.sRGBEncoding
renderer.shadowMap.enabled = true

// Post processing
const composer = new EffectComposer(renderer)
const renderPass = new RenderPass(scene, camera)
composer.addPass(renderPass)

const rgbShiftPass = new ShaderPass(RGBShiftShader)
rgbShiftPass.uniforms['amount'].value = 0.0030
composer.addPass(rgbShiftPass)

// Desktop mouse interaction
if (!isMobile) {
  let throttleTimeout;
  window.addEventListener('mousemove', (e) => {
    if (!throttleTimeout && model) {
      throttleTimeout = setTimeout(() => {
        const rotationX = (e.clientX / window.innerWidth - 0.5) * (Math.PI * .12)
        const rotationY = (e.clientY / window.innerHeight - 0.5) * (Math.PI * .12)

        gsap.to(model.rotation, {
          x: rotationY,
          y: rotationX,
          duration: 0.5,
          ease: "power2.out"
        })
        throttleTimeout = null
      }, 30) // ~60fps
    }
  })
}

// Optimized resize handler
let resizeTimeout;
window.addEventListener('resize', () => {
  if (!resizeTimeout) {
    resizeTimeout = setTimeout(() => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()

      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      composer.setSize(window.innerWidth, window.innerHeight)
      
      resizeTimeout = null
    }, 250)
  }
})

function animate() {
  requestAnimationFrame(animate)
  if (assetsLoaded) {
    composer.render()
  }
}

animate()