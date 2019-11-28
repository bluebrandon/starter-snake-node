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

  console.log("---------------------------------------------------");
  console.log(`turn: ${turn}`);
  console.log({ board });
  console.log({ you });
  console.log({ snakes });
  console.log({ food });
  turn += 1;

  const getHead = snake => {
    return snake.body[0];
  };

  const printGrid = grid => {
    console.log(grid.reduce((str, row) => str + row.join(" ") + "\n", ""));
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

  const createGrid = () => {
    const grid = Array(board.height)
      .fill()
      .map(() => Array(board.width).fill(0));

    snakes.forEach(snake => {
      snake.body.forEach((segment, index) => {
        if (index !== segment.length - 1) {
          grid[segment.y][segment.x] = 1;
        }
      });
    });

    // printGrid(grid);

    return new PF.Grid(grid);
  };

  const paths = food.map(food => {
    const finder = new PF.AStarFinder();
    const grid = createGrid();
    const head = getHead(you);
    return finder.findPath(head.x, head.y, food.x, food.y, grid);
  }).filter((path) => path.length !== 0);

  
  const shortestPath = paths.reduce(
    (res, path) => (res && path.length > res.length ? res : path),
    null
  );

  console.log({ paths });
  console.log({ shortestPath });

  if (shortestPath) {
    const nextPosition = { x: shortestPath[1][0], y: shortestPath[1][1] };
    const move = directionTo(nextPosition);
    console.log("directed");
    console.log(move);
    return response.json({ move });
  } else {
    const moves = availableMoves(getHead(you));
    const move = moves[Math.floor(Math.random() * moves.length)];
    console.log("random");
    console.log(move);
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
