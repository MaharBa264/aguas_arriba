// Invariants of the cast model: node --test
const test = require('node:test'), assert = require('node:assert');
const CastModel = require('../public/cast-model.js');

const standard = {rod: 1, weight: 1, line: 0, leader: 1, tip: 1, wind: 0, dir: 0, gust: false};

// Every frame is finite, the fly lands, and no segment drifts far from its rest length.
function check(settings, maxStretch) {
  const result = CastModel.simulate(settings), label = JSON.stringify(settings);
  assert.ok(result.landing, 'the fly never lands: ' + label);
  assert.ok(result.duration > result.landing.time, 'the cast ends before landing: ' + label);
  let stretch = 0;
  for (const {points, curvature, lateral} of result.frames) {
    assert.ok(Number.isFinite(curvature) && Number.isFinite(lateral) && points.every(Number.isFinite), 'non-finite frame: ' + label);
    for (let i = 3; i < points.length; i += 3) {
      const length = Math.hypot(points[i] - points[i - 3], points[i + 1] - points[i - 2], points[i + 2] - points[i - 1]);
      stretch = Math.max(stretch, Math.abs(length - result.ds) / result.ds);
    }
  }
  assert.ok(stretch < maxStretch, `segments stretch ${(stretch * 100).toFixed(1)} %: ${label}`);
  return result;
}

// Distance from rod tip to fly once the line has settled, as a fraction of its length.
function extension(result) {
  const points = result.frames.at(-1).points, last = points.length - 3;
  return Math.hypot(points[last] - points[0], points[last + 2] - points[2]) / (result.ds * (points.length / 3 - 1));
}

test('in calm air every outfit lays the line out, the standard one almost straight', () => {
  for (const rod of [0, 1, 2]) for (const weight of [0, 1, 2]) for (const line of [0, 1]) for (const leader of [0, 1, 2]) for (const tip of [0, 1, 2]) {
    const settings = {...standard, rod, weight, line, leader, tip}, reached = extension(check(settings, .08));
    // The 12 ft leader is the hard one to turn over.
    assert.ok(reached > (leader === 2 ? .6 : .85), `extension ${reached.toFixed(2)}: ${JSON.stringify(settings)}`);
  }
  assert.ok(extension(CastModel.simulate(standard)) > .95);
});

test('the standard outfit casts in every wind', () => {
  for (const wind of [15, 32, 50]) for (const degrees of [90, -90, 0, 180]) for (const gust of [false, true]) {
    check({...standard, wind, dir: degrees * Math.PI / 180, gust}, .08);
  }
});

test('the standard cast lands ahead of the angler, on the casting line', () => {
  const {landing} = check(standard, .08);
  assert.ok(landing.x > 10.5 && landing.x < 11.6, 'landing x = ' + landing.x);
  assert.ok(Math.abs(landing.z - .35) < .05, 'landing z = ' + landing.z);
});

test('wind moves the landing point downwind', () => {
  const calm = CastModel.simulate(standard).landing;
  const cross = CastModel.simulate({...standard, wind: 32, dir: Math.PI / 2}).landing;
  const head = CastModel.simulate({...standard, wind: 32, dir: Math.PI}).landing;
  assert.ok(cross.z > calm.z + 1, 'a crosswind towards +Z pushes the fly towards +Z');
  assert.ok(head.x < calm.x - 1, 'a headwind shortens the cast');
});

test('gusts swing around the chosen speed', () => {
  const settings = {wind: 30, gust: true};
  let low = Infinity, high = -Infinity, sum = 0, samples = 0;
  for (let t = 0; t < 60; t += .01) { const v = CastModel.windAt(settings, t); low = Math.min(low, v); high = Math.max(high, v); sum += v; samples++; }
  assert.ok(low >= 30 * .7 - 1e-9 && high <= 30 * 1.3 + 1e-9, `range ${low}..${high}`);
  assert.ok(high > 33 && low < 27, 'gusts go above and below the chosen speed');
  assert.ok(Math.abs(sum / samples - 30) < 1, 'mean ' + sum / samples);
  assert.strictEqual(CastModel.windAt({wind: 30, gust: false}, 1.7), 30);
});

test('phases follow the timing of each cast, and the caster waits for the line', () => {
  const {timing} = CastModel.simulate(standard), phaseAt = t => CastModel.phaseAt(t, timing);
  assert.strictEqual(phaseAt(0), 0);
  assert.strictEqual(phaseAt(timing.pause), 2);
  assert.strictEqual(phaseAt(timing.front[1] + .1), 4);
  let previous = 0;
  for (let t = 0; t < 6; t += .01) { const phase = phaseAt(t); assert.ok(phase >= previous); previous = phase; }
  // A longer leader takes longer to unroll behind, so the forward stroke starts later.
  const long = CastModel.simulate({...standard, leader: 2}).timing;
  assert.ok(long.front[0] > timing.front[0]);
});

test('the grip keeps moving through the overhead turn for each leader length', () => {
  for (const leader of [0, 1, 2]) {
    const {frames, timing, duration} = CastModel.simulate({...standard, leader});
    const dt = duration / (frames.length - 1);
    for (let i = Math.ceil(timing.back[0] / dt); i * dt <= timing.front[1]; i++) {
      const delta = frames[i].hand.map((value, axis) => value - frames[i - 1].hand[axis]);
      assert.ok(Math.hypot(...delta) / dt > .015, 'grip stalls at ' + i * dt);
    }
  }
});
