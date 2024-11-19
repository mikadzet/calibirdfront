const canvas = document.getElementById('gameCanvas')
const ctx = canvas.getContext('2d')
const restartButton = document.getElementById('restartButton')
const nicknameInput = document.getElementById('nicknameInput')
const startGameButton = document.getElementById('startGameButton')

const API_URL = 'http://localhost:5000'

const maxCanvasWidth = 800
const maxCanvasHeight = 600

canvas.width = Math.min(window.innerWidth * 0.9, maxCanvasWidth)
canvas.height = Math.min(window.innerHeight * 0.8, maxCanvasHeight)

let flyerX = 100
let flyerY = canvas.height / 2
const gravity = 0.6
const lift = -12
let velocity = 0
const maxFallSpeed = 10
let frameCount = 0
let gameRunning = false

let score = 0
let highScore = 0

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

// Post user highscore to the backend
async function updateUserHighscore(nickname, highscore) {
  try {
    const response = await fetch(`${API_URL}/leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, highscore }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      if (errorData.error) {
        alert(errorData.error) // Show the error message to the user
      }
      return
    }

    const data = await response.json()
    console.log(data.message)
  } catch (error) {
    console.error('Failed to update highscore:', error)
  }
}

// Start Game Button
startGameButton.addEventListener('click', async () => {
  userNickname = nicknameInput.value.trim()
  if (!userNickname) {
    alert('Please enter your nickname!')
    return
  }

  // Fetch the latest leaderboard
  await fetchLeaderboard()

  document.getElementById('nicknameContainer').style.display = 'none'
  canvas.style.display = 'block'
  gameRunning = true
  flyerY = canvas.height / 2
  gameLoop()
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
  gameLoop()
})

// Canvas touch controls
canvas.addEventListener('touchstart', () => {
  if (gameRunning) {
    velocity += lift
  }
})

// Keyboard controls
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && gameRunning) {
    velocity += lift
  }
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
  obstacles.forEach((obstacle, index) => {
    obstacle.x -= obstacleSpeed

    if (obstacle.x + obstacleWidth < 0) {
      obstacles.splice(index, 1)
      score++
      if (score > highScore) {
        highScore = score
      }
    }

    ctx.save()
    ctx.translate(obstacle.x, 0)
    ctx.scale(1, -1)
    ctx.drawImage(obstacle.image, 0, -obstacle.top, obstacleWidth, obstacle.top)
    ctx.restore()

    ctx.drawImage(
      obstacle.image,
      obstacle.x,
      obstacle.bottom,
      obstacleWidth,
      canvas.height - obstacle.bottom
    )
  })

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
function gameOver() {
  gameRunning = false
  restartButton.style.display = 'block'
  cancelAnimationFrame(gameLoop)

  // Post the user's highscore to the backend
  updateUserHighscore(userNickname, highScore)

  // Fetch the updated leaderboard
  fetchLeaderboard()

  score = 0
}

// Draw leaderboard
function drawLeaderboard() {
  const leaderboardToShow = leaderboard.slice(0, 3) // Show top 3 players
  const currentUser = leaderboard.find(
    (entry) => entry.nickname === userNickname
  )
  const fontSize = canvas.height / 30

  ctx.fillStyle = '#ffffff'
  ctx.font = `${fontSize}px Arial`

  ctx.fillText('Leaderboard', canvas.width - 150, 30)

  // Render the top 3 players
  leaderboardToShow.forEach((entry, index) => {
    const nickname = entry.nickname || 'Unknown' // Fallback for missing nickname
    const highscore = entry.highscore || 0 // Fallback for missing highscore
    ctx.fillText(
      `${index + 1}. ${nickname} - ${highscore}`,
      canvas.width - 150,
      50 + fontSize * index
    )
  })

  // Render the current user if not in the top 3
  if (currentUser && !leaderboardToShow.includes(currentUser)) {
    const nickname = currentUser.nickname || 'Unknown'
    const highscore = currentUser.highscore || 0
    ctx.fillText(
      `${leaderboard.indexOf(currentUser) + 1}. ${nickname} - ${highscore}`,
      canvas.width - 150,
      50 + fontSize * 3
    )
  }
}

// Draw score
function drawScore() {
  ctx.fillStyle = '#ffffff'
  ctx.font = `${canvas.height / 30}px Arial`
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
  drawLeaderboard() // Render the leaderboard on the canvas

  frameCount++
  requestAnimationFrame(gameLoop)
}
