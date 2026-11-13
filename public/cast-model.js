// SI units. The prescribed input is the grip motion. Everything downstream
// of the flexible tip is a freely moving mass, including the terminal fly.
const CastModel = (() => {
  const step = 1 / 360, count = 56, frameskip = 4, iterations = 12;
  const maxTime = 9;
  const rodLengths = [2.286, 2.743, 3.048], leaders = [2.286, 2.743, 3.658];
  const lineDiameters = [.00091, .00105, .00119], tippetDiameters = [.00020, .00015, .00013];
  const lineLength = 5.6, referenceRod = rodLengths[1];
  const waterLevel = .025;
  // The angler is a vertical cylinder the line cannot cross.
  const body = {x: 0, z: 0, radius: .24, height: 1.8};

  // The caster's gesture. Angles are the rod butt's, in radians above the forward
  // horizontal. Hand points are [x, y] in metres. Times are seconds.
  const gesture = {
    startAngle: -.33, liftAngle: .81, backAngle: 1.77, driftAngle: .075, frontAngle: .55, endAngle: -.25,
    startHand: [.40, 1.15], liftHand: [.40, 1.42], backHand: [-.05, 1.56], frontHand: [.49, 1.35], endHand: [.50, 1.12],
    // During the pause the hand keeps drifting up and back, and the rod with it.
    driftHand: [-.03, .05],
    liftTime: .46, blend: .132, backTime: .23, frontTime: .345, lowerDelay: -.085, lowerTime: 1, driftTime: .7,
    // The forward stroke starts once the back cast has unrolled this fraction of its length
    // (it reaches about 0.95 by the time the stroke peaks), within these pause bounds.
    extension: .55, minPause: .2, maxPause: 1.3,
    // Rod damping ratio, frontal area of the fly (m²) and internal friction of the line (m²/s).
    rodDamping: .36, flyArea: .00006, bendDamping: .03
  };

  const limit = x => Math.min(1, Math.max(0, x));
  const ease = x => (x = limit(x), x * x * (3 - 2 * x));
  // Accelerate progressively, brake to zero at the stop.
  const stroke = x => (x = limit(x), x ** 3 * (4 - 3 * x));

  // 0 lift, 1 back stroke, 2 back pause, 3 forward stroke, 4 presentation.
  function phaseAt(t, timing) {
    return t < timing.back[0] ? 0 : t < timing.back[1] ? 1 : t < timing.front[0] ? 2 : t < timing.front[1] ? 3 : 4;
  }

  // km/h. Gusts swing around the chosen speed, from 70 % to 130 %.
  function windAt(settings, t) {
    return settings.wind * (settings.gust ? 1 + .22 * Math.sin(4.3 * t) + .08 * Math.sin(9 * t) : 1);
  }

  function rodPoint(hand, angle, bend, length, q, lateral = 0) {
    // Integrate a unit tangent along an arc in its instantaneous bending plane.
    const turn = Math.hypot(bend, lateral), half = turn * q * .5;
    const along = length * q * (Math.abs(half) < 1e-7 ? 1 : Math.sin(2 * half) / (2 * half));
    const normal = turn < 1e-7 ? length * q * q * .5 : 2 * length * Math.sin(half) ** 2 / (turn * turn);
    const c = Math.cos(angle), sn = Math.sin(angle);
    return [hand[0] + along * c - normal * bend * sn, hand[1] + along * sn + normal * bend * c, hand[2] + normal * lateral];
  }

  function simulate(s, overrides) {
    const terrain = s.rockSeed == null ? null :
      (typeof RiverRocks === 'undefined' ? require('./rocks.js') : RiverRocks).create(s.rockSeed);
    const floor = (x,z) => Math.max(waterLevel,terrain.top(x,z)+.006);
    const g = overrides ? {...gesture, ...overrides} : gesture;
    const rod = rodLengths[s.rod], leader = leaders[s.leader], line = lineLength, total = line + leader, ds = total / count;
    const size = (count + 1) * 3, pos = new Float64Array(size), prev = pos.slice(), vel = pos.slice();
    const mass = new Float64Array(count + 1), inv = mass.slice(), diameter = mass.slice(), link = mass.slice();
    for (let i = 1; i <= count; i++) {
      const metres = (i - .5) * ds, u = metres / line;
      // Leader: 60 % butt, 20 % taper, 20 % tippet.
      const taper = limit(((metres - line) / leader - .6) / .2);
      const profile = s.line === 0 ? .86 + .24 * Math.sin(Math.PI * limit((u - .36) / .64)) : .8 + .25 * Math.sin(Math.PI * u);
      diameter[i] = metres < line ? lineDiameters[s.weight] * profile :
        .00053 * (1 - taper) + tippetDiameters[s.tip] * taper;
      const density = metres < line ? 920 : 1150;
      mass[i] = density * Math.PI * .25 * diameter[i] ** 2 * ds;
      if (i === count) mass[i] += .000045;
      inv[i] = 1 / mass[i];
    }
    // Internal friction of the line: it resists neighbouring nodes moving apart,
    // which is what keeps a real line from folding into sharp corners.
    for (let i = 1; i < count; i++) link[i] = g.bendDamping * Math.min(mass[i], mass[i + 1]) / (ds * ds);

    // The rod is matched to its line class: stiffness follows the line mass,
    // so a #3 flexes under a #3 line about as much as a #7 under a #7 line.
    const classStiffness = (lineDiameters[s.weight] / lineDiameters[1]) ** 2;
    const lengthRatio = rod / referenceRod;
    // First bending mode: natural frequency (rad/s) and effective rotational inertia (kg m²).
    const natural = 27 / lengthRatio * classStiffness ** .25;
    const modalInertia = .016 * lengthRatio ** 2 * classStiffness ** .5;
    const damping = g.rodDamping;

    // Gesture clock. The forward stroke has no fixed time: it waits for the back cast.
    const backStart = g.liftTime - g.blend, backEnd = backStart + g.backTime;
    let frontStart = Infinity;
    const timing = {lift: [0, g.liftTime], back: [backStart, backEnd], front: null, lower: null, pause: null};

    let tipAngle = g.startAngle, omega = 0, lateral = 0, lateralRate = 0;
    let landing = null;
    const normals = new Float64Array(count * 3), diag = mass.slice(), off = mass.slice(), rhs = mass.slice();
    const frames = [];
    const blendPoint = (a, b, u, out) => { out[0] += (b[0] - a[0]) * u; out[1] += (b[1] - a[1]) * u; };

    for (let n = 0; n <= maxTime / step; n++) {
      const t = n * step;
      const lift = ease(t / g.liftTime), back = (t - backStart) / g.backTime;
      const driftTime = Math.max(0, (t - backEnd + .1) / g.driftTime);
      const drift = -Math.expm1(-2 * driftTime ** 2);
      const front = (t - frontStart) / g.frontTime, lower = ease((t - frontStart - g.frontTime - g.lowerDelay) / g.lowerTime);
      const backTop = g.backAngle + g.driftAngle;
      const angle = g.startAngle + (g.liftAngle - g.startAngle) * lift + (g.backAngle - g.liftAngle) * stroke(back) + g.driftAngle * drift
        - (backTop - g.frontAngle) * stroke(front) - (g.frontAngle - g.endAngle) * lower;
      // The hand travels steadily through each stroke while the rod turns late.
      const hand = [g.startHand[0], g.startHand[1], .35];
      blendPoint(g.startHand, g.liftHand, lift, hand);
      blendPoint(g.liftHand, g.backHand, ease(back), hand);
      hand[0] += g.driftHand[0] * drift; hand[1] += g.driftHand[1] * drift;
      blendPoint([g.backHand[0] + g.driftHand[0], g.backHand[1] + g.driftHand[1]], g.frontHand, ease(front), hand);
      blendPoint(g.frontHand, g.endHand, lower, hand);

      // A shallow outside arc carries the elbow through the high reversal.
      // Its tangent is already moving at the rear stop, before the return.
      const outward = ease((t - backStart) / (g.backTime + g.driftTime));
      hand[2] += .030 * outward * (1 - ease(front));
      omega += step * (natural ** 2 * (angle - tipAngle) - 2 * damping * natural * omega);
      tipAngle += omega * step;
      lateralRate += step * (-(natural ** 2) * lateral - 2 * damping * natural * lateralRate);
      lateral += step * lateralRate;
      let curvature = 2 * (tipAngle - angle);
      const predictedBend = curvature, predictedLateral = lateral;
      const tip = rodPoint(hand, angle, curvature, rod, 1, lateral);

      if (!n) {
        // Lay the line on the water in front of the angler.
        pos.set(tip);
        for (let i = 1; i <= count; i++) {
          const j = i * 3, dy = Math.min(ds * .48, Math.max(0, pos[j - 2] - waterLevel));
          pos.set([pos[j - 3] + Math.sqrt(ds * ds - dy * dy), pos[j - 2] - dy, tip[2]], j);
          if(terrain){
            // Walk one link length along the bed, including the initial drape.
            const x=pos[j-3], y=pos[j-2], target=pos[j+1];
            const height=dx=>Math.max(target,floor(x+dx,tip[2]));
            let low=0, high=ds;
            for(let pass=0;pass<16;pass++){
              const dx=(low+high)/2;
              if(Math.hypot(dx,height(dx)-y)>ds)high=dx; else low=dx;
            }
            pos[j]=x+low; pos[j+1]=height(low);
          }
        }
      } else {
        prev.set(pos);
        pos.set(tip);
        const wind = windAt(s, t) / 3.6, wx = wind * Math.cos(s.dir), wz = wind * Math.sin(s.dir);
        for (let i = 1; i <= count; i++) {
          const j = 3 * i, vx = vel[j], vy = vel[j + 1], vz = vel[j + 2];
          const tx = (prev[j] - prev[j - 3]) / ds, ty = (prev[j + 1] - prev[j - 2]) / ds, tz = (prev[j + 2] - prev[j - 1]) / ds;
          const rx = wx - vx, ry = -vy, rz = wz - vz, along = rx * tx + ry * ty + rz * tz;
          const nx = rx - along * tx, ny = ry - along * ty, nz = rz - along * tz;
          // Line lying on the water is half submerged and sits below the wind.
          const wet = prev[j + 1] <= waterLevel + .001 ? 14 : 0, shelter = wet ? .1 : 1;
          const drag = shelter * .5 * 1.225 * diameter[i] * ds * inv[i];
          const normal = drag * 1.05 * Math.hypot(nx, ny, nz), tangent = drag * .025 * Math.abs(along) * along;
          const fly = i === count ? shelter * .5 * 1.225 * g.flyArea * inv[i] * Math.hypot(rx, ry, rz) : 0;
          let ax = normal * nx + tangent * tx + fly * rx - wet * vx, ay = normal * ny + tangent * ty + fly * ry - 9.81, az = normal * nz + tangent * tz + fly * rz - wet * vz;
          if (i > 1) { const c = link[i - 1] * inv[i]; ax += c * (vel[j - 3] - vx); ay += c * (vel[j - 2] - vy); az += c * (vel[j - 1] - vz); }
          if (i < count) { const c = link[i] * inv[i]; ax += c * (vel[j + 3] - vx); ay += c * (vel[j + 4] - vy); az += c * (vel[j + 5] - vz); }
          pos[j] += step * (vx + step * ax); pos[j + 1] += step * (vy + step * ay); pos[j + 2] += step * (vz + step * az);
        }

        // Newton projection of all segment lengths together. The constraint
        // Jacobian times inverse mass times its transpose is tridiagonal.
        for (let iter = 0; iter < iterations; iter++) {
          // Project the first link against the flexible tip. Its reaction
          // acts on both bending coordinates in the same constraint solve.
          const eps = .0001, anchor = rodPoint(hand, angle, curvature, rod, 1, lateral);
          const derivative = (bend, side) => rodPoint(hand, angle, bend, rod, 1, side).map((v, k) => (v - anchor[k]) / eps);
          const inPlane = derivative(curvature + eps, lateral), sideways = derivative(curvature, lateral + eps);
          let lever = 0, sideLever = 0;
          for (let i = 0; i < count; i++) {
            const j = i * 3, dx = pos[j + 3] - pos[j], dy = pos[j + 4] - pos[j + 1], dz = pos[j + 5] - pos[j + 2], len = Math.hypot(dx, dy, dz) || ds;
            normals[j] = dx / len; normals[j + 1] = dy / len; normals[j + 2] = dz / len;
            diag[i] = inv[i] + inv[i + 1]; rhs[i] = ds - len;
            if (i === 0) {
              for (let k = 0; k < 3; k++) { lever += normals[k] * inPlane[k]; sideLever += normals[k] * sideways[k]; }
              diag[i] += (lever ** 2 + sideLever ** 2) / modalInertia;
            } else {
              off[i] = -inv[i] * (normals[j] * normals[j - 3] + normals[j + 1] * normals[j - 2] + normals[j + 2] * normals[j - 1]);
              const r = off[i] / diag[i - 1];
              diag[i] -= r * off[i]; rhs[i] -= r * rhs[i - 1];
            }
          }
          for (let i = count - 1; i >= 0; i--) {
            rhs[i] = (rhs[i] - (i < count - 1 ? off[i + 1] * rhs[i + 1] : 0)) / diag[i];
            for (let k = 0; k < 3; k++) {
              const correction = rhs[i] * normals[i * 3 + k];
              pos[i * 3 + k] -= inv[i] * correction; pos[(i + 1) * 3 + k] += inv[i + 1] * correction;
            }
          }
          curvature -= rhs[0] * lever / modalInertia;
          lateral -= rhs[0] * sideLever / modalInertia;
          pos.set(rodPoint(hand, angle, curvature, rod, 1, lateral));
          for (let i = 1; i <= count; i++) {
            const j = 3 * i;
            pos[j + 1] = Math.max(waterLevel, pos[j + 1]);
            if(terrain && pos[j+1]<.75){
              pos[j+1]=Math.max(pos[j+1],floor(pos[j],pos[j+2]));
              // Check between nodes too, particularly at a crest or a small rock.
              const midFloor=floor((pos[j]+pos[j-3])*.5,(pos[j+2]+pos[j-1])*.5);
              const lift=midFloor-(pos[j+1]+pos[j-2])*.5;
              if(lift>0){
                pos[j+1]+=i===1?2*lift:lift;
                if(i>1)pos[j-2]+=lift;
              }
            }
            if (pos[j + 1] >= body.height) continue;
            const dx = pos[j] - body.x, dz = pos[j + 2] - body.z, distance = Math.hypot(dx, dz);
            if (distance >= body.radius) continue;
            const push = distance > 1e-9 ? body.radius / distance : 0;
            pos[j] = push ? body.x + dx * push : body.x + body.radius;
            pos[j + 2] = body.z + dz * push;
          }
        }
        tipAngle += (curvature - predictedBend) * .5;
        omega += (curvature - predictedBend) * .5 / step;
        lateralRate += (lateral - predictedLateral) / step;
        for (let j = 0; j < size; j++) vel[j] = (pos[j] - prev[j]) / step;
      }

      // Wait for the back cast: go forward once the fly is behind and the line nearly straight.
      if (frontStart === Infinity && t >= backEnd + g.minPause) {
        const dx = pos[size - 3] - pos[0], dy = pos[size - 2] - pos[1], dz = pos[size - 1] - pos[2];
        if (t >= backEnd + g.maxPause || (dx < 0 && Math.hypot(dx, dy, dz) >= g.extension * total)) {
          frontStart = t + step;
          timing.front = [frontStart, frontStart + g.frontTime];
          timing.lower = [timing.front[1] + g.lowerDelay, timing.front[1] + g.lowerDelay + g.lowerTime];
          timing.pause = (backEnd + frontStart) / 2;
        }
      }

      const flyHeight = pos[size - 2];
      const support=terrain && flyHeight<.75 ? floor(pos[size-3],pos[size-1]) : waterLevel;
      if (!landing && timing.front && t > timing.front[1] && flyHeight <= support + .00001) {
        landing = {surface: support>waterLevel ? 'rock' : 'water', time: t, x: pos[size - 3], z: pos[size - 1]};
      }
      if (n % frameskip === 0) {
        frames.push({hand, angle, curvature, lateral, points: Float32Array.from(pos)});
        if (landing && t > landing.time + .48) {
          let resting = true;
          for (let j = 3; j < size && resting; j++) resting = Math.abs(vel[j]) < .12;
          if (resting || t > landing.time + 1.5) break;
        }
      }
    }
    if (!timing.front) { timing.front = [maxTime, maxTime]; timing.lower = [maxTime, maxTime]; timing.pause = backEnd; }
    return {frames, rod, line, leader, ds, landing, timing, duration: (frames.length - 1) * frameskip * step};
  }

  return {simulate, rodPoint, windAt, phaseAt, gesture, rodLengths};
})();
if (typeof module !== 'undefined') module.exports = CastModel;
