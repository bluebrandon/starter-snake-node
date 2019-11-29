const bodyParser = require("body-parser");
const express = require("express");
const logger = require("morgan");
const PF = require("pathfinding");
const app = express();
const {
  fallbackHandler,
  notFoundHandler,
  genericErrorHandler,
  poweredByHandler
} = require("./handlers.js");

let turn = 0;
let showDebug = false;
const debug = message => showDebug && console.log(message);

// For deployment to Heroku, the port needs to be set using ENV, so
// we check for the port number in process.env
app.set("port", process.env.PORT || 9001);

app.enable("verbose errors");

app.use(logger("dev"));
app.use(bodyParser.json());
app.use(poweredByHandler);

// --- SNAKE LOGIC GOES BELOW THIS LINE ---

// Handle POST request to '/start'
app.post("/start", (request, response) => {
  // NOTE: Do something here to start the game

  // Response data
  const data = {
    color: "#10b3cc",
    headType: "bendr",
    tailType: "round-bum"
  };

  return response.json(data);
});

// Handle POST request to '/move'
app.post("/move", (request, response) => {
  const you = request.body.you;
  const board = request.body.board;
  const snakes = board.snakes;
  const food = board.food;

  debug("---------------------------------------------------");
  debug(`turn: ${turn}`);
  debug({ board });
  // debug({ you });
  // debug({ snakes });
  // debug({ food });
  turn += 1;

  const getHead = snake => {
    return snake.body[0];
  };

  const printGrid = grid => {
    debug(grid.reduce((str, row) => str + row.join(" ") + "\n", ""));
  };

  const applyDirection = (position, direction) => {
    let { x, y } = position;
    if (direction === "left") x -= 1;
    if (direction === "right") x += 1;
    if (direction === "up") y -= 1;
    if (direction === "down") y += 1;
    return { x, y };
  };

  const directionSafe = (position, direction) => {
    const { x, y } = applyDirection(position, direction);

    const noHitSnakes = snakes.reduce(
      (res, snake) =>
        res &&
        snake.body.reduce((res, segment) => res && (segment.x !== x || segment.y !== y), true),
      true
    );

    const noOutOfBounds = x >= 0 && x < board.width && y >= 0 && y < board.height;

    return noHitSnakes && noOutOfBounds;
  };

  const availableMoves = position => {
    return ["up", "down", "left", "right"].filter(direction => {
      const newPosition = applyDirection(position, direction);
      return directionSafe(newPosition);
    });
  };

  const directionTo = position => {
    const head = getHead(you);
    if (position.x > head.x) return "right";
    if (position.x < head.x) return "left";
    if (position.y > head.y) return "down";
    if (position.y < head.y) return "up";
  };

  const createMatrix = () => {
    const grid = Array(board.height)
      .fill()
      .map(() => Array(board.width).fill(0));

    snakes.forEach(snake => {
      snake.body.forEach((segment, index) => {
        const isTail = index === snake.body.length - 1;
        const isFullHealth = snake.health === 100;
        const nextTailSolid = isTail && isFullHealth;

        if (!isTail || nextTailSolid) {
          grid[segment.y][segment.x] = 1;
        }
        if (index === 0 && snake.id !== you.id) {
          if (segment.x + 1 < board.width) grid[segment.y][segment.x + 1] = 1;
          if (segment.y + 1 < board.height) grid[segment.y + 1][segment.x] = 1;
          if (segment.x - 1 > 0) grid[segment.y][segment.x - 1] = 1;
          if (segment.y - 1 > 0) grid[segment.y - 1][segment.x] = 1;
        }
      });
    });

    // printGrid(grid);

    return grid;
  };

  const matrix = createMatrix();

  const rankMove = direction => {
    if (direction) {
      const position = applyDirection(getHead(you), direction);
      return availableMoves(position).length;
    } else {
      return 0;
    }
  };

  const filterBestMoves = moves => {
    const maxRank = moves.reduce((max, move) => {
      const newRank = rankMove(move);
      return newRank > max ? newRank : max;
    }, 0);

    return moves.filter(move => rankMove(move) === maxRank);
  };

  const getPath = (head, target) => {
    const finder = new PF.AStarFinder();
    const grid = new PF.Grid(matrix);
    return finder.findPath(head.x, head.y, target.x, target.y, grid);
  };

  const foodPaths = food.map(food => getPath(getHead(you), food)).filter(path => path.length !== 0);

  const closestFoodPath = foodPaths.reduce(
    (res, path) => (res && path.length > res.length ? res : path),
    null
  );

  if (closestFoodPath && you.health < 80) {
    const nextPosition = { x: closestFoodPath[1][0], y: closestFoodPath[1][1] };
    const move = directionTo(nextPosition);
    debug("directed");
    debug(move);
    return response.json({ move });
  } else {
    const moves = availableMoves(getHead(you));
    const bestMoves = filterBestMoves(moves);

    // const move = moves.reduce((final, move) => rankMove(move) > rankMove(final) ? move : final, null);
    // const move = moves[Math.floor(Math.random() * moves.length)];
    const move = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    debug("random");
    debug(move);
    return response.json({ move });
  }
});

app.post("/end", (request, response) => {
  // NOTE: Any cleanup when a game is complete.
  turn = 0;
  return response.json({});
});

app.post("/ping", (request, response) => {
  // Used for checking if this snake is still alive.
  return response.json({});
});

// --- SNAKE LOGIC GOES ABOVE THIS LINE ---

app.use("*", fallbackHandler);
app.use(notFoundHandler);
app.use(genericErrorHandler);

app.listen(app.get("port"), () => {
  console.log("Server listening on port %s", app.get("port"));
});
