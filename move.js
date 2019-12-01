const PF = require("pathfinding");

let showDebug = false;
const debug = (message) => showDebug && console.log(message);
const printGrid = (grid) => {
  // debug(grid.reduce((str, row) => str + row.join(" ") + "\n", ""));
};

const getHead = (snake) => {
  return snake.body[0];
};

class DirectionManager {
  constructor(you, board) {
    this.head = getHead(you);
    this.board = board;
    this.snakes = board.snakes;
  }

  getPosition = (direction) => {
    let { x, y } = this.head;
    if (direction === "left") x -= 1;
    if (direction === "right") x += 1;
    if (direction === "up") y -= 1;
    if (direction === "down") y += 1;
    return { x, y };
  };

  directionTo = (position) => {
    if (position.x > this.head.x) return "right";
    if (position.x < this.head.x) return "left";
    if (position.y > this.head.y) return "down";
    if (position.y < this.head.y) return "up";
  };

  getSafeMoves = (position) => {
    return ["up", "down", "left", "right"].filter((direction) => {
      const { x, y } = this.getPosition(direction);

      const noOutOfBounds =
        x >= 0 && x < this.board.width && y >= 0 && y < this.board.height;

      const noHitSnakes = this.snakes.reduce(
        (res, snake) =>
          res &&
          snake.body.reduce(
            (res, segment) => res && (segment.x !== x || segment.y !== y),
            true
          ),
        true
      );
      return noHitSnakes && noOutOfBounds;
    });
  };

  rankDirection = (direction) => {
    if (direction) {
      const position = this.getPosition(move);
      return this.getSafeMoves(position).length;
    } else {
      return 0;
    }
  };

  getBestMoves = () => {
    const moves = this.getSafeMoves(this.head);
    const maxRank = moves.reduce((max, move) => {
      const newRank = this.rankDirection(move);
      return newRank > max ? newRank : max;
    }, 0);
    return moves.filter((move) => this.rankDirection(move) === maxRank);
  };
}

const getMove = (you, board) => {
  const snakes = board.snakes;
  const food = board.food;

  console.log("--------------------------------------");
  console.log({ you });
  console.log({ board });

  const directionManager = new DirectionManager(you, board);

  const createFoodMatrix = () => {
    const grid = Array(board.height)
      .fill()
      .map(() => Array(board.width).fill(0));

    snakes.forEach((snake) => {
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
    snakes.forEach((snake) => {
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
            if (segment.y + 1 < board.height)
              grid[segment.y + 1][segment.x] = 1;
            if (segment.x - 1 > 0) grid[segment.y][segment.x - 1] = 1;
            if (segment.y - 1 > 0) grid[segment.y - 1][segment.x] = 1;
          }
        });
      }
    });

    return grid;
  };

  const getPath = (head, target, matrix) => {
    const finder = new PF.AStarFinder();
    const grid = new PF.Grid(matrix);
    return finder.findPath(head.x, head.y, target.x, target.y, grid);
  };

  // KILLING!
  const killMatrix = createKillMatrix();
  printGrid(killMatrix);

  const weakSnakes = snakes.filter(
    (snake) => snake.body.length < you.body.length
  );
  const weakHeads = weakSnakes.map((snake) => getHead(snake));
  const weakHeadPaths = weakHeads.map((weakHead) =>
    getPath(getHead(you), weakHead, killMatrix)
  );
  const closestWeakHeadPath = weakHeadPaths.reduce(
    (res, path) => (res && path.length > res.length ? res : path),
    null
  );

  if (closestWeakHeadPath) {
    const nextPosition = {
      x: closestWeakHeadPath[1][0],
      y: closestWeakHeadPath[1][1]
    };
    if (directionManager.getSafeMoves(nextPosition)) {
      const move = directionTo.getDirection(nextPosition);
      debug("kill");
      debug(move);
      return move;
    }
    debug("killer is bad move!");
  }

  // FOOD!
  const foodMatrix = createFoodMatrix();
  printGrid(foodMatrix);

  const foodPaths = food
    .map((food) => getPath(getHead(you), food, foodMatrix))
    .filter((path) => path.length !== 0);

  const closestFoodPath = foodPaths.reduce(
    (res, path) => (res && path.length > res.length ? res : path),
    null
  );

  if (closestFoodPath) {
    const nextPosition = { x: closestFoodPath[1][0], y: closestFoodPath[1][1] };
    if (directionManager.getSafeMoves(nextPosition)) {
      const move = directionManager.directionTo(nextPosition);
      debug("food");
      debug(move);
      return move;
    }
    debug("food is bad move!");
  }

  // DO YOUR BEST!
  const bestMoves = directionManager.getBestMoves();
  const move = bestMoves[Math.floor(Math.random() * bestMoves.length)];
  debug("random");
  debug(move);
  return move;
};

module.exports = {
  getMove
};
