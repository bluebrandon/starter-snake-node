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
const printGrid = grid => {
  debug(grid.reduce((str, row) => str + row.join(" ") + "\n", ""));
};

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
  turn += 1;

  const getHead = snake => {
    return snake.body[0];
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

  const createFoodMatrix = () => {
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

    return grid;
  };

  const createKillMatrix = () => {
    const grid = Array(board.height)
      .fill()
      .map(() => Array(board.width).fill(0));

    // Go after weak snakes
    snakes.forEach(snake => {
      if (snake.body.length < you.body.length) {
        snake.body.forEach((segment, index) => {
          const isHead = index === 0;

          if (!isHead) {
            grid[segment.y][segment.x] = 1;
          }
        });
      } else {
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
      }
    });

    return grid;
  };

  const hasAvailableNextMoves = position => {
    return availableMoves(position).length;
  };

  const rankMove = move => {
    if (move) {
      const position = applyDirection(getHead(you), move);
      return hasAvailableNextMoves(position);
    } else {
      return 0;
    }
  };

  const isKillerHead = position => {
    let killerHead = false;
    snakes.reduce(snake => {
      if (snake.body.length > you.body.length) {
        const head = getHead(snake);
        if (head.x === position.x && head.y === position.y) {
          killerHead = true;
        }
      }
    });
    return killerHead;
  };

  const noAdjacentKillerHead = position => {
    return availableMoves(position).reduce((res, move) => {
      const adjacentPosition = applyDirection(getHead(you), move);
      return res && !isKillerHead(adjacentPosition);
    }, true);
  };

  const filterBestMoves = moves => {
    const maxRank = moves.reduce((max, move) => {
      const newRank = rankMove(move);
      return newRank > max ? newRank : max;
    }, 0);

    // If there are options, avoid going to spaces beside killer heads
    // if (moves.length > 1) {
    //   const saferMoves = moves.filter(move => {
    //     const position = applyDirection(getHead(you), move);
    //     const safePosition = noAdjacentKillerHead(position);
    //     if (!safePosition) debug("killer at random move!");
    //     return safePosition;
    //   });
    //   if (saferMoves.length > 0) {
    //     debug("safer moves!");
    //     moves = saferMoves;
    //   }
    // }

    return moves.filter(move => rankMove(move) === maxRank);
  };

  const getPath = (head, target, matrix) => {
    const finder = new PF.AStarFinder();
    const grid = new PF.Grid(matrix);
    return finder.findPath(head.x, head.y, target.x, target.y, grid);
  };

  // KILLING!
  const killMatrix = createKillMatrix();
  printGrid(killMatrix);

  const weakSnakes = snakes.filter(snake => snake.body.length < you.body.length);
  const weakHeads = weakSnakes.map(snake => getHead(snake));
  const weakHeadPaths = weakHeads.map(weakHead => getPath(getHead(you), weakHead, killMatrix));
  const closestWeakHeadPath = weakHeadPaths.reduce(
    (res, path) => (res && path.length > res.length ? res : path),
    null
  );

  if (closestWeakHeadPath) {
    const nextPosition = { x: closestWeakHeadPath[1][0], y: closestWeakHeadPath[1][1] };
    if (hasAvailableNextMoves(nextPosition)) {
      const move = directionTo(nextPosition);
      debug("kill");
      debug(move);
      return response.json({ move });
    }
    debug("killer is bad move!");
  }


  // FOOD!
  const foodMatrix = createFoodMatrix();
  printGrid(foodMatrix);

  const foodPaths = food
    .map(food => getPath(getHead(you), food, foodMatrix))
    .filter(path => path.length !== 0);
  const closestFoodPath = foodPaths.reduce(
    (res, path) => (res && path.length > res.length ? res : path),
    null
  );

  if (closestFoodPath) {
    const nextPosition = { x: closestFoodPath[1][0], y: closestFoodPath[1][1] };
    if (hasAvailableNextMoves(nextPosition)) {
      const move = directionTo(nextPosition);
      debug("food");
      debug(move);
      return response.json({ move });
    }
    debug("food is bad move!");
  }

  // DO YOUR BEST!
  const moves = availableMoves(getHead(you));
  const bestMoves = filterBestMoves(moves);

  const move = bestMoves[Math.floor(Math.random() * bestMoves.length)];
  debug("random");
  debug(move);
  return response.json({ move });
});

app.post("/end", (request, response) => {
  // NOTE: Any cleanup when a game is complete.
  turn = 0;
  debug("game over!");
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
