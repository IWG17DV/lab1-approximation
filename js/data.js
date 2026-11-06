    const BASE_POINTS = [
      { x: -1, y: 10.0 },
      { x: 0, y: 5.0 },
      { x: 1, y: 2.5 },
      { x: 2, y: 1.2 },
      { x: 3, y: 0.6 }
    ];

    function createRandom(seed) {
      let state = seed >>> 0;
      return function random() {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
      };
    }

    function generatePoints(count, seed) {
      const random = createRandom(seed);
      const startX = -1;
      const endX = 3;
      const result = [];

      for (let index = 0; index < count; index += 1) {
        // Cosine-spaced nodes reduce edge oscillations in high-degree interpolation.
        const position = (1 - Math.cos(Math.PI * index / (count - 1))) / 2;
        const x = startX + (endX - startX) * position;
        const expectedY = 10 * Math.pow(0.5, x + 1);
        const noise = (random() * 2 - 1) * expectedY * 0.025;
        result.push({ x, y: expectedY + noise });
      }

      return result;
    }

    const DATASETS = {
      5: BASE_POINTS,
      10: generatePoints(10, 104),
      20: generatePoints(20, 208)
    };

    export { BASE_POINTS, DATASETS };
