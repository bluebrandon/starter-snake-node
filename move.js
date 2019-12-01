const PF = require('pathfinding');

let showDebug = true;
const debug = (message) => showDebug && console.log(message);
const printGrid = (grid) => {
  debug(grid.reduce((str, row) => str + row.join(' ') + '\n', ''));
};

class DirectionManager {
  update(you, board) {
    this.head = you.body[0];
    this.board = board;
    this.snakes = board.snakes;
  }

  getPosition(position, direction) {
    let { x, y } = position;
    if (direction === 'left') x -= 1;
    if (direction === 'right') x += 1;
    if (direction === 'up') y -= 1;
    if (direction === 'down') y += 1;
    return { x, y };
  }

  directionTo(position) {
    if (position.x > this.head.x) return 'right';
    if (position.x < this.head.x) return 'left';
    if (position.y > this.head.y) return 'down';
    if (position.y < this.head.y) return 'up';
  }

  getSafeMoves(position) {
    return ['up', 'down', 'left', 'right'].filter((direction) => {
      const { x, y } = this.getPosition(position, direction);

      const noOutOfBounds = x >= 0 && x < this.board.width && y >= 0 && y < this.board.height;

      const noHitSnakes = this.snakes.reduce(
        (res, snake) =>
          res &&
          snake.body.reduce((res, segment) => res && (segment.x !== x || segment.y !== y), true),
        true,
      );
      return noHitSnakes && noOutOfBounds;
    });
  }

  rankDirection(direction) {
    if (direction) {
      const position = this.getPosition(this.head, move);
      return this.getSafeMoves(position).length;
    } else {
      return 0;
    }
  }

  getBestMoves() {
    const moves = this.getSafeMoves(this.head);
    const maxRank = moves.reduce((max, move) => {
      const newRank = this.rankDirection(move);
      return newRank > max ? newRank : max;
    }, 0);
    return moves.filter((move) => this.rankDirection(move) === maxRank);
  }
}

class PathFinding {
  update(you, board) {
    this.you = you;
    this.head = you.body[0];
    this.board = board;
    this.snakes = board.snakes;
    this.foodMatrix = undefined;
    this.killMatrix = undefined;
  }

  getFoodMatrix() {
    if (this.foodMatrix === undefined) {
      const grid = Array(this.board.height)
        .fill()
        .map(() => Array(this.board.width).fill(0));

      this.snakes.forEach((snake) => {
        const isFullHealth = snake.health === 100;

        snake.body.forEach((segment, index) => {
          const { x, y } = segment;
          const isTail = index === snake.body.length - 1;
          const nextTailSolid = isTail && isFullHealth;

          if (!isTail || nextTailSolid) {
            grid[y][x] = 1;
          }

          if (index === 0 && snake.id !== this.you.id) {
            if (!!grid[y][x + 1]) grid[y][x + 1] = 1;
            if (!!grid[y][x - 1]) grid[y][x - 1] = 1;
            if (!!grid[y + 1]) grid[y + 1][x] = 1;
            if (!!grid[y - 1]) grid[y - 1][x] = 1;
          }
        });
      });

      debug('food matrix');
      printGrid(grid);
      this.foodMatrix = new PF.Grid(grid);
    }
    return this.foodMatrix;
  }

  getKillMatrix() {
    if (this.killMatrix === undefined) {
      const grid = Array(this.board.height)
        .fill()
        .map(() => Array(this.board.width).fill(0));

      // Go after weak snakes
      this.snakes.forEach((snake) => {
        if (snake.body.length < this.you.body.length) {
          snake.body.forEach((segment, index) => {
            const { x, y } = segment;
            const isHead = index === 0;

            if (!isHead) {
              grid[y][x] = 1;
            }
          });
        } else {
          snake.body.forEach((segment, index) => {
            const { x, y } = segment;
            const isTail = index === snake.body.length - 1;
            const isFullHealth = snake.health === 100;
            const nextTailSolid = isTail && isFullHealth;

            if (!isTail || nextTailSolid) {
              grid[y][x] = 1;
            }
            if (index === 0 && snake.id !== this.you.id) {
              if (!!grid[y][x + 1]) grid[y][x + 1] = 1;
              if (!!grid[y][x - 1]) grid[y][x - 1] = 1;
              if (!!grid[y + 1]) grid[y + 1][x] = 1;
              if (!!grid[y - 1]) grid[y - 1][x] = 1;
            }
          });
        }
      });

      debug('kill matrix');
      printGrid(grid);
      this.killMatrix = new PF.Grid(grid);
    }
    return this.killMatrix;
  }

  getPath(target, matrix) {
    const finder = new PF.AStarFinder();
    return finder.findPath(this.head.x, this.head.y, target.x, target.y, matrix.clone());
  }

  getShortestFoodPath(targets) {
    const paths = targets.map((target) => this.getPath(target, this.getFoodMatrix()));
    return this.getShortestPath(paths);
  }

  getShortestKillPath(targets) {
    return this.getShortestPath(
      targets.map((target) => this.getPath(target, this.getKillMatrix())),
    );
  }

  getShortestPath(paths) {
    return paths
      .filter((path) => path.length !== 0)
      .reduce((res, path) => (res && path.length > res.length ? res : path), null);
  }

  getNextPosition(path) {
    return { x: path[1][0], y: path[1][1] };
  }
}

const directionManager = new DirectionManager();
const pathfinding = new PathFinding();

const getMove = (you, board) => {
  debug('--------------------------------------');
  debug({ you });
  debug({ board });

  directionManager.update(you, board);
  pathfinding.update(you, board);

  // KILLING!
  const weakSnakes = board.snakes.filter((snake) => snake.body.length < you.body.length);

  if (weakSnakes.length !== 0) {
    const weakHeads = weakSnakes.map((snake) => snake.body[0]);
    const closestWeakHeadPath = pathfinding.getShortestKillPath(weakHeads);

    if (closestWeakHeadPath) {
      const nextPosition = pathfinding.getNextPosition(closestWeakHeadPath);

      if (directionManager.getSafeMoves(nextPosition)) {
        const move = directionManager.directionTo(nextPosition);
        debug('kill');
        debug(move);
        return move;
      }
    }
  }

  // FOOD!
  const closestFoodPath = pathfinding.getShortestFoodPath(board.food);

  if (closestFoodPath) {
    const nextPosition = pathfinding.getNextPosition(closestFoodPath);

    if (directionManager.getSafeMoves(nextPosition)) {
      const move = directionManager.directionTo(nextPosition);
      debug('food');
      debug(move);
      return move;
    }
  }

  // DO YOUR BEST!
  const bestMoves = directionManager.getBestMoves();
  const move = bestMoves[Math.floor(Math.random() * bestMoves.length)];
  debug('random');
  debug(move);
  return move;
};

module.exports = {
  getMove,
};
