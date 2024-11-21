const canvas = document.getElementById('gameCanvas')
const ctx = canvas.getContext('2d')
const restartButton = document.getElementById('restartButton')
var nicknameInput = document.getElementById('nicknameInput')
var phoneNumberInput = document.getElementById('phoneNumberInput')
const logOutButton = document.getElementById('logOutButton')
const startGameButton = document.getElementById('startGameButton')
const nicknameText = document.getElementById('nicknameText')
const muteButton = document.getElementById('muteButton') // Mute button
const API_URL = 'https://caligenadmin-59e2454701e5.herokuapp.com'

const maxCanvasWidth = 800
const maxCanvasHeight = 600

canvas.width = Math.min(window.innerWidth * 0.9, maxCanvasWidth)
canvas.height = Math.min(window.innerHeight * 0.8, maxCanvasHeight)

let flyerX = 100
let flyerY = canvas.height / 2
const gravity = 0.5
const lift = -8
let velocity = 0
const maxFallSpeed = 10
let frameCount = 0
let gameRunning = false
let tapCooldown = false // Optional cooldown flag
let score = 0
let highScore = Number(localStorage.getItem('highscore')) || 0

let obstacles = []
const minObstacleWidth = 50
const obstacleWidth = Math.max(canvas.width / 16, minObstacleWidth)
const obstacleGap = canvas.height / 4
const obstacleSpeed = canvas.width / 200

const minObstacleHeight = canvas.height / 8
const maxObstacleHeight = canvas.height / 2

const backgroundImage = new Image()
backgroundImage.src = './img/background-clouds.png'
let backgroundX = 0
let backgroundSpeed = canvas.width / 300

const flyerImage = new Image()
flyerImage.src = './img/flyer.png'

const obstacleImages = [
  './img/obstacle1.png',
  './img/obstacle2.png',
  './img/obstacle3.png',
  './img/obstacle4.png',
]

const loadedObstacleImages = obstacleImages.map((src) => {
  const img = new Image()
  img.src = src
  return img
})

let userNickname = ''
let leaderboard = []

// Background Music Setup
const backgroundMusic = new Audio('./audio/background.mp3')
backgroundMusic.loop = true // Enable looping for continuous playback
backgroundMusic.volume = 0.05 // Set initial volume
let backgroundMusicIsMuted = false
// Tap Sound Setup
const tapSound = new Audio('./audio/tap.wav')
tapSound.volume = 1 // Adjust the volume if needed
const gameOverSound = new Audio('./audio/gameover.wav') // Game over sound
const countdownSound = new Audio('./audio/countdown.wav') // Countdown sound

let countdownRunning = false // Prevent multiple countdowns

let isMuted = false // Mute state

// Fetch leaderboard from the backend
async function fetchLeaderboard() {
  try {
    const response = await fetch(`${API_URL}/leaderboard`)
    const data = await response.json()
    leaderboard = data // Update the global leaderboard variable
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error)
  }
}

async function addUser(nickname, phone) {
  const response = await fetch(`${API_URL}/addUser`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, phone }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw data.error || 'Something went wrong'
  }

  return data
}

