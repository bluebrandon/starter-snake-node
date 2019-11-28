const bodyParser = require('body-parser')
const express = require('express')
const logger = require('morgan')
const app = express()
const {
  fallbackHandler,
  notFoundHandler,
  genericErrorHandler,
  poweredByHandler
} = require('./handlers.js')

// For deployment to Heroku, the port needs to be set using ENV, so
// we check for the port number in process.env
app.set('port', (process.env.PORT || 9001))

app.enable('verbose errors')

app.use(logger('dev'))
app.use(bodyParser.json())
app.use(poweredByHandler)

// --- SNAKE LOGIC GOES BELOW THIS LINE ---

// Handle POST request to '/start'
app.post('/start', (request, response) => {
  // NOTE: Do something here to start the game

  // Response data
  const data = {
    color: '#0000FF',
  }

  return response.json(data)
})

// Handle POST request to '/move'
app.post('/move', (request, response) => {
  console.log('---------------------------------------------------');
  console.log({ board: request.body.board });
  console.log({ body: request.body.you.body });

  const you = request.body.you;
  const board = request.body.board;

  const moves = ['up','down','left','right'].filter((dir) => {
    // Get my head
    let { x, y } = you.body[0];

    if (dir === 'left') x -= 1;
    if (dir === 'right') x += 1;
    if (dir === 'up') y -= 1;
    if (dir === 'down') y += 1;
    
    const noHitSelf = you.body.reduce((res, segment) => {
      return res && (segment.x !== x || segment.y !== y);
    }, true);
    
    const noOutOfBounds = x >= 0 && x < board.width && y >= 0 && y < board.height;
    
    return noHitSelf && noOutOfBounds;
  })
  
  console.log({ moves: moves });
  
  const move =  moves[Math.floor(Math.random() * moves.length)];
  
  console.log(move);
  
  return response.json({ move });
})

app.post('/end', (request, response) => {
  // NOTE: Any cleanup when a game is complete.
  return response.json({})
})

app.post('/ping', (request, response) => {
  // Used for checking if this snake is still alive.
  return response.json({});
})

// --- SNAKE LOGIC GOES ABOVE THIS LINE ---

app.use('*', fallbackHandler)
app.use(notFoundHandler)
app.use(genericErrorHandler)

app.listen(app.get('port'), () => {
  console.log('Server listening on port %s', app.get('port'))
})
