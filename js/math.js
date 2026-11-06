    // Barycentric evaluation avoids repeatedly building the Lagrange basis.
    export function lagrangeInterpolation(x, interpolationPoints) {
      if (!Array.isArray(interpolationPoints) || interpolationPoints.length === 0) {
        throw new Error("Для інтерполяції потрібна принаймні одна точка.");
      }

      const weights = new Array(interpolationPoints.length);
      let largestLogWeight = -Infinity;

      for (let i = 0; i < interpolationPoints.length; i += 1) {
        let sign = 1;
        let logProduct = 0;
        for (let j = 0; j < interpolationPoints.length; j += 1) {
          if (i === j) continue;
          const difference = interpolationPoints[i].x - interpolationPoints[j].x;
          if (difference === 0) throw new Error("Координати x вузлів інтерполяції мають відрізнятися.");
          if (difference < 0) sign *= -1;
          logProduct += Math.log(Math.abs(difference));
        }
        weights[i] = { sign, logMagnitude: -logProduct };
        largestLogWeight = Math.max(largestLogWeight, weights[i].logMagnitude);
      }

      let numerator = 0;
      let denominator = 0;
      for (let i = 0; i < interpolationPoints.length; i += 1) {
        const point = interpolationPoints[i];
        const difference = x - point.x;
        if (Math.abs(difference) <= 1e-12 * Math.max(1, Math.abs(x), Math.abs(point.x))) {
          return point.y;
        }

        const weight = weights[i].sign * Math.exp(weights[i].logMagnitude - largestLogWeight);
        const term = weight / difference;
        numerator += term * point.y;
        denominator += term;
      }

      if (!Number.isFinite(numerator / denominator)) {
        throw new Error("Не вдалося обчислити значення інтерполяційного полінома.");
      }
      return numerator / denominator;
    }

    function solveGaussian(matrix, vector) {
      const size = vector.length;
      const augmented = matrix.map((row, index) => [...row, vector[index]]);
      let matrixScale = 0;
      for (const row of matrix) {
        for (const value of row) matrixScale = Math.max(matrixScale, Math.abs(value));
      }

      for (let column = 0; column < size; column += 1) {
        let pivotRow = column;
        for (let row = column + 1; row < size; row += 1) {
          if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivotRow][column])) {
            pivotRow = row;
          }
        }

        if (Math.abs(augmented[pivotRow][column]) <= Number.EPSILON * matrixScale * size * 32) {
          throw new Error("Система МНК вироджена: оберіть менший степінь полінома.");
        }

        [augmented[column], augmented[pivotRow]] = [augmented[pivotRow], augmented[column]];
        const pivot = augmented[column][column];
        for (let entry = column; entry <= size; entry += 1) {
          augmented[column][entry] /= pivot;
        }

        for (let row = 0; row < size; row += 1) {
          if (row === column) continue;
          const factor = augmented[row][column];
          for (let entry = column; entry <= size; entry += 1) {
            augmented[row][entry] -= factor * augmented[column][entry];
          }
        }
      }

      return augmented.map((row) => row[size]);
    }

    function binomialCoefficient(n, k) {
      let result = 1;
      for (let index = 1; index <= k; index += 1) {
        result = result * (n - index + 1) / index;
      }
      return result;
    }

    // Fit in a centered, scaled x-domain, then convert to ordinary x powers.
    export function leastSquaresMethod(inputPoints, degree) {
      if (!Array.isArray(inputPoints) || inputPoints.length < degree + 1) {
        throw new Error("Для обраного степеня недостатньо точок.");
      }
      if (!Number.isInteger(degree) || degree < 0) {
        throw new Error("Степінь полінома має бути цілим невід’ємним числом.");
      }

      const minX = Math.min(...inputPoints.map((point) => point.x));
      const maxX = Math.max(...inputPoints.map((point) => point.x));
      const center = (minX + maxX) / 2;
      const scale = (maxX - minX) / 2;
      if (!(scale > 0)) throw new Error("Для апроксимації потрібні різні значення x.");

      const columnCount = degree + 1;
      const normalMatrix = Array.from({ length: columnCount }, () => Array(columnCount).fill(0));
      const rightHandSide = Array(columnCount).fill(0);

      for (const point of inputPoints) {
        const z = (point.x - center) / scale;
        const row = Array(columnCount).fill(1);
        for (let column = 1; column < columnCount; column += 1) {
          row[column] = row[column - 1] * z;
        }
        for (let i = 0; i < columnCount; i += 1) {
          rightHandSide[i] += row[i] * point.y;
          for (let j = 0; j < columnCount; j += 1) {
            normalMatrix[i][j] += row[i] * row[j];
          }
        }
      }

      const scaledCoefficients = solveGaussian(normalMatrix, rightHandSide);
      const rawCoefficients = Array(columnCount).fill(0);
      for (let power = 0; power < columnCount; power += 1) {
        for (let rawPower = 0; rawPower <= power; rawPower += 1) {
          rawCoefficients[rawPower] += scaledCoefficients[power]
            * binomialCoefficient(power, rawPower)
            * Math.pow(-center, power - rawPower)
            / Math.pow(scale, power);
        }
      }

      if (rawCoefficients.some((value) => !Number.isFinite(value))) {
        throw new Error("Отримано некоректні коефіцієнти МНК.");
      }
      return rawCoefficients;
    }

    export function getOlsValue(x, polynomialCoefficients) {
      let value = 0;
      for (let index = polynomialCoefficients.length - 1; index >= 0; index -= 1) {
        value = value * x + polynomialCoefficients[index];
      }
      return value;
    }