async function updateUserHighscore(nickname, highscore) {
  try {
    const response = await fetch(`${API_URL}/update-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, highscore }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      if (errorData.error) {
        alert(errorData.error)
      }
      return
    }

    const data = await response.json()
    console.log(data.message)
  } catch (error) {
    console.error('Failed to update highscore:', error)
  }
}
document.addEventListener('gesturestart', (e) => {
  e.preventDefault()
})

document.addEventListener('DOMContentLoaded', () => {
  let nicknameContainer = document.getElementById('nicknameContainer')
  let nickname = localStorage.getItem('nickname')
  let number = localStorage.getItem('number')

  // Adjust volume for iPhone users
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    backgroundMusic.volume = 0.03 // Lower volume for iPhone
  }

  if (nickname && number) {
    nicknameText.innerText = nickname
    nicknameText.style.textShadow = '0 0 4px black'

    nicknameInput = nickname
    phoneNumberInput = number
    nicknameContainer.style.display = 'none'
    console.log(`Welcome back, ${nickname}!`)
  } else {
    logOutButton.style.display = 'none'
  }
})

logOutButton.addEventListener('click', async () => {
  localStorage.removeItem('nickname')
  localStorage.removeItem('number')
  localStorage.removeItem('highscore')
  location.reload()
})
function startCountdown(callback) {
  let countdown = 3 // Start at 3
  countdownRunning = true

  const drawCountdown = () => {
    // Clear only the countdown text area
    ctx.clearRect(0, canvas.height / 4, canvas.width, canvas.height / 2)

    // Draw the background (static during countdown)
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height)

    // Draw obstacles (static positions during countdown)
    obstacles.forEach((obstacle) => {
      // Draw the top obstacle (aligned correctly at the top and flipped upside down)
      ctx.save()
      ctx.translate(obstacle.x, 0)
      ctx.scale(1, -1)
      ctx.drawImage(
        obstacle.image,
        0,
        -obstacle.top,
        obstacleWidth,
        obstacle.top
      )
      ctx.restore()

      // Draw the bottom obstacle normally
      ctx.drawImage(
        obstacle.image,
        obstacle.x,
        obstacle.bottom,
        obstacleWidth,
        canvas.height - obstacle.bottom
      )
    })

    // Draw the flyer (static position during countdown)
    ctx.drawImage(flyerImage, flyerX - 25, flyerY - 25, 50, 50)

    // Redraw the leaderboard
    drawLeaderboard()

    // Redraw the score
    drawScore()

    // Draw countdown text
    ctx.fillStyle = '#ffffff' // Set text color
    ctx.font = `${canvas.height / 6}px Arial` // Set font size
    ctx.textAlign = 'center' // Center the text
    ctx.fillText(
      countdown > 0 ? countdown : 'GO!',
      canvas.width / 2,
      canvas.height / 2
    )
  }

  drawCountdown() // Draw the first countdown number immediately
  countdownSound.play() // Play countdown sound effect

  const countdownInterval = setInterval(() => {
    countdown--

    if (countdown >= 0) {
      drawCountdown() // Update countdown
    } else {
      clearInterval(countdownInterval) // Stop the countdown
      countdownRunning = false
      callback() // Start the game
    }
  }, 800) // Update every second
}

startGameButton.addEventListener('click', async () => {
  const nickname = localStorage.getItem('nickname')
  const number = localStorage.getItem('number')
  nicknameText.style.display = 'none'

  await fetchLeaderboard()
  userNickname =
    (nicknameInput.value && nicknameInput.value.trim()) || nicknameInput
  userNumber =
    (phoneNumberInput.value && phoneNumberInput.value.trim()) ||
    phoneNumberInput

  if (nickname && number) {
    canvas.style.display = 'block'
    startGameButton.style.display = 'none'
    logOutButton.style.display = 'none'

    if (!countdownRunning) {
      startCountdown(() => {
        if (!isMuted) {
          backgroundMusic.currentTime = 0 // Reset the music
          backgroundMusic.play().catch(() => {}) // Ensure playback starts
        }
        gameRunning = true
        flyerY = canvas.height / 2
        gameLoop()
      })
    }
    return
  }

  if (!userNickname) {
    alert('Please enter your nickname!')
    return
  }
  if (!userNumber) {
    alert('Please enter your number!')
    return
  } else if (userNumber.length !== 9 || userNumber[0] !== '5') {
    alert('Please enter valid number!')
    return
  }

  addUser(userNickname, userNumber)
    .then(() => {
      localStorage.setItem('nickname', userNickname)
      localStorage.setItem('number', userNumber)
      startGameButton.style.display = 'none'
      document.getElementById('nicknameContainer').style.display = 'none'
      canvas.style.display = 'block'

      if (!countdownRunning) {
        startCountdown(() => {
          if (!isMuted) {
            backgroundMusic.currentTime = 0 // Reset the music
            backgroundMusic.play().catch(() => {}) // Ensure playback starts
          }
          gameRunning = true
          flyerY = canvas.height / 2
          gameLoop()
        })
      }
    })
    .catch((err) => {
      alert(err)
    })
})

// Mute/Unmute Background Music
// Mute/Unmute Background Music
muteButton.addEventListener('click', () => {
  isMuted = !isMuted // Toggle mute state

  if (isMuted) {
    backgroundMusic.pause() // Pause the music
    muteButton.innerText = '🔇' // Update button text
  } else {
    backgroundMusic.play().catch(() => {}) // Resume music from the current position
    muteButton.innerText = '🔊' // Update button text
  }
})

// Restart Button
restartButton.addEventListener('click', () => {
  obstacles = []
  flyerY = canvas.height / 2
  velocity = 0
  frameCount = 0
  restartButton.style.display = 'none'
  gameRunning = true
  score = 0
  if (!backgroundMusicIsMuted) {
    backgroundMusic.currentTime = 0
    backgroundMusic.play()
  }
  gameLoop()
})

const tapSoundPool = Array.from(
  { length: 5 },
  () => new Audio('./audio/tap.wav')
)
let tapSoundIndex = 0

// Canvas touch controls
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault() // Prevent zoom or scroll
  if (gameRunning) {
    const currentSound = tapSoundPool[tapSoundIndex]
    currentSound.currentTime = 0 // Reset playback position
    currentSound.play().catch(() => {}) // Play the sound
    tapSoundIndex = (tapSoundIndex + 1) % tapSoundPool.length // Cycle to the next sound
    velocity = lift
  }
})
// Prevent double-tap zoom
canvas.addEventListener(
  'touchstart',
  (e) => {
    if (e.touches.length > 1) {
      e.preventDefault() // Prevent multi-touch zoom
    }
  },
  { passive: false }
)

// Keyboard controls
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && gameRunning) {
    const currentSound = tapSoundPool[tapSoundIndex]
    currentSound.currentTime = 0 // Reset playback position
    currentSound.play().catch(() => {}) // Play the sound
    tapSoundIndex = (tapSoundIndex + 1) % tapSoundPool.length // Cycle to the next sound
    velocity = lift
  }
})
document.addEventListener('dblclick', (e) => {
  e.preventDefault() // Prevent double-tap zoom
})

// Create obstacles
function createObstacle() {
  let obstacleHeight =
    Math.random() * (maxObstacleHeight - minObstacleHeight) + minObstacleHeight
  const randomImage =
    loadedObstacleImages[
      Math.floor(Math.random() * loadedObstacleImages.length)
    ]

  obstacles.push({
    x: canvas.width,
    top: obstacleHeight,
    bottom: obstacleHeight + obstacleGap,
    image: randomImage,
  })
}

// Update obstacles
function updateObstacles() {
  obstacles = obstacles.filter((obstacle) => {
    if (obstacle.x + obstacleWidth > 0) {
      return true // Keep obstacle if it's on screen
    } else {
      score++ // Increment score when an obstacle moves off-screen
      if (score > highScore) {
        highScore = score // Update high score
      }
      return false // Remove obstacle from array
    }
  })

  // Move and draw obstacles
  obstacles.forEach((obstacle) => {
    obstacle.x -= obstacleSpeed // Move obstacle to the left

    // Draw the top obstacle (aligned correctly at the top and flipped upside down)
    ctx.save()
    ctx.translate(obstacle.x, 0)
    ctx.scale(1, -1)
    ctx.drawImage(obstacle.image, 0, -obstacle.top, obstacleWidth, obstacle.top)
    ctx.restore()

    // Draw the bottom obstacle normally
    ctx.drawImage(
      obstacle.image,
      obstacle.x,
      obstacle.bottom,
      obstacleWidth,
      canvas.height - obstacle.bottom
    )
  })

  // Create a new obstacle every 120 frames
  if (frameCount % 120 === 0) {
    createObstacle()
  }
}

// Collision detection
function checkCollision() {
  const flyerRadius = 5 // Approximate radius of the flyer based on its size
  const flyerCenterX = flyerX // Center of the flyer (X-coordinate)
  const flyerCenterY = flyerY // Center of the flyer (Y-coordinate)
  const sittingTolerance = 5 // Allow the flyer to "sit" on the obstacle

  for (let obstacle of obstacles) {
    const obstacleLeft = obstacle.x
    const obstacleRight = obstacle.x + obstacleWidth

    const topObstacleBottomEdge = obstacle.top
    const bottomObstacleTopEdge = obstacle.bottom

    if (
      flyerCenterX + flyerRadius > obstacleLeft &&
      flyerCenterX - flyerRadius < obstacleRight &&
      flyerCenterY - flyerRadius < topObstacleBottomEdge
    ) {
      gameOver()
    }

    if (
      flyerCenterX + flyerRadius > obstacleLeft &&
      flyerCenterX - flyerRadius < obstacleRight &&
      flyerCenterY + flyerRadius > bottomObstacleTopEdge
    ) {
      gameOver()
    }
  }

  if (
    flyerCenterY - flyerRadius < 0 ||
    flyerCenterY + flyerRadius > canvas.height
  ) {
    gameOver()
  }
}

// Game Over
async function gameOver() {
  gameRunning = false
  restartButton.style.display = 'block'
  cancelAnimationFrame(gameLoop)

  backgroundMusic.pause()
  gameOverSound.currentTime = 0 // Reset the sound
  gameOverSound.play()

  localStorage.setItem('highscore', highScore)
  await updateUserHighscore(userNickname, highScore)

  fetchLeaderboard()

  score = 0
}

// Draw leaderboard
function drawLeaderboard() {
  const leaderboardToShow = leaderboard.slice(0, 3) // Show top 3 players
  const currentUser = leaderboard.find(
    (entry) => entry.nickname === userNickname
  )
  const fontSize = canvas.height / 30 // Dynamic font size based on canvas height
  const paddingRight = 20 // Padding from the right edge

  ctx.fillStyle = '#ffffff' // Leaderboard title color
  ctx.font = `${fontSize}px Arial` // Dynamic font size
  ctx.textAlign = 'right' // Align text to the right

  // Render "Leaderboard" title
  ctx.fillText('Leaderboard', canvas.width - paddingRight, 30)

  // Render the top 3 players
  leaderboardToShow.forEach((entry, index) => {
    const nickname = entry.nickname || 'Unknown' // Default for missing nickname
    const highscore = entry.highscore || 0 // Default for missing highscore
    ctx.fillStyle = '#00FF00' // Color for leaderboard entries

    ctx.fillText(
      `${index + 1}. ${nickname} - ${highscore}`,
      canvas.width - paddingRight,
      50 + fontSize * index
    )
  })

  // Render the current user if not in the top 3
  if (currentUser && !leaderboardToShow.includes(currentUser)) {
    const nickname = currentUser.nickname || 'Unknown'
    const highscore = currentUser.highscore || 0
    ctx.fillStyle = '#FFD700' // Highlight current user (gold color)
    ctx.fillText(
      `${leaderboard.indexOf(currentUser) + 1}. ${nickname} - ${highscore}`,
      canvas.width - paddingRight,
      50 + fontSize * 3
    )
  }
}

// Draw score
function drawScore() {
  ctx.fillStyle = '#ffffff'
  ctx.font = `${canvas.height / 30}px Arial`
  ctx.textAlign = 'left'

  ctx.fillText(`Score: ${score}`, 20, 30)
  ctx.fillText(`High Score: ${highScore}`, 20, 60)
}

// Main game loop
function gameLoop() {
  if (!gameRunning) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  backgroundX -= backgroundSpeed
  if (backgroundX <= -canvas.width) {
    backgroundX = 0
  }
  ctx.drawImage(backgroundImage, backgroundX, 0, canvas.width, canvas.height)
  ctx.drawImage(
    backgroundImage,
    backgroundX + canvas.width,
    0,
    canvas.width,
    canvas.height
  )

  velocity += gravity
  if (velocity > maxFallSpeed) velocity = maxFallSpeed
  flyerY += velocity

  ctx.drawImage(flyerImage, flyerX - 25, flyerY - 25, 50, 50)

  updateObstacles()
  checkCollision()
  drawScore()
  drawLeaderboard()

  frameCount++
  requestAnimationFrame(gameLoop)
}
